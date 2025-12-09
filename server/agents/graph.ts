/**
 * LangGraph StateGraph Definition
 * 
 * Wires together all agent nodes into a cohesive workflow.
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Portfolio no longer waits for Competency tracking (runs in background)
 * - Competency tracking is triggered asynchronously after portfolio updates
 */

import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { AgentStateAnnotation, GraphInput } from "./state";
import { 
  supervisorNode, 
  routeToNode, 
  createConversationalNode, 
  createPortfolioNode, 
  createCompetencyNode,
  createReportNode 
} from "./nodes";
import type { IStorage } from "../storage";

// Store for background competency tasks
const pendingCompetencyTasks: Map<string, Promise<void>> = new Map();

/**
 * Run competency tracking in the background (non-blocking)
 */
export function runCompetencyInBackground(
  storage: IStorage, 
  facilitatorId: string,
  messages: any[]
): void {
  const taskId = `${facilitatorId}-${Date.now()}`;
  
  const task = (async () => {
    try {
      console.log(`[Background Competency] Starting for facilitator ${facilitatorId}`);
      const competencyNode = createCompetencyNode(storage);
      
      await competencyNode({
        messages,
        userId: '',
        facilitatorId,
        next: 'END',
        response: '',
        providedContext: '',
        imageFilePaths: [],
      });
      
      console.log(`[Background Competency] Completed for facilitator ${facilitatorId}`);
    } catch (error) {
      console.error(`[Background Competency] Error for facilitator ${facilitatorId}:`, error);
    } finally {
      pendingCompetencyTasks.delete(taskId);
    }
  })();
  
  pendingCompetencyTasks.set(taskId, task);
}

/**
 * Create the agent graph with all nodes wired together
 * 
 * OPTIMIZATION: Portfolio now goes directly to END instead of waiting for competency.
 * Competency tracking is triggered in the background after the response is sent.
 */
export function createAgentGraph(storage: IStorage) {
  // Create node functions with storage dependency
  const conversationalNode = createConversationalNode(storage);
  const portfolioNode = createPortfolioNode(storage);
  const competencyNode = createCompetencyNode(storage);
  const reportNode = createReportNode(storage);
  
  // Build the StateGraph
  const workflow = new StateGraph(AgentStateAnnotation)
    // Add all nodes
    .addNode("supervisor", supervisorNode)
    .addNode("conversational", conversationalNode)
    .addNode("portfolio", portfolioNode)
    .addNode("competency", competencyNode)
    .addNode("report", reportNode)
    
    // Define edges
    // OPTIMIZATION: Portfolio now goes directly to END (competency runs in background)
    .addEdge("portfolio", END)
    
    // Competency tracking (when explicitly routed)
    .addEdge("competency", END)
    
    // Report goes directly to end
    .addEdge("report", END)
    
    // Conversational goes directly to end
    .addEdge("conversational", END)
    
    // Supervisor routes to the appropriate node
    .addConditionalEdges(
      "supervisor",
      routeToNode,
      {
        conversational: "conversational",
        portfolio: "portfolio",
        report: "report",
        competency: "competency",
        END: END,
      }
    )
    
    // Entry point
    .addEdge("__start__", "supervisor");
  
  // Compile the graph
  const app = workflow.compile();
  
  return app;
}

/**
 * Process a message through the agent graph
 * 
 * This is the main entry point for message processing.
 * Maintains backward compatibility with the old processMessageWithLangChain signature.
 * 
 * OPTIMIZATION: After portfolio updates, competency tracking runs in background
 * so the user gets their response faster.
 */
export async function processMessageWithGraph(
  storage: IStorage,
  userId: string,
  facilitatorId: string | undefined,
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  providedContext?: string,
  imageFilePaths?: string[],
  chatId?: string
): Promise<string> {
  if (!facilitatorId) {
    throw new Error('Facilitator ID is required for using the OBT Mentor Agent');
  }
  
  console.log('[Graph] Processing message...');
  console.log(`[Graph] User: ${userId}, Facilitator: ${facilitatorId}`);
  console.log(`[Graph] Message length: ${userMessage.length}, Context length: ${providedContext?.length || 0}`);
  
  // Create the graph
  const graph = createAgentGraph(storage);
  
  // Convert chat history to messages
  const messages = chatHistory.slice(-10).map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage({ content: msg.content });
    }
    // For AI messages, we'll just use HumanMessage to represent the conversation
    // The actual message type doesn't matter much since we're just providing context
    return new HumanMessage({ content: `[Previous AI Response]: ${msg.content}` });
  });
  
  // Add the current message
  messages.push(new HumanMessage({ content: userMessage }));
  
  // Prepare input state
  const input: GraphInput = {
    messages,
    userId,
    facilitatorId,
    chatId: chatId || "",
    providedContext: providedContext || "",
    imageFilePaths: imageFilePaths || [],
  };
  
  // Detect if this is a portfolio-related message (for background competency)
  const isPortfolioMessage = detectPortfolioIntent(userMessage);
  
  try {
    console.log('[Graph] Invoking graph...');
    
    // Add timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Graph processing timeout after 90 seconds')), 90000)
    );
    
    const invokePromise = graph.invoke(input);
    
    const result = await Promise.race([invokePromise, timeoutPromise]);
    console.log('[Graph] Graph invocation successful');
    
    // Extract response from state
    const response = result.response || "I apologize, but I wasn't able to generate a response. Please try again.";
    
    // OPTIMIZATION: Run competency tracking in background after portfolio updates
    if (isPortfolioMessage && facilitatorId) {
      console.log('[Graph] Triggering background competency tracking...');
      runCompetencyInBackground(storage, facilitatorId, messages);
    }
    
    return response;
  } catch (error: any) {
    console.error('[Graph] Error processing message:', error);
    
    // Provide user-friendly error messages
    if (error?.message?.includes('API key') || error?.message?.includes('authentication') || error?.message?.includes('401')) {
      throw new Error('Google API key authentication failed. Please verify your API key is valid and has access to the Gemini API.');
    } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      throw new Error('API quota exceeded. Please check your Google Cloud billing and quota limits.');
    } else if (error?.message?.includes('permission') || error?.message?.includes('403')) {
      throw new Error('API access denied. Please ensure the Gemini API is enabled in your Google Cloud project.');
    } else if (error?.message?.includes('timeout')) {
      throw new Error('Request timed out. Please try again with a shorter message.');
    } else {
      throw new Error(`AI agent error: ${error?.message || 'Unknown error occurred'}`);
    }
  }
}

/**
 * Simple portfolio intent detection for triggering background competency
 */
function detectPortfolioIntent(message: string): boolean {
  const normalizedMessage = message.toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  const portfolioKeywords = [
    'adicionar', 'registrar', 'cadastrar', 'incluir',
    'qualificacao', 'qualificação', 'certificado', 'curso', 'diploma',
    'atividade', 'experiencia', 'experiência', 'trabalhei',
    'add', 'register', 'qualification', 'activity', 'experience'
  ];

  return portfolioKeywords.some(keyword => normalizedMessage.includes(keyword));
}

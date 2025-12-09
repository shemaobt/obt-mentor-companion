/**
 * Portfolio Node
 * 
 * Strict data collection for portfolio management.
 * Tools: add_qualification, add_activity, update_qualification, attach_certificate
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "../state";
import { PORTFOLIO_PROMPT } from "../prompts";
import { getPortfolioNodeTools } from "../tools";
import type { IStorage } from "../../storage";

/**
 * Create portfolio node function
 */
export function createPortfolioNode(storage: IStorage) {
  
  return async function portfolioNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    console.log('[Portfolio Node] Processing portfolio request...');
    
    const { messages, facilitatorId, portfolioIntent } = state;
    
    if (!facilitatorId) {
      console.error('[Portfolio Node] No facilitator ID provided');
      return {
        response: "I need to know who you are before I can update your portfolio. Please log in.",
        next: 'END',
      };
    }
    
    console.log(`[Portfolio Node] Intent: ${portfolioIntent?.type || 'general'}`);
    
    // Initialize Gemini model with lower temperature for structured data
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required');
    }
    
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-pro",
      temperature: 0.3, // Lower temperature for more precise data collection
      apiKey,
      maxOutputTokens: 8192,
      timeout: 30000,
      maxRetries: 2,
    });
    
    // Get tools for this node
    const tools = getPortfolioNodeTools(storage, facilitatorId);
    
    // Create react agent
    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier: PORTFOLIO_PROMPT,
    });
    
    // Get the last human message
    const lastMessage = messages[messages.length - 1];
    let messageContent: string;
    
    if (lastMessage instanceof HumanMessage) {
      messageContent = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);
    } else {
      messageContent = "I want to add something to my portfolio.";
    }
    
    // Format chat history for the agent (last 10 messages)
    const formattedHistory = messages.slice(0, -1).slice(-10).map(msg => {
      if (msg instanceof HumanMessage) {
        return { role: 'human' as const, content: msg.content };
      } else if (msg instanceof AIMessage) {
        return { role: 'ai' as const, content: msg.content };
      }
      return { role: 'human' as const, content: String(msg.content) };
    });
    
    const humanMessage = new HumanMessage({ content: messageContent });
    
    try {
      console.log('[Portfolio Node] Invoking agent...');
      
      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Agent timeout after 60 seconds')), 60000)
      );
      
      const invokePromise = agent.invoke({
        messages: [...formattedHistory, humanMessage],
      });
      
      const result = await Promise.race([invokePromise, timeoutPromise]);
      console.log('[Portfolio Node] Agent invocation successful');
      
      // Extract the final AI message
      const aiMessages = result.messages.filter((msg: any) => 
        msg.role === 'ai' || msg._getType?.() === 'ai'
      );
      const lastAIMessage = aiMessages[aiMessages.length - 1];
      
      const response = lastAIMessage?.content?.toString() || 
        "I had trouble processing your portfolio request. Please try again.";
      
      // After portfolio update, route to competency tracking
      return {
        response,
        messages: [new AIMessage({ content: response })],
        next: 'competency', // Track competencies after portfolio updates
      };
    } catch (error: any) {
      console.error('[Portfolio Node] Error:', error);
      
      // Provide user-friendly error messages
      if (error?.message?.includes('API key') || error?.message?.includes('authentication')) {
        throw new Error('Google API key authentication failed.');
      } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        throw new Error('API quota exceeded.');
      } else {
        throw new Error(`Portfolio agent error: ${error?.message || 'Unknown error occurred'}`);
      }
    }
  };
}

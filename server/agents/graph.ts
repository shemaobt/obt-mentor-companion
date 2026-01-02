import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { AgentStateAnnotation, GraphInput } from "./state";
import {
  supervisorNode,
  routeToNode,
  createConversationalNode,
  createPortfolioNode,
  createCompetencyNode,
  createReportNode,
} from "./nodes";
import type { IStorage } from "../storage";

const pendingCompetencyTasks: Map<string, Promise<void>> = new Map();

export function runCompetencyInBackground(storage: IStorage, facilitatorId: string, messages: any[]): void {
  const taskId = `${facilitatorId}-${Date.now()}`;

  const task = (async () => {
    try {
      console.log(`[Background Competency] Starting for facilitator ${facilitatorId}`);
      const competencyNode = createCompetencyNode(storage);

      await competencyNode({
        messages,
        userId: "",
        facilitatorId,
        next: "END",
        response: "",
        providedContext: "",
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

export function createAgentGraph(storage: IStorage) {
  const conversationalNode = createConversationalNode(storage);
  const portfolioNode = createPortfolioNode(storage);
  const competencyNode = createCompetencyNode(storage);
  const reportNode = createReportNode(storage);

  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("conversational", conversationalNode)
    .addNode("portfolio", portfolioNode)
    .addNode("competency", competencyNode)
    .addNode("report", reportNode)
    .addEdge("portfolio", END)
    .addEdge("competency", END)
    .addEdge("report", END)
    .addEdge("conversational", END)
    .addConditionalEdges("supervisor", routeToNode, {
      conversational: "conversational",
      portfolio: "portfolio",
      report: "report",
      competency: "competency",
      END: END,
    })
    .addEdge("__start__", "supervisor");

  const app = workflow.compile();

  return app;
}

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
    throw new Error("Facilitator ID is required for using the OBT Mentor Agent");
  }

  console.log("[Graph] Processing message...");
  console.log(`[Graph] User: ${userId}, Facilitator: ${facilitatorId}`);

  const graph = createAgentGraph(storage);

  const messages = chatHistory.slice(-10).map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage({ content: msg.content });
    }
    return new HumanMessage({ content: `[Previous AI Response]: ${msg.content}` });
  });

  messages.push(new HumanMessage({ content: userMessage }));

  const input: GraphInput = {
    messages,
    userId,
    facilitatorId,
    chatId: chatId || "",
    providedContext: providedContext || "",
    imageFilePaths: imageFilePaths || [],
  };

  const isPortfolioMessage = detectPortfolioIntent(userMessage);

  try {
    console.log("[Graph] Invoking graph...");

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Graph processing timeout after 90 seconds")), 90000)
    );

    const invokePromise = graph.invoke(input);

    const result = await Promise.race([invokePromise, timeoutPromise]);
    console.log("[Graph] Graph invocation successful");

    const response = result.response || "I apologize, but I wasn't able to generate a response. Please try again.";

    if (isPortfolioMessage && facilitatorId) {
      console.log("[Graph] Triggering background competency tracking...");
      runCompetencyInBackground(storage, facilitatorId, messages);
    }

    return response;
  } catch (error: any) {
    console.error("[Graph] Error processing message:", error);

    if (error?.message?.includes("API key") || error?.message?.includes("authentication") || error?.message?.includes("401")) {
      throw new Error("Google API key authentication failed. Please verify your API key is valid.");
    } else if (error?.message?.includes("quota") || error?.message?.includes("429")) {
      throw new Error("API quota exceeded. Please check your Google Cloud billing and quota limits.");
    } else if (error?.message?.includes("permission") || error?.message?.includes("403")) {
      throw new Error("API access denied. Please ensure the Gemini API is enabled in your Google Cloud project.");
    } else if (error?.message?.includes("timeout")) {
      throw new Error("Request timed out. Please try again with a shorter message.");
    } else {
      throw new Error(`AI agent error: ${error?.message || "Unknown error occurred"}`);
    }
  }
}

function detectPortfolioIntent(message: string): boolean {
  const normalizedMessage = message
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const portfolioKeywords = [
    "adicionar",
    "registrar",
    "cadastrar",
    "incluir",
    "qualificacao",
    "qualificação",
    "certificado",
    "curso",
    "diploma",
    "atividade",
    "experiencia",
    "experiência",
    "trabalhei",
    "add",
    "register",
    "qualification",
    "activity",
    "experience",
  ];

  return portfolioKeywords.some((keyword) => normalizedMessage.includes(keyword));
}

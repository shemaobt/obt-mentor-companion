/**
 * LangGraph State Definitions
 * 
 * Defines the shared state that flows between agent nodes in the StateGraph.
 * This is the central data structure that all nodes read from and write to.
 */

import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

/**
 * Portfolio intent detected by supervisor for routing to portfolio node
 */
export interface PortfolioIntent {
  type: "add_qualification" | "add_activity" | "update_qualification" | "get_summary";
  data: Record<string, any>;
}

/**
 * Competency evidence tracked during conversation
 */
export interface TrackedEvidence {
  competencyId: string;
  text: string;
  strength: number;
}

/**
 * Node routing targets
 */
export type NodeTarget = "conversational" | "portfolio" | "report" | "competency" | "END";

/**
 * Agent State Annotation for LangGraph
 * 
 * Using Annotation.Root to define channels with proper reducers:
 * - messages: Accumulates messages with a reducer that appends new messages
 * - Other fields: Use default "last value wins" reducer
 */
export const AgentStateAnnotation = Annotation.Root({
  // Messages accumulate - new messages are appended to existing
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // User and facilitator IDs - set once at start
  userId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  facilitatorId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  
  // Routing - determines which node to execute next
  next: Annotation<NodeTarget>({
    reducer: (_, update) => update,
    default: () => "conversational",
  }),
  
  // Portfolio intent detected by supervisor
  portfolioIntent: Annotation<PortfolioIntent | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
  
  // Evidence tracked during conversation (for competency updates)
  trackedEvidence: Annotation<TrackedEvidence[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // Final response to return to user
  response: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  
  // Context from RAG (passed from routes.ts)
  providedContext: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  
  // Image file paths for vision processing
  imageFilePaths: Annotation<string[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
});

/**
 * Type alias for the state object
 */
export type AgentState = typeof AgentStateAnnotation.State;

/**
 * Input type for the graph (subset of state that's provided initially)
 */
export interface GraphInput {
  messages: BaseMessage[];
  userId: string;
  facilitatorId: string;
  providedContext?: string;
  imageFilePaths?: string[];
}

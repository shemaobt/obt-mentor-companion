import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export interface PortfolioIntent {
  type: "add_qualification" | "add_activity" | "update_qualification" | "get_summary";
  data: Record<string, any>;
}

export interface TrackedEvidence {
  competencyId: string;
  text: string;
  strength: number;
}

export type NodeTarget = "conversational" | "portfolio" | "report" | "competency" | "END";

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  userId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  facilitatorId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  chatId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  next: Annotation<NodeTarget>({
    reducer: (_, update) => update,
    default: () => "conversational",
  }),

  portfolioIntent: Annotation<PortfolioIntent | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),

  trackedEvidence: Annotation<TrackedEvidence[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  response: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  providedContext: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  imageFilePaths: Annotation<string[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

export interface GraphInput {
  messages: BaseMessage[];
  userId: string;
  facilitatorId: string;
  chatId?: string;
  providedContext?: string;
  imageFilePaths?: string[];
}

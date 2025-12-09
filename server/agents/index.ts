/**
 * LangGraph Multi-Agent System for OBT Mentor Companion
 * 
 * ARCHITECTURE (Gemini 2.5 Pro-powered, 4 nodes):
 * 1. Supervisor Node - Routes messages to appropriate node (keyword-based, no LLM)
 * 2. Conversational Node - Natural conversations, doc citation, competency tracking
 * 3. Portfolio Node - Strict data collection for qualifications and activities
 * 4. Competency Node - Background evidence tracking and level updates
 * 5. Report Node - Quarterly report generation
 * 
 * COST OPTIMIZATION: 
 * - Prompts reduced from ~15k chars to ~3k chars each
 * - Keyword-based routing (no LLM call)
 * - Formatting done in tools (not prompts)
 */

// State and types
export { AgentStateAnnotation, type AgentState, type GraphInput, type NodeTarget, type PortfolioIntent, type TrackedEvidence } from "./state";

// Prompts
export { CONVERSATIONAL_PROMPT, PORTFOLIO_PROMPT, COMPETENCY_TRACKER_PROMPT, REPORT_PROMPT, ROUTING_KEYWORDS } from "./prompts";

// Philosophy quotes
export { PHILOSOPHY_QUOTES, getQuoteBlock, ALL_PHILOSOPHY_QUOTES } from "./philosophy";

// Tools
export { 
  createPortfolioTools, 
  createCompetencyTools, 
  createCertificateTools, 
  createReadTools,
  createAllTools,
  getConversationalTools,
  getPortfolioNodeTools 
} from "./tools";

// Nodes
export { 
  supervisorNode, 
  routeToNode, 
  createConversationalNode, 
  createPortfolioNode, 
  createCompetencyNode,
  createReportNode,
  applyPendingEvidence,
  generateReportNarrative,
  analyzeConversationsForEvidence
} from "./nodes";

// Graph
export { createAgentGraph, processMessageWithGraph, runCompetencyInBackground } from "./graph";

// Streaming
export { processMessageWithStreaming, determineNodeType } from "./streaming";

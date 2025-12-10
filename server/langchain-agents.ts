/**
 * LangChain Multi-Agent System - Re-exports
 * 
 * This file re-exports from ./agents for backward compatibility.
 * All actual implementation is in the ./agents folder.
 */

// Core exports from agents module
export { 
  processMessageWithGraph as processMessageWithLangChain,
  applyPendingEvidence,
  generateReportNarrative,
  analyzeConversationsForEvidence,
  createAgentGraph,
  CONVERSATIONAL_PROMPT,
  PORTFOLIO_PROMPT,
  COMPETENCY_TRACKER_PROMPT,
  REPORT_PROMPT,
  createPortfolioTools, 
  createCompetencyTools, 
  createCertificateTools, 
  createReadTools,
  createAllTools,
} from "./agents";

// Vector memory for context retrieval
export { getComprehensiveContext } from "./vector-memory";

// Alias for routes.ts compatibility
import { CONVERSATIONAL_PROMPT } from "./agents";
export const OBT_MENTOR_INSTRUCTIONS = CONVERSATIONAL_PROMPT;

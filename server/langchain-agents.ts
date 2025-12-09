/**
 * LangChain Multi-Agent System for OBT Mentor Companion
 * 
 * ARCHITECTURE (Gemini 2.5 Pro-powered, 4-node StateGraph):
 * 1. Supervisor Node - Routes messages to appropriate node (keyword-based, no LLM)
 * 2. Conversational Node - Natural conversations, doc citation, competency tracking
 * 3. Portfolio Node - Strict data collection for qualifications and activities
 * 4. Competency Node - Background evidence tracking and level updates
 * 5. Report Node - Quarterly report generation
 * 
 * COST OPTIMIZATION: 
 * - Prompts reduced from ~15k chars to ~3k chars each (70% reduction)
 * - Keyword-based routing eliminates supervisor LLM call
 * - Formatting done in tools, not prompts
 * - Migrated from OpenAI GPT-4o to Gemini 2.5 Pro (75-98% cost reduction)
 */

import type { IStorage } from "./storage";
import type { Message, FacilitatorCompetency, FacilitatorQualification, MentorshipActivity } from "@shared/schema";

// Re-export everything from the new agents module
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
} from "./agents";

// Re-export tools for backward compatibility
export { 
  createPortfolioTools, 
  createCompetencyTools, 
  createCertificateTools, 
  createReadTools,
  createAllTools,
} from "./agents";

// Re-export for routes.ts compatibility
export { getComprehensiveContext } from "./vector-memory";

/**
 * Legacy function for backward compatibility
 * @deprecated Use createAgentGraph from ./agents instead
 */
export function initializeGeminiModels() {
  const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
  
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  console.log('[Gemini Init] API key exists:', !!apiKey, 'Length:', apiKey?.length);
  
  if (!apiKey) {
    console.error('[Gemini Init] GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables');
    console.error('[Gemini Init] Available env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('GEMINI') || k.includes('API')));
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini models');
  }
  
  // Conversational Agent - Gemini 2.5 Pro for natural conversations
  const conversationalModel = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-pro",
    temperature: 0.7,
    apiKey,
    maxOutputTokens: 8192,
    timeout: 30000,
    maxRetries: 2,
  });

  // Portfolio Agent - Gemini 2.5 Pro for structured operations
  const portfolioModel = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-pro",
    temperature: 0.3,
    apiKey,
    maxOutputTokens: 8192,
    timeout: 30000,
    maxRetries: 2,
  });

  // Report Agent - Gemini 2.5 Pro for narratives
  const reportModel = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-pro",
    temperature: 0.5,
    apiKey,
    maxOutputTokens: 8192,
    timeout: 30000,
    maxRetries: 2,
  });

  return { conversationalModel, portfolioModel, reportModel };
}

/**
 * Legacy exports - Keeping old prompt constants for reference only
 * @deprecated These prompts are no longer used. See ./agents/prompts.ts for new prompts.
 */
export const CONVERSATIONAL_AGENT_INSTRUCTIONS = "[DEPRECATED] See ./agents/prompts.ts";
export const PORTFOLIO_AGENT_INSTRUCTIONS = "[DEPRECATED] See ./agents/prompts.ts";

// Re-export for routes.ts backward compatibility
import { CONVERSATIONAL_PROMPT as _CONV_PROMPT } from "./agents";
export const OBT_MENTOR_INSTRUCTIONS = _CONV_PROMPT;

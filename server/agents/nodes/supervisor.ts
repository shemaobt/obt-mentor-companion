/**
 * Supervisor Node
 * 
 * Routes incoming messages to the appropriate agent node using keyword-based classification.
 * No LLM call - fast and deterministic routing.
 */

import { AgentState, NodeTarget } from "../state";
import { ROUTING_KEYWORDS } from "../prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Keywords for portfolio intent detection
 */
const PORTFOLIO_KEYWORDS = ROUTING_KEYWORDS.portfolio;

/**
 * Keywords for report generation intent
 */
const REPORT_KEYWORDS = ROUTING_KEYWORDS.report;

/**
 * Normalize text for keyword matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();
}

/**
 * Check if text contains any of the keywords
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  const normalizedText = normalizeText(text);
  return keywords.some(keyword => normalizedText.includes(normalizeText(keyword)));
}

/**
 * Detect portfolio intent and extract type
 */
function detectPortfolioIntent(text: string): { type: string; data: Record<string, any> } | null {
  const normalizedText = normalizeText(text);
  
  // Check for qualification keywords
  if (normalizedText.includes('qualificacao') || 
      normalizedText.includes('qualificação') ||
      normalizedText.includes('qualification') ||
      normalizedText.includes('certificado') ||
      normalizedText.includes('certificate') ||
      normalizedText.includes('curso') ||
      normalizedText.includes('course') ||
      normalizedText.includes('diploma')) {
    return { type: 'add_qualification', data: {} };
  }
  
  // Check for activity keywords
  if (normalizedText.includes('atividade') ||
      normalizedText.includes('activity') ||
      normalizedText.includes('experiencia') ||
      normalizedText.includes('experiência') ||
      normalizedText.includes('experience') ||
      normalizedText.includes('trabalhei') ||
      normalizedText.includes('worked')) {
    return { type: 'add_activity', data: {} };
  }
  
  return null;
}

/**
 * Keywords that indicate an AI message was asking for portfolio data
 * (used for context-aware routing)
 */
const PORTFOLIO_FOLLOWUP_INDICATORS = [
  // Portuguese prompts asking for qualification details
  'nome do curso', 'instituição', 'ano de conclusão', 'nível do curso',
  'descrição do conteúdo', 'breve descrição', 'pode descrever',
  'registrar sua qualificação', 'adicionar sua qualificação',
  // Portuguese prompts asking for activity details  
  'cargo/função', 'organização', 'duração', 'quanto tempo',
  'registrar sua atividade', 'experiência',
  // English equivalents
  'course title', 'institution', 'completion date', 'course level',
  'description', 'job title', 'organization', 'duration',
];

/**
 * Check if the previous AI message was asking for portfolio data
 */
function isPortfolioFollowup(messages: any[]): boolean {
  // Look at the last few messages for context
  const recentMessages = messages.slice(-6);
  
  // Find the last AI message before the current human message
  for (let i = recentMessages.length - 2; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg instanceof AIMessage) {
      const content = typeof msg.content === 'string' 
        ? msg.content.toLowerCase() 
        : JSON.stringify(msg.content).toLowerCase();
      
      // Check if AI was asking for portfolio data
      const isAskingForData = PORTFOLIO_FOLLOWUP_INDICATORS.some(
        indicator => content.includes(indicator.toLowerCase())
      );
      
      if (isAskingForData) {
        console.log('[Supervisor] Detected portfolio followup context from AI message');
        return true;
      }
      break; // Only check the most recent AI message
    }
  }
  
  return false;
}

/**
 * Supervisor node function
 * 
 * Analyzes the latest message and determines which node should handle it.
 */
export async function supervisorNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
  console.log('[Supervisor] Analyzing message for routing...');
  
  // Get the latest human message
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    console.log('[Supervisor] No human message found, defaulting to conversational');
    return { next: 'conversational' as NodeTarget };
  }
  
  const messageContent = typeof lastMessage.content === 'string' 
    ? lastMessage.content 
    : JSON.stringify(lastMessage.content);
  
  console.log(`[Supervisor] Message content (first 100 chars): ${messageContent.substring(0, 100)}...`);
  
  // Check for report generation intent (highest priority - explicit request)
  if (containsKeywords(messageContent, REPORT_KEYWORDS)) {
    console.log('[Supervisor] -> Routing to REPORT node');
    return { next: 'report' as NodeTarget };
  }
  
  // Check for portfolio intent (explicit add/register requests)
  if (containsKeywords(messageContent, PORTFOLIO_KEYWORDS)) {
    const intent = detectPortfolioIntent(messageContent);
    console.log(`[Supervisor] -> Routing to PORTFOLIO node (intent: ${intent?.type || 'general'})`);
    return { 
      next: 'portfolio' as NodeTarget,
      portfolioIntent: intent || undefined,
    };
  }
  
  // NEW: Check if this is a followup to a portfolio request
  // (e.g., user providing course details after agent asked for them)
  if (isPortfolioFollowup(messages)) {
    console.log('[Supervisor] -> Routing to PORTFOLIO node (followup context detected)');
    return { 
      next: 'portfolio' as NodeTarget,
      portfolioIntent: { type: 'followup', data: {} },
    };
  }
  
  // Default: conversational node handles everything else
  console.log('[Supervisor] -> Routing to CONVERSATIONAL node (default)');
  return { next: 'conversational' as NodeTarget };
}

/**
 * Router function for conditional edges
 * 
 * Returns the next node name based on state.next
 */
export function routeToNode(state: typeof AgentState.State): string {
  const next = state.next || 'conversational';
  console.log(`[Router] Routing to: ${next}`);
  return next;
}

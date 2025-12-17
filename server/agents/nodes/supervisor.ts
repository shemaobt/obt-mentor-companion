import { AgentState, NodeTarget } from "../state";
import { ROUTING_KEYWORDS } from "../prompts";
import { HumanMessage } from "@langchain/core/messages";

const PORTFOLIO_KEYWORDS = ROUTING_KEYWORDS.portfolio;

const REPORT_KEYWORDS = ROUTING_KEYWORDS.report;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function containsKeywords(text: string, keywords: string[]): boolean {
  const normalizedText = normalizeText(text);
  return keywords.some(keyword => normalizedText.includes(normalizeText(keyword)));
}

function detectPortfolioIntent(text: string): { type: string; data: Record<string, any> } | null {
  const normalizedText = normalizeText(text);
  
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

export async function supervisorNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
  console.log('[Supervisor] Analyzing message for routing...');
  
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
  
  if (containsKeywords(messageContent, REPORT_KEYWORDS)) {
    console.log('[Supervisor] -> Routing to REPORT node');
    return { next: 'report' as NodeTarget };
  }
  
  if (containsKeywords(messageContent, PORTFOLIO_KEYWORDS)) {
    const intent = detectPortfolioIntent(messageContent);
    console.log(`[Supervisor] -> Routing to PORTFOLIO node (intent: ${intent?.type || 'general'})`);
    return { 
      next: 'portfolio' as NodeTarget,
      portfolioIntent: intent || undefined,
    };
  }
  
  console.log('[Supervisor] -> Routing to CONVERSATIONAL node (default)');
  return { next: 'conversational' as NodeTarget };
}

export function routeToNode(state: typeof AgentState.State): string {
  const next = state.next || 'conversational';
  console.log(`[Router] Routing to: ${next}`);
  return next;
}

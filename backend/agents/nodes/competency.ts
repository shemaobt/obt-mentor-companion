import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "../state";
import { COMPETENCY_TRACKER_PROMPT } from "../prompts";
import { createCompetencyTools } from "../tools";
import type { IStorage } from "../../storage";
import { config } from "../../config";

export function createCompetencyNode(storage: IStorage) {
  
  return async function competencyNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    console.log('[Competency Node] Analyzing conversation for evidence...');
    
    const { messages, facilitatorId, response } = state;
    
    if (!facilitatorId) {
      console.log('[Competency Node] No facilitator ID, skipping');
      return { next: 'END' };
    }
    
    const humanMessages = messages
      .filter(msg => msg instanceof HumanMessage)
      .slice(-5);
    
    if (humanMessages.length === 0) {
      console.log('[Competency Node] No human messages to analyze, skipping');
      return { next: 'END' };
    }
    
    const conversationText = humanMessages
      .map(msg => {
        const content = msg.content;
        return typeof content === 'string' ? content : JSON.stringify(content);
      })
      .join('\n\n');
    
    if (conversationText.length < 50) {
      console.log('[Competency Node] Conversation too short for analysis, skipping');
      return { next: 'END' };
    }
    
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-pro",
      temperature: 0.3,
      apiKey: config.google.apiKey,
      maxOutputTokens: 4096,
      timeout: 30000,
      maxRetries: 2,
    });
    
    const tools = createCompetencyTools(storage, facilitatorId);
    
    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier: COMPETENCY_TRACKER_PROMPT,
    });
    
    const analysisPrompt = `Analyze this facilitator's recent messages and track any competency evidence you find. Work silently - just call the tools to track evidence.

RECENT MESSAGES FROM FACILITATOR:
${conversationText}

Remember: Track EVERY mention of skills, experiences, or accomplishments. Use your judgment to score evidence strength (1-10). If you find 3+ strong pieces of evidence for a competency, call suggest_competency_update.`;
    
    const humanMessage = new HumanMessage({ content: analysisPrompt });
    
    try {
      console.log('[Competency Node] Running evidence analysis...');
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Competency analysis timeout')), 30000)
      );
      
      const invokePromise = agent.invoke({
        messages: [humanMessage],
      });
      
      await Promise.race([invokePromise, timeoutPromise]);
      console.log('[Competency Node] Evidence analysis complete');
      
    } catch (error: any) {
      console.error('[Competency Node] Analysis error (non-fatal):', error?.message);
    }
    
    return { next: 'END' };
  };
}

export async function applyPendingEvidence(
  storage: IStorage,
  facilitatorId: string
): Promise<{ updatedCompetencies: string[]; totalEvidence: number }> {
  console.log(`[Apply Evidence] START for facilitator ${facilitatorId}`);
  
  try {
    const user = await storage.getUserByFacilitatorId(facilitatorId);
    if (!user) {
      console.log(`[Apply Evidence] ERROR: User not found for facilitator ${facilitatorId}`);
      return { updatedCompetencies: [], totalEvidence: 0 };
    }
    const userId = user.id;
    
    console.log(`[Apply Evidence] Calling storage.getFacilitatorEvidence...`);
    const allEvidence = await storage.getFacilitatorEvidence(facilitatorId);
    console.log(`[Apply Evidence] Got ${allEvidence.length} total evidence pieces`);
    
    const pendingEvidence = allEvidence.filter(e => !e.isAppliedToLevel);
    console.log(`[Apply Evidence] Filtered to ${pendingEvidence.length} pending evidence pieces`);

    if (pendingEvidence.length === 0) {
      console.log(`[Apply Evidence] No pending evidence, returning early`);
      return { updatedCompetencies: [], totalEvidence: 0 };
    }

    console.log(`[Apply Evidence] Found ${pendingEvidence.length} pending evidence pieces for facilitator ${facilitatorId}`);

    const evidenceByCompetency = new Map<string, typeof pendingEvidence>();
    for (const evidence of pendingEvidence) {
      const existing = evidenceByCompetency.get(evidence.competencyId) || [];
      existing.push(evidence);
      evidenceByCompetency.set(evidence.competencyId, existing);
    }

    const updatedCompetencies: string[] = [];

    for (const [competencyId, evidences] of evidenceByCompetency.entries()) {
      if (evidences.length < 3) {
        console.log(`[Apply Evidence] ${competencyId}: only ${evidences.length} evidence pieces (need 3+)`);
        continue;
      }

      const avgStrength = evidences.reduce((sum, e) => sum + e.strengthScore, 0) / evidences.length;

      if (avgStrength < 6) {
        console.log(`[Apply Evidence] ${competencyId}: avg strength ${avgStrength.toFixed(1)} (need 6+)`);
        continue;
      }

      console.log(`[Apply Evidence] ${competencyId}: ${evidences.length} evidence pieces, avg strength ${avgStrength.toFixed(1)} - UPDATING`);

      const competencies = await storage.getFacilitatorCompetencies(facilitatorId);
      const currentComp = competencies.find(c => c.competencyId === competencyId);
      const currentStatus = currentComp?.status || 'not_started';

      let newStatus: 'not_started' | 'emerging' | 'growing' | 'proficient' | 'advanced';
      
      if (avgStrength >= 8) {
        newStatus = 'proficient';
      } else if (avgStrength >= 7) {
        newStatus = 'proficient';
      } else if (avgStrength >= 6.5) {
        newStatus = 'growing';
      } else {
        newStatus = 'emerging';
      }

      const currentSource = currentComp?.statusSource || 'auto';
      
      if (!currentComp) {
        console.log(`[Apply Evidence] ERROR: Competency record not found for ${competencyId}`);
        continue;
      }

      if (currentSource === 'manual') {
        console.log(`[Apply Evidence] ${competencyId}: manually set to ${currentStatus}, skipping evidence application`);
        const evidenceIds = evidences.map(e => e.id);
        await storage.markEvidenceApplied(evidenceIds);
        continue;
      }

      if (currentSource === 'evidence') {
        console.log(`[Apply Evidence] ${competencyId}: already locked by previous evidence at ${currentStatus}, skipping`);
        const evidenceIds = evidences.map(e => e.id);
        await storage.markEvidenceApplied(evidenceIds);
        continue;
      }

      console.log(`[Apply Evidence] ${competencyId}: locking evidence-based level at ${newStatus} (was ${currentStatus} from auto-calculation)`);
      
      await storage.updateCompetencyStatus(
        currentComp.id,
        newStatus,
        `Evidence-based level from ${evidences.length} conversation observations (avg strength: ${avgStrength.toFixed(1)}/10). Locked to prevent auto-recalculation changes.`,
        'AI Assistant',
        userId,
        'evidence'
      );

      const evidenceIds = evidences.map(e => e.id);
      await storage.markEvidenceApplied(evidenceIds);

      updatedCompetencies.push(competencyId);
      console.log(`[Apply Evidence] ✓ Locked ${competencyId} at ${newStatus} (was ${currentStatus} auto)`);
    }

    return { 
      updatedCompetencies, 
      totalEvidence: pendingEvidence.length 
    };
  } catch (error) {
    console.error('[Apply Evidence] Error applying pending evidence:', error);
    return { updatedCompetencies: [], totalEvidence: 0 };
  }
}

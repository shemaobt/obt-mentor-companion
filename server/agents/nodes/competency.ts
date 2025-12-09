/**
 * Competency Node
 * 
 * Silent background node for tracking competency evidence from conversations.
 * This node runs after other nodes to analyze messages and track evidence.
 * Tools: track_competency_evidence, suggest_competency_update
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "../state";
import { COMPETENCY_TRACKER_PROMPT } from "../prompts";
import { createCompetencyTools } from "../tools";
import type { IStorage } from "../../storage";

/**
 * Create competency tracking node function
 */
export function createCompetencyNode(storage: IStorage) {
  
  return async function competencyNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    console.log('[Competency Node] Analyzing conversation for evidence...');
    
    const { messages, facilitatorId, response } = state;
    
    if (!facilitatorId) {
      console.log('[Competency Node] No facilitator ID, skipping');
      return { next: 'END' };
    }
    
    // Get the last few human messages for analysis
    const humanMessages = messages
      .filter(msg => msg instanceof HumanMessage)
      .slice(-5);
    
    if (humanMessages.length === 0) {
      console.log('[Competency Node] No human messages to analyze, skipping');
      return { next: 'END' };
    }
    
    // Extract text content from messages
    const conversationText = humanMessages
      .map(msg => {
        const content = msg.content;
        return typeof content === 'string' ? content : JSON.stringify(content);
      })
      .join('\n\n');
    
    // Skip if conversation is too short
    if (conversationText.length < 50) {
      console.log('[Competency Node] Conversation too short for analysis, skipping');
      return { next: 'END' };
    }
    
    // Initialize Gemini model
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[Competency Node] No API key, skipping');
      return { next: 'END' };
    }
    
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-pro",
      temperature: 0.3, // Low temperature for consistent analysis
      apiKey,
      maxOutputTokens: 4096,
      timeout: 30000,
      maxRetries: 2,
    });
    
    // Get competency tracking tools
    const tools = createCompetencyTools(storage, facilitatorId);
    
    // Create react agent
    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier: COMPETENCY_TRACKER_PROMPT,
    });
    
    // Create analysis prompt
    const analysisPrompt = `Analyze this facilitator's recent messages and track any competency evidence you find. Work silently - just call the tools to track evidence.

RECENT MESSAGES FROM FACILITATOR:
${conversationText}

Remember: Track EVERY mention of skills, experiences, or accomplishments. Use your judgment to score evidence strength (1-10). If you find 3+ strong pieces of evidence for a competency, call suggest_competency_update.`;
    
    const humanMessage = new HumanMessage({ content: analysisPrompt });
    
    try {
      console.log('[Competency Node] Running evidence analysis...');
      
      // Add timeout - shorter for background analysis
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Competency analysis timeout')), 30000)
      );
      
      const invokePromise = agent.invoke({
        messages: [humanMessage],
      });
      
      await Promise.race([invokePromise, timeoutPromise]);
      console.log('[Competency Node] Evidence analysis complete');
      
    } catch (error: any) {
      // Log but don't fail - this is a background process
      console.error('[Competency Node] Analysis error (non-fatal):', error?.message);
    }
    
    // Always return to END - the response was already set by the previous node
    return { next: 'END' };
  };
}

/**
 * Apply pending evidence to competency levels
 * This is called separately to update competencies based on accumulated evidence
 */
export async function applyPendingEvidence(
  storage: IStorage,
  facilitatorId: string
): Promise<{ updatedCompetencies: string[]; totalEvidence: number }> {
  console.log(`[Apply Evidence] START for facilitator ${facilitatorId}`);
  
  try {
    // Get facilitator's user to retrieve userId for change history
    const user = await storage.getUserByFacilitatorId(facilitatorId);
    if (!user) {
      console.log(`[Apply Evidence] ERROR: User not found for facilitator ${facilitatorId}`);
      return { updatedCompetencies: [], totalEvidence: 0 };
    }
    const userId = user.id;
    
    // Get all unapplied evidence for this facilitator
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

    // Group evidence by competency
    const evidenceByCompetency = new Map<string, typeof pendingEvidence>();
    for (const evidence of pendingEvidence) {
      const existing = evidenceByCompetency.get(evidence.competencyId) || [];
      existing.push(evidence);
      evidenceByCompetency.set(evidence.competencyId, existing);
    }

    const updatedCompetencies: string[] = [];

    // Process each competency
    for (const [competencyId, evidences] of evidenceByCompetency.entries()) {
      // Need at least 3 pieces of evidence
      if (evidences.length < 3) {
        console.log(`[Apply Evidence] ${competencyId}: only ${evidences.length} evidence pieces (need 3+)`);
        continue;
      }

      // Calculate average strength
      const avgStrength = evidences.reduce((sum, e) => sum + e.strengthScore, 0) / evidences.length;

      // Need average strength of 6+
      if (avgStrength < 6) {
        console.log(`[Apply Evidence] ${competencyId}: avg strength ${avgStrength.toFixed(1)} (need 6+)`);
        continue;
      }

      console.log(`[Apply Evidence] ${competencyId}: ${evidences.length} evidence pieces, avg strength ${avgStrength.toFixed(1)} - UPDATING`);

      // Get current competency status
      const competencies = await storage.getFacilitatorCompetencies(facilitatorId);
      const currentComp = competencies.find(c => c.competencyId === competencyId);
      const currentStatus = currentComp?.status || 'not_started';

      // Determine new status based on evidence strength
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

      // Skip if already locked by manual or previous evidence
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

      // Apply evidence to lock the competency level
      console.log(`[Apply Evidence] ${competencyId}: locking evidence-based level at ${newStatus} (was ${currentStatus} from auto-calculation)`);
      
      await storage.updateCompetencyStatus(
        currentComp.id,
        newStatus,
        `Evidence-based level from ${evidences.length} conversation observations (avg strength: ${avgStrength.toFixed(1)}/10). Locked to prevent auto-recalculation changes.`,
        'AI Assistant',
        userId,
        'evidence'
      );

      // Mark all evidence as applied
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

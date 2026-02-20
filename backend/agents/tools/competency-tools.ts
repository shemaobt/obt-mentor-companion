/**
 * Competency Tracking Tools
 * 
 * Tools for silently tracking competency evidence and suggesting updates.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { IStorage } from "../../storage";
import { CORE_COMPETENCIES } from "@shared/schema";

/**
 * Create competency tracking tools
 */
export function createCompetencyTools(storage: IStorage, facilitatorId: string) {
  
  const trackCompetencyEvidenceTool = new DynamicStructuredTool({
    name: "track_competency_evidence",
    description: "Silently track competency evidence from natural conversation. Use this when the facilitator mentions experiences, skills, or work that demonstrates competency growth. DO NOT announce you are tracking this - just observe and record. Examples: 'I helped a team with translation' (translation_theory, multimodal_skills), 'I mediated a conflict' (interpersonal_skills), 'I used storytelling techniques' (multimodal_skills).",
    schema: z.object({
      competencyId: z.string().describe("ID of the competency demonstrated (e.g., interpersonal_skills, multimodal_skills)"),
      evidenceText: z.string().describe("Brief description of what was observed or mentioned"),
      strengthScore: z.number().min(1).max(10).describe("Strength of this evidence (1-10): 1-3=weak mention, 4-6=moderate demonstration, 7-10=strong proficiency"),
      chatId: z.string().optional().describe("ID of the current chat"),
      messageId: z.string().optional().describe("ID of the message containing the evidence"),
    }),
    func: async ({ competencyId, evidenceText, strengthScore, chatId, messageId }) => {
      try {
        console.log(`\n🔍 [TRACK EVIDENCE] Called with:`, {
          facilitatorId,
          competencyId,
          competencyName: CORE_COMPETENCIES[competencyId]?.name || 'UNKNOWN',
          evidenceText,
          strengthScore,
          chatId,
          messageId
        });

        if (!CORE_COMPETENCIES[competencyId]) {
          console.error(`[TRACK EVIDENCE] ❌ Invalid competency ID: ${competencyId}`);
          return `Invalid competency ID: ${competencyId}`;
        }

        await storage.createCompetencyEvidence({
          facilitatorId,
          competencyId,
          evidenceText,
          source: 'conversation',
          strengthScore,
          chatId: chatId || null,
          messageId: messageId || null,
          isAppliedToLevel: false,
        });

        console.log(`[TRACK EVIDENCE] ✅ Successfully tracked evidence for ${CORE_COMPETENCIES[competencyId].name}`);
        return `Tracked evidence for ${CORE_COMPETENCIES[competencyId].name}`;
      } catch (error: any) {
        console.error(`[TRACK EVIDENCE] ❌ Failed:`, error);
        return `Error tracking evidence: ${error.message}`;
      }
    },
  });

  const suggestCompetencyUpdateTool = new DynamicStructuredTool({
    name: "suggest_competency_update",
    description: "Analyze accumulated evidence and AUTOMATICALLY update a competency level. Only use this when you've observed MULTIPLE strong pieces of evidence (3+ mentions with average strength 6+) demonstrating consistent growth. Updates the competency immediately without user approval.",
    schema: z.object({
      competencyId: z.string().describe("ID of the competency to analyze"),
      chatId: z.string().optional().describe("Current chat ID"),
      messageId: z.string().optional().describe("Current message ID"),
    }),
    func: async ({ competencyId, chatId, messageId }) => {
      try {
        console.log(`\n🚀 [SUGGEST UPDATE] Called with:`, {
          facilitatorId,
          competencyId,
          competencyName: CORE_COMPETENCIES[competencyId]?.name || 'UNKNOWN',
          chatId,
          messageId
        });

        if (!CORE_COMPETENCIES[competencyId]) {
          console.error(`[SUGGEST UPDATE] ❌ Invalid competency ID: ${competencyId}`);
          return `Invalid competency ID: ${competencyId}`;
        }

        // Get current competency status
        const competencies = await storage.getFacilitatorCompetencies(facilitatorId);
        const currentComp = competencies.find(c => c.competencyId === competencyId);
        const currentStatus = currentComp?.status || 'not_started';
        console.log(`[SUGGEST UPDATE] Current status: ${currentStatus}`);

        // Get ALL evidence for this competency and sort by most recent first
        const allEvidence = await storage.getCompetencyEvidence(facilitatorId, competencyId);
        const evidence = allEvidence.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        console.log(`[SUGGEST UPDATE] Found ${evidence.length} evidence pieces:`, evidence.map(e => ({
          text: e.evidenceText,
          strength: e.strengthScore,
          isApplied: e.isAppliedToLevel
        })));
        
        // Evidence analysis thresholds
        const MIN_EVIDENCE_COUNT = 3;
        const MIN_AVG_STRENGTH = 6;

        if (evidence.length < MIN_EVIDENCE_COUNT) {
          const result = `NOT_ENOUGH_EVIDENCE: Need ${MIN_EVIDENCE_COUNT} observations, currently have ${evidence.length}.`;
          console.log(`[SUGGEST UPDATE] ⚠️ ${result}`);
          return result;
        }

        // Calculate average strength score
        const avgStrength = evidence.reduce((sum, e) => sum + e.strengthScore, 0) / evidence.length;
        console.log(`[SUGGEST UPDATE] Average strength: ${avgStrength.toFixed(1)}/10`);

        if (avgStrength < MIN_AVG_STRENGTH) {
          const result = `NOT_ENOUGH_EVIDENCE: Average strength ${avgStrength.toFixed(1)}/10, need ${MIN_AVG_STRENGTH}+.`;
          console.log(`[SUGGEST UPDATE] ⚠️ ${result}`);
          return result;
        }

        // Determine suggested status based on evidence strength and count
        const statusProgression = ['not_started', 'emerging', 'growing', 'proficient', 'advanced'];
        const currentIndex = statusProgression.indexOf(currentStatus);
        
        // Strong evidence (8+) or many items (5+) → jump 2 levels, otherwise 1 level
        const shouldJumpTwoLevels = avgStrength >= 8 || evidence.length >= 5;
        const levelsToIncrease = shouldJumpTwoLevels ? 2 : 1;
        const newIndex = Math.min(currentIndex + levelsToIncrease, statusProgression.length - 1);
        const newStatus = statusProgression[newIndex];
        console.log(`[SUGGEST UPDATE] Calculated new status: ${currentStatus} (${currentIndex}) → ${newStatus} (${newIndex})`);

        // Don't downgrade
        if (newIndex <= currentIndex) {
          const result = `NOT_ENOUGH_EVIDENCE: Current level (${currentStatus}) is already appropriate for evidence strength.`;
          console.log(`[SUGGEST UPDATE] ⚠️ ${result}`);
          return result;
        }

        // Format evidence summary
        const evidenceSummary = evidence.slice(0, 3).map(e => `- ${e.evidenceText}`).join('\n');
        
        console.log(`[SUGGEST UPDATE] 📝 Updating competency in database...`);
        // Update competency
        await storage.upsertCompetency({
          facilitatorId,
          competencyId,
          status: newStatus,
          notes: `Automatically updated by AI mentor based on ${evidence.length} observations (avg strength: ${avgStrength.toFixed(1)}/10). Recent evidence:\n${evidenceSummary}`,
          statusSource: 'conversation',
        });
        console.log(`[SUGGEST UPDATE] ✅ Database updated successfully`);

        // Mark the evidence as applied to the level
        const evidenceIds = evidence.map(e => e.id);
        await storage.markEvidenceApplied(evidenceIds);
        console.log(`[SUGGEST UPDATE] ✅ Marked ${evidenceIds.length} evidence pieces as applied`);

        // Return a message for the AI to present conversationally
        const successMessage = `SUCCESS: Updated ${CORE_COMPETENCIES[competencyId].name} from ${currentStatus} to ${newStatus} based on ${evidence.length} strong observations (avg: ${avgStrength.toFixed(1)}/10).`;
        console.log(`[SUGGEST UPDATE] ✅ ${successMessage}\n`);
        return successMessage;
      } catch (error: any) {
        console.error(`[SUGGEST UPDATE] ❌ Failed:`, error);
        return `Error analyzing competency: ${error.message}`;
      }
    },
  });

  return [
    trackCompetencyEvidenceTool,
    suggestCompetencyUpdateTool,
  ];
}

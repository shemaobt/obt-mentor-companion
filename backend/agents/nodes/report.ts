import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage } from "@langchain/core/messages";
import { AgentState } from "../state";
import { REPORT_PROMPT } from "../prompts";
import type { IStorage } from "../../storage";
import type { Message, FacilitatorCompetency, FacilitatorQualification, MentorshipActivity } from "@shared/schema";
import { CORE_COMPETENCIES } from "@shared/schema";
import { config } from "../../config";

export function createReportNode(storage: IStorage) {
  
  return async function reportNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    console.log('[Report Node] Report generation requested');
    
    const response = "To generate a quarterly report, please use the 'Reports' section in your portfolio page and select the reporting period. This will create a comprehensive .docx report with an AI-generated narrative summary of your progress.";
    
    return {
      response,
      messages: [new AIMessage({ content: response })],
      next: 'END',
    };
  };
}

export async function generateReportNarrative(params: {
  facilitatorName: string;
  region: string | null;
  supervisor: string | null;
  totalLanguages: number;
  totalChapters: number;
  competencies: FacilitatorCompetency[];
  qualifications: FacilitatorQualification[];
  activities: MentorshipActivity[];
  recentMessages: Message[];
  periodStart: Date;
  periodEnd: Date;
}): Promise<string> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-pro",
    temperature: 0.5,
    apiKey: config.google.apiKey,
    maxOutputTokens: 8192,
    timeout: 30000,
    maxRetries: 2,
  });

  const competencyBreakdown = params.competencies.map(c => {
    const compDef = CORE_COMPETENCIES[c.competencyId];
    return `- ${compDef?.name || c.competencyId}: ${c.status}`;
  }).join('\n');

  const qualificationsList = params.qualifications.map(q => 
    `- ${q.courseTitle} (${q.institution}${q.completionDate ? `, ${new Date(q.completionDate).getFullYear()}` : ''})`
  ).join('\n');

  const activitiesList = params.activities.map(a => {
    if (a.activityType === 'translation' || !a.activityType) {
      return `- Translation: ${a.language || 'Language not specified'} (${a.context || 'Context not provided'})`;
    } else {
      return `- ${a.activityType}: ${a.context || 'Details not provided'}`;
    }
  }).join('\n');

  const userMessageCount = params.recentMessages.filter(m => m.role === 'user').length;
  const sessionCount = Math.floor(userMessageCount / 2);

  const conversationSample = params.recentMessages
    .filter(m => m.role === 'user')
    .slice(-10)
    .map(m => m.content)
    .join('\n');

  const prompt = `${REPORT_PROMPT}

**Facilitator Profile:**
- Name: ${params.facilitatorName}
- Region: ${params.region || 'Not specified'}
- Supervisor: ${params.supervisor || 'Not specified'}
- Languages Mentored: ${params.totalLanguages}
- Chapters Completed: ${params.totalChapters}
- Reporting Period: ${params.periodStart.toLocaleDateString('en-US')} to ${params.periodEnd.toLocaleDateString('en-US')}

**Competency Status:**
${competencyBreakdown}

**Formal Qualifications (${params.qualifications.length}):**
${qualificationsList || 'None recorded'}

**Mentorship Activities (${params.activities.length}):**
${activitiesList || 'None recorded'}

**Engagement:**
- Participated in ${sessionCount} mentorship sessions during this period

**Recent Discussion Topics:**
${conversationSample || 'No conversation data available'}

Generate the quarterly narrative now:`;

  try {
    const response = await model.invoke([
      { role: 'user', content: prompt }
    ]);
    
    return response.content.toString();
  } catch (error) {
    console.error('[Report Generation Error]', error);
    throw new Error('Failed to generate report narrative');
  }
}

export async function analyzeConversationsForEvidence(
  storage: IStorage,
  facilitatorId: string,
  messages: Message[]
): Promise<Array<{competencyId: string, evidenceText: string, strengthScore: number}>> {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n---\n\n');

  if (!userMessages) {
    return [];
  }

  const prompt = `You are analyzing a facilitator's chat history to identify competency evidence they've shared. Review their messages and extract EVERY instance where they demonstrate competencies.

**THE 11 COMPETENCIES:**
1. **interpersonal_skills** - Team work, leadership, conflict resolution, group dynamics, listening, empathy
2. **intercultural_communication** - Cultural sensitivity, adapting to cultures, indigenous work, cross-cultural ministry
3. **multimodal_skills** - Storytelling, oral methods, drama, gestures, embodied learning, visual communication
4. **translation_theory** - Translation work, meaning-based translation, consultant checking, back-translation
5. **languages_communication** - Linguistics, language analysis, discourse, grammar, semantics
6. **biblical_languages** - Hebrew, Greek, biblical language study, exegesis
7. **biblical_studies** - Bible study, theology, hermeneutics, biblical interpretation
8. **planning_quality** - Project management, quality assurance, planning, scheduling, assessment
9. **consulting_mentoring** - Teaching, mentoring, coaching, guiding others, training, discipleship
10. **applied_technology** - AI, programming, digital tools, tech training, software, automation
11. **reflective_practice** - Self-reflection, growth, learning, accountability, self-awareness

**CHAT HISTORY:**
${userMessages}

**RETURN FORMAT (JSON):**
Return ONLY a JSON array of objects, nothing else. Each object must have:
{
  "competencyId": "exact_id_from_list",
  "evidenceText": "brief description of what they said",
  "strengthScore": number_1_to_10
}

Extract ALL competency evidence now (return JSON only):`;

  try {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-pro",
      temperature: 0.3,
      apiKey: config.google.apiKey,
      maxOutputTokens: 8192,
      timeout: 60000,
      maxRetries: 2,
    });
    
    const response = await model.invoke([
      { role: 'user', content: prompt }
    ]);
    
    const responseText = response.content.toString().trim();
    
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      const match = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      jsonText = match ? match[1] : responseText;
    } else if (responseText.includes('```')) {
      const match = responseText.match(/```\s*([\s\S]*?)\s*```/);
      jsonText = match ? match[1] : responseText;
    }
    
    const evidenceItems = JSON.parse(jsonText);
    
    if (!Array.isArray(evidenceItems)) {
      console.error('[Chat Analysis] Response was not an array:', evidenceItems);
      return [];
    }

    const results: Array<{competencyId: string, evidenceText: string, strengthScore: number}> = [];
    
    for (const item of evidenceItems) {
      if (!item.competencyId || !item.evidenceText || !item.strengthScore) {
        console.warn('[Chat Analysis] Skipping invalid evidence item:', item);
        continue;
      }

      if (!CORE_COMPETENCIES[item.competencyId]) {
        console.warn(`[Chat Analysis] Invalid competency ID: ${item.competencyId}`);
        continue;
      }

      try {
        await storage.createCompetencyEvidence({
          facilitatorId,
          competencyId: item.competencyId,
          evidenceText: item.evidenceText,
          source: 'conversation_history',
          strengthScore: item.strengthScore,
          chatId: null,
          messageId: null,
          isAppliedToLevel: false,
        });

        results.push({
          competencyId: item.competencyId,
          evidenceText: item.evidenceText,
          strengthScore: item.strengthScore
        });
      } catch (error) {
        console.error(`[Chat Analysis] Error storing evidence:`, error);
      }
    }

    console.log(`[Chat Analysis] Successfully stored ${results.length} pieces of evidence`);
    return results;
  } catch (error) {
    console.error('[Chat Analysis] Error analyzing conversations:', error);
    throw new Error('Failed to analyze chat history for competency evidence');
  }
}

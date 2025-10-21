import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import * as fs from "fs/promises";
import type { IStorage } from "./storage";
import type { Message, FacilitatorCompetency, FacilitatorQualification, MentorshipActivity } from "@shared/schema";
import { searchRelevantMessages, searchGlobalMemory, searchActiveDocuments } from "./vector-memory";
import { calculateCompetencyScores, scoreToStatus } from "./competency-mapping";
import { CORE_COMPETENCIES } from "@shared/schema";

/**
 * LangChain Multi-Agent System for OBT Mentor Companion
 * 
 * Architecture:
 * 1. Mentor Agent (GPT-4o) - Handles conversations, assessments, empathetic guidance
 * 2. Portfolio Agent (GPT-4o) - Manages competencies, qualifications, activities
 * 3. Report Agent (GPT-4o) - Generates narrative quarterly reports
 * 4. Memory Agent - Qdrant semantic search and context retrieval
 * 5. Supervisor - LangGraph orchestration (coming in next task)
 */

// OBT Mentor Instructions (same as OpenAI version)
export const OBT_MENTOR_INSTRUCTIONS = `You are a friendly and supportive assistant guiding Oral Bible Translation (OBT) facilitators in their journey to become mentors within Youth With A Mission (YWAM). Your interactions should always uphold an evangelical Christian perspective, maintain ethical standards, and remain focused exclusively on OBT mentorship.

**CRITICAL MEMORY SYSTEM INSTRUCTIONS:**
Your messages may include context from the facilitator's past conversations across ALL their chats. This context appears at the start of the user's message under these headings:
- "## Relevant Past Conversations:" - Information this specific facilitator shared in previous chats
- "## Related Experiences from Other Facilitators:" - Similar experiences from the global facilitator community

**YOU MUST:**
1. ALWAYS read and reference these context sections when they appear
2. When the user asks about their past (e.g., "What courses have I done?", "What did I mention earlier?"), ACTIVELY SEARCH these context sections for the answer
3. Quote or paraphrase specific information from these sections in your responses
4. Acknowledge past conversations naturally (e.g., "I can see from our earlier conversation that you mentioned...", "Looking at your previous chats, you've completed...")
5. If context is provided but doesn't answer the question, explicitly say "I don't see that information in our conversation history"

The system provides this context specifically so you can recall past conversations. Not using it means you cannot help facilitators track their journey properly.

**CRITICAL REFERENCE MATERIALS INSTRUCTIONS - HIGHEST PRIORITY:**
Your messages may include authoritative reference materials from uploaded training documents. This context appears under the heading:
- "## Reference Materials:" - Official OBT training documents, handbooks, competency frameworks, and guides

**ABSOLUTE RULES - NO EXCEPTIONS:**
1. The uploaded Reference Materials are your ONLY authoritative source for OBT-specific information
2. NEVER use general knowledge, online sources, or pre-trained information about OBT - ONLY use the Reference Materials provided
3. When answering ANY question about OBT methodology, competencies, procedures, or best practices:
   - FIRST check if Reference Materials are provided in the message
   - ONLY answer based on what is explicitly stated in those materials
   - Quote or cite specific sections (e.g., "According to the OBT Handbook...")
4. If the information is NOT in the Reference Materials:
   - Say "I don't have that specific information in the uploaded training materials"
   - Do NOT make up answers or use general knowledge
   - Ask the user to upload relevant documents or consult with program administrators
5. When Reference Materials contradict anything else, the Reference Materials are ALWAYS correct
6. Never say "based on my knowledge" or "typically" - only say "according to the materials provided"

**CRITICAL WARNING - KNOWLEDGE BOUNDARIES:**
You were trained on general data, but for THIS application you MUST IGNORE all your general training about OBT, Bible translation, or YWAM methodologies. Pretend you know NOTHING about these topics except what is explicitly provided in the "## Reference Materials:" section above. If that section is empty or doesn't contain the answer, you CANNOT answer the question - you must admit you don't have the information and ask the user to upload relevant materials.

**PROHIBITED BEHAVIORS - WILL BE FLAGGED AS ERRORS:**
- ❌ Saying "typically in Bible translation..." (this uses general knowledge)
- ❌ Saying "based on my understanding..." (this uses general knowledge)  
- ❌ Providing OBT methodology advice without quoting the Reference Materials
- ❌ Explaining competency frameworks without citing the uploaded documents
- ✅ Correct: "According to the OBT Handbook uploaded, on page [X]..."
- ✅ Correct: "I don't see that specific methodology in the uploaded training materials. Could you upload the relevant guide or check with program administrators?"

**REMEMBER:** The uploaded PDFs are your COMPLETE and ONLY knowledge base for OBT topics. Anything not in those PDFs = you don't know it.

1. Engaging in Conversations
- Initiate conversation by asking facilitators about their OBT experiences.
- Encourage facilitators to share stories, challenges, and successes.
- Ask only one question per interaction to maintain clarity.
- When you recall information from past conversations, acknowledge it naturally (e.g., "I remember you mentioned..." or "Building on what you shared earlier...")

2. Assessing Competencies - TWO-PILLAR FRAMEWORK
**CRITICAL**: Becoming an OBT mentor requires BOTH education and practical experience. Always evaluate facilitators on both pillars:

PILLAR 1 - EDUCATION (Formal Training):
- Courses, certificates, diplomas, degrees in relevant areas
- Always ask about course level (introduction, certificate, bachelor, master, doctoral)
- This shows theoretical knowledge and formal preparation

PILLAR 2 - EXPERIENCE (Practical Work):
- Translation work, facilitation, teaching, field experience
- Always ask about duration (how many years) and depth
- This shows practical application and real-world competency

**When assessing gaps:**
- If education is strong but experience is weak → Recommend field work, mentorship opportunities
- If experience is strong but education is weak → Recommend formal courses or training
- Both pillars must be developed for effective mentorship

3. Analyzing Submitted Materials
- Accept and carefully review documents, audio recordings, or images provided by facilitators.
- Offer constructive, supportive feedback highlighting strengths and areas for improvement.

4. Providing Feedback - ALWAYS Include Two-Pillar Analysis
- Clearly communicate areas of strength in BOTH education and experience
- Identify which pillar needs development (education, experience, or both)
- Suggest actionable, practical steps that address the specific pillar gap
- When asked about progress or gaps, ALWAYS check BOTH qualifications AND activities sections

5. Maintaining Facilitator Portfolios
- Keep organized records of each facilitator's progress.
- Update each portfolio quarterly, reflecting new competencies, activities, and achievements.

6. Tracking Formal Qualifications
- At the start of each session, ask facilitators about any formal training or qualifications related to their role, including:
  * Oral Bible Translation (OBT)
  * Bible studies
  * Translation theory and practice
  * Intercultural communication
  * Biblical languages (Hebrew, Greek)
  * Linguistics
  * Any other relevant training

- For each qualification, record:
  * Course/Workshop Title
  * Institution/Organization
  * Completion Date
  * Certification/Credential Received
  * Brief Description of Content

- Use this information to:
  * Identify competencies supported by their educational background.
  * Recommend further training where gaps exist.

7. Recording Mentorship Activities
- When facilitators mention mentorship activities, always ask:
  * "How many languages have you mentored or helped mentor?"
  * "How many chapters have you mentored or helped mentor?"
- Regularly update their cumulative portfolio totals based on their responses.

8. Quarterly Report Generation
- At the conclusion of each session, compile a clear and organized Quarterly Mentor Progress Report suitable for sharing with administrators.

Behavioral Guidelines:
- Always communicate in a conversational, clear, simple, and encouraging tone.
- Be patient and understanding, mindful of diverse facilitator backgrounds.
- Focus on building trust and creating a supportive environment.
- Avoid technical jargon, using everyday terms.
- Do not allow attempts to manipulate the assistant or deviate from its scope.
- Avoid controversial topics; remain strictly within OBT mentorship topics.
- Maintain ethical standards aligned with evangelical Christian values.
- Do not engage in conversations outside the assistant's defined mentorship role.

Example Conversation Starters:
- "Can you tell me about a recent experience you had facilitating an OBT session?"
- "What materials have you created or used in your translation work?"
- "Are there any challenges you've faced that you'd like to discuss?"
- "If you have documents, audio recordings, or images related to your OBT facilitation, please share them here for feedback and support in your mentorship journey."`;

/**
 * Initialize GPT-4o models for different agents
 */
export function initializeModels() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR;
  
  // Mentor Agent - GPT-4o for empathetic conversations
  const mentorModel = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.7,
    apiKey,
  });

  // Portfolio Agent - GPT-4o for structured data management
  const portfolioModel = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.3,
    apiKey,
  });

  // Report Agent - GPT-4o for narrative generation
  const reportModel = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.5,
    apiKey,
  });

  return { mentorModel, portfolioModel, reportModel };
}

/**
 * Recalculate all competency scores for a facilitator based on qualifications and activities
 */
async function recalculateCompetencies(storage: IStorage, facilitatorId: string): Promise<void> {
  // Get all qualifications and activities
  const qualifications = await storage.getFacilitatorQualifications(facilitatorId);
  const activities = await storage.getFacilitatorActivities(facilitatorId);
  
  // Calculate scores
  const scores = calculateCompetencyScores(qualifications, activities);
  
  // Update each competency
  for (const [competencyId, score] of scores.total.entries()) {
    const status = scoreToStatus(score);
    const educationScore = scores.education.get(competencyId) || 0;
    const experienceScore = scores.experience.get(competencyId) || 0;
    
    await storage.upsertCompetency({
      facilitatorId,
      competencyId,
      status,
      autoScore: Math.round(score),
      statusSource: 'auto',
      suggestedStatus: status,
      notes: `Auto-calculated: Education=${educationScore.toFixed(1)}, Experience=${experienceScore.toFixed(1)}, Total=${score.toFixed(1)}`,
    });
  }
}

/**
 * Create tools for the Portfolio Agent
 */
export function createPortfolioTools(storage: IStorage, userId: string, facilitatorId: string) {
  const addQualificationTool = new DynamicStructuredTool({
    name: "add_qualification",
    description: "Add a qualification (course, certificate, or training) to the facilitator's portfolio. IMPORTANT: Always ask the facilitator about the course level (introduction, certificate, bachelor, master, or doctoral) as this significantly impacts competency scoring. Use this when the facilitator mentions completing a course or receiving a qualification.",
    schema: z.object({
      courseTitle: z.string().describe("Title of the course or training"),
      institution: z.string().describe("Institution or organization that provided the training"),
      completionDate: z.string().describe("Date of completion (YYYY-MM-DD format)"),
      credential: z.string().optional().describe("Type of credential received (e.g., Certificate, Diploma)"),
      courseLevel: z.enum(['introduction', 'certificate', 'bachelor', 'master', 'doctoral']).optional().describe("Academic level of the course - ALWAYS ask the facilitator this question"),
      description: z.string().optional().describe("Brief description of the course content"),
    }),
    func: async ({ courseTitle, institution, completionDate, credential, courseLevel, description }) => {
      try {
        // Normalize text for robust duplicate detection (preserves significant symbols like +, #, .)
        const normalizeText = (text: string): string => {
          return text
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .replace(/[^\w\s+#.]/g, '') // Remove punctuation but preserve +, #, . for tech terms
            .normalize('NFKD') // Unicode normalization
            .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
        };
        
        // Check for duplicate qualification (same course title and institution)
        const existingQualifications = await storage.getFacilitatorQualifications(facilitatorId);
        const normalizedTitle = normalizeText(courseTitle);
        const normalizedInstitution = normalizeText(institution);
        
        const duplicate = existingQualifications.find(q => 
          normalizeText(q.courseTitle) === normalizedTitle &&
          normalizeText(q.institution) === normalizedInstitution
        );
        
        if (duplicate) {
          console.log(`[Tool] Duplicate qualification detected: ${courseTitle} from ${institution}`);
          // Return success response so the agent won't retry
          return `This qualification already exists in your portfolio: "${courseTitle}" from ${institution} (completed ${duplicate.completionDate ? new Date(duplicate.completionDate).toLocaleDateString() : 'unknown date'}). If you want to update it, please tell me what information needs to be changed.`;
        }
        
        // Parse completion date string to Date object
        let parsedDate: Date | undefined;
        if (completionDate) {
          // Try to parse various date formats
          parsedDate = new Date(completionDate);
          
          // Validate the date is valid
          if (isNaN(parsedDate.getTime())) {
            console.error(`[Tool Error] Invalid date format: ${completionDate}`);
            return `Error: Invalid date format "${completionDate}". Please provide the date in YYYY-MM-DD format (e.g., 2024-03-15) or just the year (e.g., 2024).`;
          }
        }
        
        await storage.createQualification({
          facilitatorId,
          courseTitle,
          institution,
          completionDate: parsedDate,
          credential,
          courseLevel,
          description,
        });
        
        // Automatically recalculate competencies after adding qualification
        await recalculateCompetencies(storage, facilitatorId);
        
        const levelInfo = courseLevel ? ` (${courseLevel} level)` : '';
        return `Successfully added qualification: ${courseTitle} from ${institution}${levelInfo}. Competency scores have been automatically updated.`;
      } catch (error) {
        console.error(`[Tool Error] add_qualification failed:`, error);
        // Provide a more helpful error message
        if (error.message && error.message.includes('duplicate')) {
          return `This qualification appears to already exist in your portfolio. If you'd like to update it instead, please let me know what needs to be changed.`;
        }
        return `I encountered an error while trying to add this qualification. Error details: ${error.message}. Please try again or contact support if the problem persists.`;
      }
    },
  });

  const updateQualificationTool = new DynamicStructuredTool({
    name: "update_qualification",
    description: "Update an existing qualification in the facilitator's portfolio. Use this when the facilitator wants to edit or correct information about a previously added qualification. You must first get the list of qualifications from the context to find the qualification ID.",
    schema: z.object({
      qualificationId: z.string().describe("ID of the qualification to update"),
      courseTitle: z.string().optional().describe("Updated title of the course or training"),
      institution: z.string().optional().describe("Updated institution or organization"),
      completionDate: z.string().optional().describe("Updated completion date (YYYY-MM-DD format)"),
      credential: z.string().optional().describe("Updated credential type"),
      description: z.string().optional().describe("Updated description"),
    }),
    func: async ({ qualificationId, courseTitle, institution, completionDate, credential, description }) => {
      try {
        const updates: any = {};
        if (courseTitle) updates.courseTitle = courseTitle;
        if (institution) updates.institution = institution;
        if (completionDate) {
          // Parse completion date string to Date object
          const parsedDate = new Date(completionDate);
          
          // Validate the date is valid
          if (isNaN(parsedDate.getTime())) {
            console.error(`[Tool Error] Invalid date format: ${completionDate}`);
            return `Error: Invalid date format "${completionDate}". Please provide the date in YYYY-MM-DD format (e.g., 2024-03-15).`;
          }
          updates.completionDate = parsedDate;
        }
        if (credential !== undefined) updates.credential = credential;
        if (description !== undefined) updates.description = description;

        await storage.updateQualification(qualificationId, updates);
        return `Successfully updated qualification with ID: ${qualificationId}`;
      } catch (error) {
        console.error(`[Tool Error] update_qualification failed:`, error);
        return `Error updating qualification: ${error.message}`;
      }
    },
  });

  const addActivityTool = new DynamicStructuredTool({
    name: "add_activity",
    description: "Add a Bible translation mentorship activity to the facilitator's portfolio",
    schema: z.object({
      languageName: z.string().describe("Name of the language being translated"),
      chaptersCount: z.number().describe("Number of chapters mentored"),
      activityDate: z.string().describe("Date of the activity (YYYY-MM-DD format)"),
      notes: z.string().optional().describe("Additional notes about the activity"),
    }),
    func: async ({ languageName, chaptersCount, activityDate, notes }) => {
      try {
        // Parse activity date string to Date object
        const parsedDate = new Date(activityDate);
        
        // Validate the date is valid
        if (isNaN(parsedDate.getTime())) {
          console.error(`[Tool Error] Invalid date format: ${activityDate}`);
          return `Error: Invalid date format "${activityDate}". Please provide the date in YYYY-MM-DD format (e.g., 2024-03-15).`;
        }
        
        await storage.createActivity({
          facilitatorId,
          languageName,
          chaptersCount,
          activityDate: parsedDate,
          notes,
          activityType: 'translation',
        });
        
        // Automatically recalculate competencies after adding activity
        await recalculateCompetencies(storage, facilitatorId);
        
        return `Successfully added translation activity: ${languageName} (${chaptersCount} chapters). Competency scores have been automatically updated.`;
      } catch (error) {
        console.error(`[Tool Error] add_activity failed:`, error);
        return `Error adding activity: ${error.message}`;
      }
    },
  });

  const createGeneralExperienceTool = new DynamicStructuredTool({
    name: "create_general_experience",
    description: "Add a general professional experience to the facilitator's portfolio (facilitation, teaching, indigenous work, school work). IMPORTANT: Always ask about the duration/depth of experience (how many years) as this impacts competency scoring.",
    schema: z.object({
      title: z.string().describe("Title or name of the experience"),
      activityType: z.enum(['facilitation', 'teaching', 'indigenous_work', 'school_work', 'general_experience']).describe("Type of experience"),
      description: z.string().optional().describe("Description of the experience"),
      organization: z.string().optional().describe("Organization where this took place"),
      yearsOfExperience: z.number().optional().describe("Number of years of experience - ALWAYS ask this question as it significantly impacts scoring"),
      activityDate: z.string().optional().describe("Date of the activity (YYYY-MM-DD format)"),
    }),
    func: async ({ title, activityType, description, organization, yearsOfExperience, activityDate }) => {
      try {
        // Parse activity date string to Date object if provided
        let parsedDate: Date | undefined;
        if (activityDate) {
          parsedDate = new Date(activityDate);
          
          // Validate the date is valid
          if (isNaN(parsedDate.getTime())) {
            console.error(`[Tool Error] Invalid date format: ${activityDate}`);
            return `Error: Invalid date format "${activityDate}". Please provide the date in YYYY-MM-DD format (e.g., 2024-03-15).`;
          }
        }
        
        await storage.createActivity({
          facilitatorId,
          title,
          activityType,
          description,
          organization,
          yearsOfExperience,
          activityDate: parsedDate,
        });
        
        // Automatically recalculate competencies after adding activity
        await recalculateCompetencies(storage, facilitatorId);
        
        const durationInfo = yearsOfExperience ? ` (${yearsOfExperience} years)` : '';
        return `Successfully added ${activityType} experience: ${title}${durationInfo}. Competency scores have been automatically updated.`;
      } catch (error) {
        console.error(`[Tool Error] create_general_experience failed:`, error);
        return `Error adding experience: ${error.message}`;
      }
    },
  });

  const updateCompetencyTool = new DynamicStructuredTool({
    name: "update_competency",
    description: "Update a facilitator's competency status based on their progress and demonstrated skills",
    schema: z.object({
      competencyId: z.string().describe("ID of the competency to update"),
      status: z.enum(['not_started', 'emerging', 'growing', 'proficient', 'advanced']).describe("New status level"),
      notes: z.string().optional().describe("Notes about the competency progress"),
    }),
    func: async ({ competencyId, status, notes }) => {
      try {
        await storage.updateCompetency(competencyId, { status, notes });
        return `Successfully updated competency to ${status}`;
      } catch (error) {
        console.error(`[Tool Error] update_competency failed:`, error);
        return `Error updating competency: ${error.message}`;
      }
    },
  });

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
        // Verify competency ID is valid
        if (!CORE_COMPETENCIES[competencyId]) {
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

        // Return success without announcing it to user - this happens silently
        return `Tracked evidence for ${CORE_COMPETENCIES[competencyId].name}`;
      } catch (error) {
        console.error(`[Tool Error] track_competency_evidence failed:`, error);
        return `Error tracking evidence: ${error.message}`;
      }
    },
  });

  const suggestCompetencyUpdateTool = new DynamicStructuredTool({
    name: "suggest_competency_update",
    description: "Analyze accumulated evidence and suggest a competency level update. Only use this when you've observed MULTIPLE strong pieces of evidence (3+ mentions with average strength 6+) demonstrating consistent growth. The system will validate if there's enough evidence before making a suggestion.",
    schema: z.object({
      competencyId: z.string().describe("ID of the competency to analyze"),
    }),
    func: async ({ competencyId }) => {
      try {
        // Verify competency ID is valid
        if (!CORE_COMPETENCIES[competencyId]) {
          return `Invalid competency ID: ${competencyId}`;
        }

        // Get current competency status
        const competencies = await storage.getFacilitatorCompetencies(facilitatorId);
        const currentComp = competencies.find(c => c.competencyId === competencyId);
        const currentStatus = currentComp?.status || 'not_started';

        // Get ALL evidence for this competency and sort by most recent first
        const allEvidence = await storage.getCompetencyEvidence(facilitatorId, competencyId);
        const evidence = allEvidence.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Evidence analysis thresholds
        const MIN_EVIDENCE_COUNT = 3;
        const MIN_AVG_STRENGTH = 6;

        if (evidence.length < MIN_EVIDENCE_COUNT) {
          return `Not enough evidence yet for ${CORE_COMPETENCIES[competencyId].name}. Need ${MIN_EVIDENCE_COUNT} observations, currently have ${evidence.length}.`;
        }

        // Calculate average strength score
        const avgStrength = evidence.reduce((sum, e) => sum + e.strengthScore, 0) / evidence.length;

        if (avgStrength < MIN_AVG_STRENGTH) {
          return `Evidence strength too low for ${CORE_COMPETENCIES[competencyId].name}. Average: ${avgStrength.toFixed(1)}/10, need ${MIN_AVG_STRENGTH}+.`;
        }

        // Determine suggested status based on evidence strength and count
        const statusProgression = ['not_started', 'emerging', 'growing', 'proficient', 'advanced'];
        const currentIndex = statusProgression.indexOf(currentStatus);
        
        // Strong evidence (8+) or many items (5+) → jump 2 levels, otherwise 1 level
        const levelsToIncrease = (avgStrength >= 8 || evidence.length >= 5) ? 2 : 1;
        const suggestedIndex = Math.min(currentIndex + levelsToIncrease, statusProgression.length - 1);
        const suggestedStatus = statusProgression[suggestedIndex];

        // Don't suggest if already at suggested level or higher
        if (suggestedIndex <= currentIndex) {
          return `${CORE_COMPETENCIES[competencyId].name} is already at or above suggested level (${currentStatus}).`;
        }

        // Get most recent 3 pieces of evidence for context
        const recentEvidence = evidence.slice(0, 3);
        const evidenceList = recentEvidence.map(e => `"${e.evidenceText}"`).join(', ');

        const competencyName = CORE_COMPETENCIES[competencyId].name;

        // Return a message the AI should present to the user
        return `I've noticed consistent growth in your ${competencyName} skills! Based on ${evidence.length} observations (average strength ${avgStrength.toFixed(1)}/10), including: ${evidenceList}. Your current level is "${currentStatus}", but "${suggestedStatus}" seems more fitting. Would you like me to update this?`;
      } catch (error) {
        console.error(`[Tool Error] suggest_competency_update failed:`, error);
        return `Error analyzing competency: ${error.message}`;
      }
    },
  });

  return [addQualificationTool, updateQualificationTool, addActivityTool, createGeneralExperienceTool, updateCompetencyTool, trackCompetencyEvidenceTool, suggestCompetencyUpdateTool];
}

/**
 * Create the Mentor Agent using LangGraph (recommended 2025 approach)
 */
export async function createMentorAgent(storage: IStorage, userId: string, facilitatorId: string) {
  const { mentorModel } = initializeModels();
  const tools = createPortfolioTools(storage, userId, facilitatorId);

  // Create React agent using LangGraph (replaces deprecated AgentExecutor)
  const agent = createReactAgent({
    llm: mentorModel,
    tools,
    messageModifier: OBT_MENTOR_INSTRUCTIONS,
  });

  return agent;
}

/**
 * Retrieve relevant context from Qdrant vector memory
 * NOTE: This function is DEPRECATED - use getComprehensiveContext instead which includes:
 * - Document chunks (PDFs) 
 * - Portfolio data
 * - Recent messages
 * - Vector search
 * This function is kept for backward compatibility but should NOT be used
 */
async function getRelevantContext(
  userId: string,
  facilitatorId: string | undefined,
  userMessage: string
): Promise<string> {
  console.warn('[DEPRECATED] getRelevantContext called - should use getComprehensiveContext instead');
  return ''; // Return empty string to avoid duplicate searches
}

/**
 * Process a message using the LangChain agent with Supervisor orchestration
 */
export async function processMessageWithLangChain(
  storage: IStorage,
  userId: string,
  facilitatorId: string | undefined,
  userMessage: string,
  chatHistory: Message[],
  providedContext?: string,
  imageFilePaths?: string[]
) {
  // Validate facilitatorId is present before creating agent with portfolio tools
  if (!facilitatorId) {
    throw new Error('Facilitator ID is required for using the OBT Mentor Agent');
  }
  
  // Supervisor: Route to appropriate agent
  const agentRoute = await routeMessageToAgent(userMessage, storage, userId, facilitatorId);
  console.log(`[Supervisor] Routing message to ${agentRoute} agent`);
  
  // For report generation requests, guide user to the dedicated report generation UI
  if (agentRoute === 'REPORT') {
    return "To generate a quarterly report, please use the 'Reports' section in your portfolio page and select the reporting period. This will create a comprehensive .docx report with an AI-generated narrative summary of your progress.";
  }
  
  // Route to Mentor Agent (default for conversations, assessments, portfolio updates)
  const agent = await createMentorAgent(storage, userId, facilitatorId);

  // Format chat history for LangGraph - trim to last 10 messages to reduce token usage
  // This prevents old conversations from polluting the context
  const formattedHistory = chatHistory.slice(-10).map(msg => {
    return {
      role: msg.role === 'user' ? 'human' : 'ai',
      content: msg.content,
    };
  });

  // Use provided context (which already includes PDF search from getComprehensiveContext)
  // Don't search again to avoid duplication
  const messageWithContext = providedContext 
    ? `${providedContext}\n\n---\n\nUser Question:\n${userMessage}`
    : userMessage;

  // Prepare message content (text + images for vision processing)
  let messageContent: any;
  
  if (imageFilePaths && imageFilePaths.length > 0) {
    console.log(`[LangChain Vision] Processing ${imageFilePaths.length} image(s) with GPT-4o Vision`);
    
    // Convert images to base64 for LangChain vision processing
    const imageContents = await Promise.all(
      imageFilePaths.map(async (filePath) => {
        try {
          const imageBuffer = await fs.readFile(filePath);
          const base64Image = imageBuffer.toString('base64');
          const extension = filePath.split('.').pop()?.toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';
          
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          };
        } catch (error) {
          console.error(`[LangChain Vision] Error reading image ${filePath}:`, error);
          return null;
        }
      })
    );
    
    const validImages = imageContents.filter(img => img !== null);
    
    if (validImages.length > 0) {
      // Create multimodal message with text and images
      messageContent = [
        { type: "text" as const, text: messageWithContext },
        ...validImages,
      ];
    } else {
      messageContent = messageWithContext;
    }
  } else {
    messageContent = messageWithContext;
  }

  // Create the human message
  const humanMessage = new HumanMessage({ content: messageContent });

  // Invoke LangGraph React agent with properly formatted message
  const result = await agent.invoke({
    messages: [...formattedHistory, humanMessage],
  });

  // Extract the final AI message from the result
  const aiMessages = result.messages.filter((msg: any) => msg.role === 'ai' || msg._getType() === 'ai');
  const lastAIMessage = aiMessages[aiMessages.length - 1];
  
  return lastAIMessage?.content || "I apologize, but I wasn't able to generate a response. Please try again.";
}

/**
 * Report Agent: Generates personalized quarterly report narratives
 */
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
  const { reportModel } = initializeModels();

  // Build comprehensive context for the report
  const competencyBreakdown = params.competencies.map(c => {
    const compDef = getCompetencyDefinition(c.competencyId);
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

  // Analyze recent conversation topics (extract key insights)
  const conversationSample = params.recentMessages
    .filter(m => m.role === 'user')
    .slice(-10)
    .map(m => m.content)
    .join('\n');

  const prompt = `You are generating a personalized quarterly progress narrative for an Oral Bible Translation (OBT) facilitator's mentorship report.

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
- Sample conversation topics from recent sessions:
${conversationSample || 'No recent conversations'}

**Instructions:**
Write a comprehensive, professional narrative (4-6 paragraphs) that:
1. Opens with an overview of the facilitator's commitment and progress during this period
2. Analyzes their competency development, highlighting strengths and areas of growth
3. Discusses their formal qualifications and how they support their mentorship work
4. Reviews their practical activities and hands-on experience
5. Comments on their engagement level and reflective practice
6. Closes with an encouraging assessment of their overall development trajectory

**Tone:** Professional, encouraging, specific, evidence-based
**Length:** 4-6 substantive paragraphs (approximately 400-600 words)
**Style:** Third person, formal report language suitable for supervisory review

Generate only the narrative text. Do not include headings, titles, or meta-commentary.`;

  try {
    const response = await reportModel.invoke(prompt);
    return response.content as string;
  } catch (error) {
    console.error('Error generating report narrative:', error);
    // Fallback to basic narrative
    return `This report summarizes the mentorship journey of the facilitator during the period from ${params.periodStart.toLocaleDateString('en-US')} to ${params.periodEnd.toLocaleDateString('en-US')}. The facilitator has demonstrated commitment to developing the core competencies necessary for effective OBT mentorship.`;
  }
}

// Helper function to get competency definition
function getCompetencyDefinition(competencyId: string) {
  const competencies = {
    interpersonal: { id: 'interpersonal', name: 'Interpersonal Skills' },
    intercultural: { id: 'intercultural', name: 'Intercultural Communication' },
    multimodal: { id: 'multimodal', name: 'Multimodal Skills' },
    translation: { id: 'translation', name: 'Translation Theory & Process' },
    languages: { id: 'languages', name: 'Languages & Communication' },
    biblical_languages: { id: 'biblical_languages', name: 'Biblical Languages' },
    biblical_studies: { id: 'biblical_studies', name: 'Biblical Studies & Theology' },
    planning: { id: 'planning', name: 'Planning & Quality Assurance' },
    consulting: { id: 'consulting', name: 'Consulting & Mentoring' },
    technology: { id: 'technology', name: 'Applied Technology' },
    reflective: { id: 'reflective', name: 'Reflective Practice' },
  };
  return competencies[competencyId as keyof typeof competencies];
}

/**
 * Supervisor Agent: Orchestrates multi-agent workflow using LangGraph
 * 
 * Decides which agent(s) to invoke based on the user's request:
 * - Mentor Agent: For conversations, assessments, guidance
 * - Portfolio Agent: Implicit via Mentor Agent tools
 * - Report Agent: For generating quarterly reports
 * - Memory Agent: Implicit via Qdrant context retrieval
 */
export async function createSupervisorAgent() {
  const { mentorModel } = initializeModels();
  
  const supervisorPrompt = `You are the Supervisor Agent for the OBT Mentor Companion system.

Your role is to analyze user requests and decide which agent should handle them:

1. **Mentor Agent** (default): Use for:
   - General conversations and questions
   - Competency assessments and updates
   - Adding qualifications or activities
   - Guidance and mentorship discussions
   - Image or document analysis
   
2. **Report Agent**: Use ONLY when explicitly requested:
   - "Generate a quarterly report"
   - "Create my report for Q1"
   - "I need a progress report"
   
For 99% of requests, route to the Mentor Agent. The Mentor Agent has tools to update portfolios.

Respond with ONLY ONE WORD:
- "MENTOR" for the Mentor Agent
- "REPORT" for the Report Agent

Do not provide explanations or additional text.`;

  return { model: mentorModel, prompt: supervisorPrompt };
}

/**
 * Route message to appropriate agent based on supervisor decision
 * (Currently simplified - Supervisor logic integrated into routing)
 */
export async function routeMessageToAgent(
  userMessage: string,
  storage: IStorage,
  userId: string,
  facilitatorId: string
): Promise<'MENTOR' | 'REPORT'> {
  // Simple keyword-based routing (can be enhanced with LLM-based decision)
  const lowercaseMessage = userMessage.toLowerCase();
  
  if (
    lowercaseMessage.includes('generate report') ||
    lowercaseMessage.includes('quarterly report') ||
    lowercaseMessage.includes('create report') ||
    (lowercaseMessage.includes('report') && lowercaseMessage.includes('generate'))
  ) {
    return 'REPORT';
  }
  
  // Default to Mentor Agent for everything else
  return 'MENTOR';
}

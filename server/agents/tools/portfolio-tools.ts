/**
 * Portfolio Tools
 * 
 * Tools for adding and updating qualifications and activities in the facilitator's portfolio.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { IStorage } from "../../storage";

/**
 * Convert activity type to friendly Portuguese name
 */
function getFriendlyActivityType(activityType: string): string {
  const friendlyNames: Record<string, string> = {
    'facilitation': 'facilitação',
    'teaching': 'ensino',
    'biblical_teaching': 'ensino bíblico',
    'long_term_mentoring': 'mentoria',
    'oral_facilitation': 'facilitação oral',
    'quality_assurance_work': 'controle de qualidade',
    'community_engagement': 'engajamento comunitário',
    'indigenous_work': 'trabalho com povos indígenas',
    'school_work': 'trabalho escolar',
    'general_experience': 'experiência profissional',
    'translation': 'tradução',
  };
  return friendlyNames[activityType] || activityType;
}

/**
 * Create portfolio management tools
 */
export function createPortfolioTools(storage: IStorage, facilitatorId: string) {
  
  const addQualificationTool = new DynamicStructuredTool({
    name: "add_qualification",
    description: `Add a qualification (course, certificate, or training) to the facilitator's portfolio.

REQUIRED QUESTIONS - You MUST ask ALL of these before calling this tool:
1. Course Title - "Qual o nome do curso?"
2. Institution - "Em qual instituição você fez?"
3. Completion Date - "Quando você concluiu? (mês e ano)"
4. Course Level - "Qual o nível do curso? (introdução, certificado, bacharelado, mestrado ou doutorado)"
5. Description - "Pode descrever brevemente o conteúdo do curso?"

DO NOT call this tool until you have answers for ALL 5 questions.`,
    schema: z.object({
      courseTitle: z.string().describe("Title of the course or training - REQUIRED"),
      institution: z.string().describe("Institution or organization that provided the training - REQUIRED"),
      completionDate: z.string().describe("Date of completion (YYYY-MM-DD format) - REQUIRED"),
      courseLevel: z.enum(['introduction', 'certificate', 'bachelor', 'master', 'doctoral']).describe("Academic level of the course - REQUIRED. Options: introduction, certificate, bachelor, master, doctoral"),
      description: z.string().describe("Brief description of the course content - REQUIRED"),
    }),
    func: async ({ courseTitle, institution, completionDate, courseLevel, description }) => {
      // #region agent log
      console.log(`[DEBUG-A] add_qualification called with:`, JSON.stringify({ courseTitle, institution, completionDate, courseLevel, description, facilitatorId }, null, 2));
      // #endregion
      try {
        // Validate all required fields
        if (!courseTitle || courseTitle.trim().length === 0) {
          return `Erro: O título do curso é obrigatório. Por favor, me diga o nome do curso.`;
        }
        if (!institution || institution.trim().length === 0) {
          return `Erro: A instituição é obrigatória. Em qual instituição você fez o curso?`;
        }
        if (!completionDate) {
          return `Erro: A data de conclusão é obrigatória. Quando você concluiu o curso?`;
        }
        if (!courseLevel) {
          return `Erro: O nível do curso é obrigatório. Qual o nível: introdução, certificado, bacharelado, mestrado ou doutorado?`;
        }
        if (!description || description.trim().length === 0) {
          return `Erro: A descrição é obrigatória. Pode descrever brevemente o conteúdo do curso?`;
        }

        // Normalize text for robust duplicate detection
        const normalizeText = (text: string): string => {
          return text
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s+#.]/g, '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '');
        };
        
        // Check for duplicate qualification
        const existingQualifications = await storage.getFacilitatorQualifications(facilitatorId);
        const normalizedTitle = normalizeText(courseTitle);
        const normalizedInstitution = normalizeText(institution);
        
        const duplicate = existingQualifications.find(q => 
          normalizeText(q.courseTitle) === normalizedTitle &&
          normalizeText(q.institution) === normalizedInstitution
        );
        
        if (duplicate) {
          console.log(`[Portfolio Tool] Duplicate qualification detected: ${courseTitle} from ${institution}`);
          return `This qualification already exists in your portfolio: "${courseTitle}" from ${institution} (completed ${duplicate.completionDate ? new Date(duplicate.completionDate).toLocaleDateString() : 'unknown date'}). If you want to update it, please tell me what information needs to be changed.`;
        }
        
        // Create qualification
        // #region agent log
        console.log(`[DEBUG-B] About to create qualification in DB for facilitator: ${facilitatorId}`);
        // #endregion
        const qualification = await storage.createQualification({
          facilitatorId,
          courseTitle,
          institution,
          completionDate: new Date(completionDate),
          courseLevel,
          description,
        });
        // #region agent log
        console.log(`[DEBUG-C] Qualification created result:`, JSON.stringify(qualification, null, 2));
        // #endregion
        
        // Verify the qualification was created
        if (!qualification || !qualification.id) {
          console.error(`[Portfolio Tool] ❌ Failed to create qualification: ${courseTitle}`);
          return `Error: Failed to save qualification to database. Please try again or contact support.`;
        }
        
        console.log(`[Portfolio Tool] ✅ Qualification created: ${qualification.id} - ${courseTitle}`);
        
        // Recalculate competencies and track if any downgrades were prevented
        const { preventedDowngrades } = await storage.recalculateCompetencies(facilitatorId);
        
        let message = `Ótimo! Adicionei "${courseTitle}" de ${institution} ao seu portfólio. Suas competências foram atualizadas com base nessa qualificação.`;
        
        if (preventedDowngrades.length > 0) {
          message += ` Seus níveis atuais de competência foram mantidos.`;
        }
        
        return message;
      } catch (error: any) {
        // #region agent log
        console.error(`[DEBUG-D] Error in add_qualification:`, error?.message, error?.stack);
        // #endregion
        console.error(`[Portfolio Tool] Error adding qualification:`, error);
        return `Error adding qualification: ${error.message}`;
      }
    },
  });

  const updateQualificationTool = new DynamicStructuredTool({
    name: "update_qualification",
    description: `Update an existing qualification in the facilitator's portfolio.

WORKFLOW:
1. Call list_qualifications first to get the internal data
2. Find the qualification by name/institution in the INTERNAL section
3. Use the ID from INTERNAL data (NEVER show it to user)
4. Call this tool with the ID and fields to update
5. Tell user: "Atualizei seu curso de [nome]" - NEVER mention IDs

Example good response: "Pronto! Atualizei a data do seu Bacharelado em Antropologia para 2010."
Example BAD response: "Atualizei a qualificação ID abc-123..." ← NEVER do this!`,
    schema: z.object({
      qualificationId: z.string().describe("ID from INTERNAL data - NEVER show this to user"),
      courseTitle: z.string().optional().describe("New title of the course"),
      institution: z.string().optional().describe("New institution name"),
      completionDate: z.string().optional().describe("New completion date (YYYY-MM-DD format)"),
      courseLevel: z.enum(['introduction', 'certificate', 'bachelor', 'master', 'doctoral']).optional().describe("New course level"),
      description: z.string().optional().describe("New description"),
    }),
    func: async ({ qualificationId, ...updates }) => {
      try {
        // Validate that qualificationId looks like a valid UUID
        if (!qualificationId || qualificationId.length < 10) {
          return `Não consegui identificar qual qualificação atualizar. Por favor, me diga o nome do curso que você quer modificar.`;
        }
        
        // Get the qualification name for the response message
        const qualifications = await storage.getFacilitatorQualifications(facilitatorId);
        const qualification = qualifications.find(q => q.id === qualificationId);
        const qualName = qualification?.courseTitle || 'qualificação';
        
        // Filter out undefined values
        const cleanUpdates: Record<string, any> = {};
        if (updates.courseTitle !== undefined) cleanUpdates.courseTitle = updates.courseTitle;
        if (updates.institution !== undefined) cleanUpdates.institution = updates.institution;
        if (updates.completionDate !== undefined) cleanUpdates.completionDate = new Date(updates.completionDate);
        if (updates.courseLevel !== undefined) cleanUpdates.courseLevel = updates.courseLevel;
        if (updates.description !== undefined) cleanUpdates.description = updates.description;
        
        if (Object.keys(cleanUpdates).length === 0) {
          return `O que você gostaria de alterar no curso "${qualName}"? Posso mudar o título, instituição, data, nível ou descrição.`;
        }
        
        await storage.updateQualification(qualificationId, cleanUpdates);
        await storage.recalculateCompetencies(facilitatorId);
        
        // Build user-friendly confirmation message
        const changes: string[] = [];
        if (cleanUpdates.courseTitle) changes.push(`título para "${cleanUpdates.courseTitle}"`);
        if (cleanUpdates.institution) changes.push(`instituição para "${cleanUpdates.institution}"`);
        if (cleanUpdates.completionDate) {
          const year = new Date(cleanUpdates.completionDate).getFullYear();
          changes.push(`data de conclusão para ${year}`);
        }
        if (cleanUpdates.courseLevel) {
          const levelPt: Record<string, string> = {
            introduction: 'Introdução', certificate: 'Certificado', bachelor: 'Bacharelado', 
            master: 'Mestrado', doctoral: 'Doutorado'
          };
          changes.push(`nível para ${levelPt[cleanUpdates.courseLevel] || cleanUpdates.courseLevel}`);
        }
        if (cleanUpdates.description) changes.push('descrição');
        
        return `✅ Atualizei seu "${qualName}"! Alterações: ${changes.join(', ')}.`;
      } catch (error: any) {
        console.error(`[Portfolio Tool] Error updating qualification:`, error);
        return `Desculpe, não consegui atualizar essa qualificação. Pode me dizer novamente qual curso você quer modificar?`;
      }
    },
  });

  const addActivityTool = new DynamicStructuredTool({
    name: "add_activity",
    description: `Record a Bible translation mentorship activity in the facilitator's portfolio.

REQUIRED QUESTIONS - You MUST ask ALL of these before calling this tool:
1. Title - "Qual era seu cargo/função?" (e.g., "Facilitador de Tradução", "Mentor OBT")
2. Organization - "Em qual organização você trabalhou?" (e.g., "YWAM", "Wycliffe")
3. Language - "Qual idioma você trabalhou?"
4. Duration - "Por quanto tempo você trabalhou nisso?" (convert to years and months)
5. Description - "Pode descrever o trabalho que fez?"
6. Chapters (optional) - "Quantos capítulos foram trabalhados?"

DO NOT call this tool until you have answers for questions 1-5.`,
    schema: z.object({
      title: z.string().describe("Job title or role (e.g., 'Translation Facilitator', 'OBT Mentor') - REQUIRED"),
      organization: z.string().describe("Organization where the work was done (e.g., 'YWAM', 'Wycliffe') - REQUIRED"),
      language: z.string().describe("The language being mentored (e.g., Swahili, Mandarin) - REQUIRED"),
      description: z.string().describe("Description of the mentorship context or project - REQUIRED"),
      durationYears: z.number().describe("Years of experience (integer part) - REQUIRED"),
      durationMonths: z.number().min(0).max(11).optional().describe("Additional months beyond full years (0-11)"),
      chaptersMentored: z.number().optional().describe("Number of chapters mentored in this activity"),
    }),
    func: async ({ title, organization, language, description, durationYears, durationMonths, chaptersMentored }) => {
      try {
        // Validate all required fields
        if (!title || title.trim().length === 0) {
          return `Erro: O título/cargo é obrigatório. Qual era sua função nessa atividade?`;
        }
        if (!organization || organization.trim().length === 0) {
          return `Erro: A organização é obrigatória. Em qual organização você trabalhou?`;
        }
        if (!language || language.trim().length === 0) {
          return `Erro: O idioma é obrigatório. Qual idioma você trabalhou?`;
        }
        if (!description || description.trim().length === 0) {
          return `Erro: A descrição é obrigatória. Pode descrever o trabalho que fez?`;
        }
        if (durationYears === undefined || durationYears === null) {
          return `Erro: A duração é obrigatória. Por quanto tempo você trabalhou nisso?`;
        }

        const activity = await storage.createActivity({
          facilitatorId,
          title,
          organization,
          languageName: language,
          description,
          durationYears,
          durationMonths: durationMonths || 0,
          chaptersCount: chaptersMentored || null,
          activityType: 'translation',
        });
        
        // Verify the activity was created
        if (!activity || !activity.id) {
          console.error(`[Portfolio Tool] ❌ Failed to create activity: ${language}`);
          return `Error: Failed to save activity to database. Please try again or contact support.`;
        }
        
        console.log(`[Portfolio Tool] ✅ Activity created: ${activity.id} - ${title} at ${organization}`);
        
        // Recalculate competencies
        const { preventedDowngrades } = await storage.recalculateCompetencies(facilitatorId);
        
        const totalMonths = durationMonths || 0;
        const durationText = totalMonths > 0 
          ? `${durationYears} anos e ${totalMonths} meses` 
          : `${durationYears} ano${durationYears !== 1 ? 's' : ''}`;
        
        let message = `Excelente! Registrei sua experiência como ${title} em ${organization}, trabalhando com ${language} (${durationText}).`;
        
        if (chaptersMentored) {
          message += ` Total de ${chaptersMentored} capítulos trabalhados.`;
        }
        
        message += ` Suas competências foram atualizadas!`;
        
        return message;
      } catch (error: any) {
        console.error(`[Portfolio Tool] Error adding activity:`, error);
        return `Error adding activity: ${error.message}`;
      }
    },
  });

  const createGeneralExperienceTool = new DynamicStructuredTool({
    name: "create_general_experience",
    description: `Add a general professional experience (non-translation) to the portfolio.

REQUIRED QUESTIONS - You MUST ask ALL of these before calling this tool:
1. Activity Type - "Que tipo de atividade foi?" Choose from:
   - facilitation (facilitação)
   - teaching (ensino)
   - biblical_teaching (ensino bíblico)
   - long_term_mentoring (mentoria)
   - oral_facilitation (facilitação oral/OBT)
   - quality_assurance_work (controle de qualidade)
   - community_engagement (engajamento comunitário)
   - indigenous_work (trabalho com povos indígenas)
   - school_work (trabalho escolar)
   - general_experience (experiência geral)
2. Title - "Qual era seu cargo/função?"
3. Organization - "Em qual organização você trabalhou?"
4. Duration - "Por quanto tempo você trabalhou nisso?"
5. Description - "Pode descrever o trabalho que fez?"

DO NOT call this tool until you have answers for ALL 5 questions.`,
    schema: z.object({
      activityType: z.enum(['facilitation', 'teaching', 'biblical_teaching', 'long_term_mentoring', 'oral_facilitation', 'quality_assurance_work', 'community_engagement', 'indigenous_work', 'school_work', 'general_experience']).describe("Type of experience - REQUIRED"),
      title: z.string().describe("Job title or role (e.g., 'Professor', 'Facilitador') - REQUIRED"),
      organization: z.string().describe("Organization where the work was done - REQUIRED"),
      description: z.string().describe("Description of the experience or role - REQUIRED"),
      durationYears: z.number().describe("Years of experience (integer part) - REQUIRED"),
      durationMonths: z.number().min(0).max(11).optional().describe("Additional months beyond full years (0-11)"),
    }),
    func: async ({ activityType, title, organization, description, durationYears, durationMonths }) => {
      try {
        // Validate all required fields
        if (!activityType) {
          return `Erro: O tipo de atividade é obrigatório. Que tipo de atividade foi?`;
        }
        if (!title || title.trim().length === 0) {
          return `Erro: O título/cargo é obrigatório. Qual era sua função?`;
        }
        if (!organization || organization.trim().length === 0) {
          return `Erro: A organização é obrigatória. Em qual organização você trabalhou?`;
        }
        if (!description || description.trim().length === 0) {
          return `Erro: A descrição é obrigatória. Pode descrever o trabalho que fez?`;
        }
        if (durationYears === undefined || durationYears === null) {
          return `Erro: A duração é obrigatória. Por quanto tempo você trabalhou nisso?`;
        }

        await storage.createActivity({
          facilitatorId,
          title,
          organization,
          description,
          durationYears,
          durationMonths: durationMonths || 0,
          activityType,
        });
        
        await storage.recalculateCompetencies(facilitatorId);
        
        const totalMonths = durationMonths || 0;
        const durationText = totalMonths > 0 
          ? `${durationYears} anos e ${totalMonths} meses` 
          : `${durationYears} ano${durationYears !== 1 ? 's' : ''}`;
        
        const friendlyType = getFriendlyActivityType(activityType);
        
        return `Perfeito! Registrei sua experiência como ${title} em ${organization} (${friendlyType}, ${durationText}). Suas competências foram atualizadas!`;
      } catch (error: any) {
        console.error(`[Portfolio Tool] Error creating experience:`, error);
        return `Error creating experience: ${error.message}`;
      }
    },
  });

  const updateActivityTool = new DynamicStructuredTool({
    name: "update_activity",
    description: `Update an existing activity in the facilitator's portfolio.

WORKFLOW:
1. Call list_activities first to get the internal data
2. Find the activity by title/organization in the INTERNAL section
3. Use the ID from INTERNAL data (NEVER show it to user)
4. Call this tool with the ID and fields to update
5. Tell user: "Atualizei sua experiência como [cargo]" - NEVER mention IDs

Example good response: "Pronto! Atualizei a duração da sua experiência como Professor."
Example BAD response: "Atualizei a atividade ID abc-123..." ← NEVER do this!`,
    schema: z.object({
      activityId: z.string().describe("ID from INTERNAL data - NEVER show this to user"),
      activityType: z.enum(['translation', 'facilitation', 'teaching', 'biblical_teaching', 'long_term_mentoring', 'oral_facilitation', 'quality_assurance_work', 'community_engagement', 'indigenous_work', 'school_work', 'general_experience']).optional().describe("New activity type"),
      title: z.string().optional().describe("New job title or role"),
      organization: z.string().optional().describe("New organization name"),
      description: z.string().optional().describe("New description"),
      durationYears: z.number().optional().describe("New duration in years"),
      durationMonths: z.number().min(0).max(11).optional().describe("New duration months (0-11)"),
      languageName: z.string().optional().describe("New language name (for translation activities)"),
    }),
    func: async ({ activityId, ...updates }) => {
      try {
        // Validate that activityId looks like a valid UUID
        if (!activityId || activityId.length < 10) {
          return `Não consegui identificar qual atividade atualizar. Por favor, me diga qual experiência você quer modificar.`;
        }
        
        // Get the activity name for the response message
        const activities = await storage.getFacilitatorActivities(facilitatorId);
        const activity = activities.find(a => a.id === activityId);
        const activityName = activity?.title || activity?.activityType || 'atividade';
        const orgName = activity?.organization || '';
        
        // Filter out undefined values
        const cleanUpdates: Record<string, any> = {};
        if (updates.activityType !== undefined) cleanUpdates.activityType = updates.activityType;
        if (updates.title !== undefined) cleanUpdates.title = updates.title;
        if (updates.organization !== undefined) cleanUpdates.organization = updates.organization;
        if (updates.description !== undefined) cleanUpdates.description = updates.description;
        if (updates.durationYears !== undefined) cleanUpdates.durationYears = updates.durationYears;
        if (updates.durationMonths !== undefined) cleanUpdates.durationMonths = updates.durationMonths;
        if (updates.languageName !== undefined) cleanUpdates.languageName = updates.languageName;
        
        if (Object.keys(cleanUpdates).length === 0) {
          return `O que você gostaria de alterar na experiência "${activityName}"${orgName ? ` na ${orgName}` : ''}? Posso mudar o tipo, cargo, organização, duração ou descrição.`;
        }
        
        await storage.updateActivity(activityId, cleanUpdates);
        await storage.recalculateCompetencies(facilitatorId);
        
        // Build user-friendly confirmation message
        const changes: string[] = [];
        if (cleanUpdates.activityType) {
          const typePt: Record<string, string> = {
            translation: 'Tradução', facilitation: 'Facilitação', teaching: 'Ensino',
            biblical_teaching: 'Ensino Bíblico', long_term_mentoring: 'Mentoria',
            oral_facilitation: 'Facilitação Oral', quality_assurance_work: 'Controle de Qualidade',
            community_engagement: 'Engajamento Comunitário', indigenous_work: 'Trabalho Indígena',
            school_work: 'Trabalho Escolar', general_experience: 'Experiência Geral'
          };
          changes.push(`tipo para ${typePt[cleanUpdates.activityType] || cleanUpdates.activityType}`);
        }
        if (cleanUpdates.title) changes.push(`cargo para "${cleanUpdates.title}"`);
        if (cleanUpdates.organization) changes.push(`organização para "${cleanUpdates.organization}"`);
        if (cleanUpdates.durationYears !== undefined || cleanUpdates.durationMonths !== undefined) {
          const years = cleanUpdates.durationYears ?? activity?.durationYears ?? 0;
          const months = cleanUpdates.durationMonths ?? activity?.durationMonths ?? 0;
          const durationText = months > 0 ? `${years} anos e ${months} meses` : `${years} anos`;
          changes.push(`duração para ${durationText}`);
        }
        if (cleanUpdates.languageName) changes.push(`idioma para "${cleanUpdates.languageName}"`);
        if (cleanUpdates.description) changes.push('descrição');
        
        const displayName = activityName + (orgName ? ` na ${orgName}` : '');
        return `✅ Atualizei sua experiência como "${displayName}"! Alterações: ${changes.join(', ')}.`;
      } catch (error: any) {
        console.error(`[Portfolio Tool] Error updating activity:`, error);
        return `Desculpe, não consegui atualizar essa atividade. Pode me dizer novamente qual experiência você quer modificar?`;
      }
    },
  });

  return [
    addQualificationTool,
    updateQualificationTool,
    addActivityTool,
    createGeneralExperienceTool,
    updateActivityTool,
  ];
}

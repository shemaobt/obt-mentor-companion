/**
 * Read-Only Tools
 * 
 * Tools for reading portfolio data without modifications.
 * Returns pre-formatted output with emoji indicators.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { IStorage } from "../../storage";
import { CORE_COMPETENCIES } from "@shared/schema";
import { calculateCompetencyScores } from "../../competency-mapping";

/**
 * Format competency status with emoji
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'advanced': return '🟢 Advanced';
    case 'proficient': return '🟡 Proficient';
    case 'growing': return '🔵 Developing';
    case 'emerging': return '🔵 Developing';
    case 'not_started': return '⚪ Not Started';
    default: return '⚪ Not Started';
  }
}

/**
 * Format competency status with emoji (Portuguese)
 */
function formatStatusPt(status: string): string {
  switch (status) {
    case 'advanced': return '🟢 Avançado';
    case 'proficient': return '🟡 Proficiente';
    case 'growing': return '🔵 Em Desenvolvimento';
    case 'emerging': return '🔵 Em Desenvolvimento';
    case 'not_started': return '⚪ Ainda não iniciado';
    default: return '⚪ Ainda não iniciado';
  }
}

/**
 * Create read-only portfolio tools
 */
export function createReadTools(storage: IStorage, facilitatorId: string) {
  
  /**
   * List qualifications with IDs - needed for update operations
   */
  const listQualificationsTool = new DynamicStructuredTool({
    name: "list_qualifications",
    description: `List all qualifications in the facilitator's portfolio WITH their IDs. 
    
USE THIS TOOL FIRST when the user wants to:
- Update a qualification (change date, title, etc.)
- Delete a qualification
- Attach a certificate to a qualification
- See details of a specific qualification

The returned IDs are required for update_qualification tool.`,
    schema: z.object({
      language: z.enum(['en', 'pt']).optional().describe("Language for the response. Defaults to Portuguese."),
    }),
    func: async ({ language = 'pt' }) => {
      try {
        const qualifications = await storage.getFacilitatorQualifications(facilitatorId);
        
        if (qualifications.length === 0) {
          return language === 'en' 
            ? "No qualifications found in your portfolio."
            : "Nenhuma qualificação encontrada no seu portfólio.";
        }
        
        const formatDate = (date: Date | string | null) => {
          if (!date) return 'N/A';
          const d = new Date(date);
          return d.toLocaleDateString(language === 'en' ? 'en-US' : 'pt-BR', { 
            year: 'numeric', 
            month: 'long' 
          });
        };
        
        const levelNames: Record<string, Record<string, string>> = {
          en: {
            introduction: 'Introduction',
            certificate: 'Certificate',
            bachelor: 'Bachelor',
            master: 'Master',
            doctoral: 'Doctoral',
          },
          pt: {
            introduction: 'Introdução',
            certificate: 'Certificado',
            bachelor: 'Bacharelado',
            master: 'Mestrado',
            doctoral: 'Doutorado',
          },
        };
        
        const header = language === 'en' 
          ? `**Your Qualifications (${qualifications.length}):**\n`
          : `**Suas Qualificações (${qualifications.length}):**\n`;
        
        const list = qualifications.map((q, index) => {
          const level = levelNames[language][q.courseLevel || 'certificate'] || q.courseLevel;
          return `${index + 1}. **${q.courseTitle}**
   - ID: \`${q.id}\`
   - ${language === 'en' ? 'Institution' : 'Instituição'}: ${q.institution}
   - ${language === 'en' ? 'Completed' : 'Concluído'}: ${formatDate(q.completionDate)}
   - ${language === 'en' ? 'Level' : 'Nível'}: ${level}`;
        }).join('\n\n');
        
        const footer = language === 'en'
          ? "\n\n*To update a qualification, I need the ID shown above.*"
          : "\n\n*Para atualizar uma qualificação, preciso do ID mostrado acima.*";
        
        return header + list + footer;
      } catch (error: any) {
        console.error(`[Read Tool] list_qualifications failed:`, error);
        return `Error listing qualifications: ${error.message}`;
      }
    },
  });

  /**
   * List activities with IDs - needed for update operations
   */
  const listActivitiesTool = new DynamicStructuredTool({
    name: "list_activities",
    description: `List all activities in the facilitator's portfolio WITH their IDs.
    
USE THIS TOOL FIRST when the user wants to:
- Update an activity (change duration, description, etc.)
- Delete an activity
- See details of a specific activity

The returned IDs are required for update_activity tool.`,
    schema: z.object({
      language: z.enum(['en', 'pt']).optional().describe("Language for the response. Defaults to Portuguese."),
    }),
    func: async ({ language = 'pt' }) => {
      try {
        const activities = await storage.getFacilitatorActivities(facilitatorId);
        
        if (activities.length === 0) {
          return language === 'en' 
            ? "No activities found in your portfolio."
            : "Nenhuma atividade encontrada no seu portfólio.";
        }
        
        const activityTypeNames: Record<string, Record<string, string>> = {
          en: {
            translation: 'Translation',
            facilitation: 'Facilitation',
            teaching: 'Teaching',
            biblical_teaching: 'Biblical Teaching',
            long_term_mentoring: 'Long-term Mentoring',
            oral_facilitation: 'Oral Facilitation',
            quality_assurance_work: 'Quality Assurance',
            community_engagement: 'Community Engagement',
            indigenous_work: 'Indigenous Work',
            school_work: 'School Work',
            general_experience: 'General Experience',
          },
          pt: {
            translation: 'Tradução',
            facilitation: 'Facilitação',
            teaching: 'Ensino',
            biblical_teaching: 'Ensino Bíblico',
            long_term_mentoring: 'Mentoria',
            oral_facilitation: 'Facilitação Oral',
            quality_assurance_work: 'Controle de Qualidade',
            community_engagement: 'Engajamento Comunitário',
            indigenous_work: 'Trabalho Indígena',
            school_work: 'Trabalho Escolar',
            general_experience: 'Experiência Geral',
          },
        };
        
        const header = language === 'en' 
          ? `**Your Activities (${activities.length}):**\n`
          : `**Suas Atividades (${activities.length}):**\n`;
        
        const list = activities.map((a, index) => {
          const type = activityTypeNames[language][a.activityType || 'general_experience'] || a.activityType;
          const duration = a.durationMonths && a.durationMonths > 0
            ? `${a.durationYears || 0} ${language === 'en' ? 'years' : 'anos'}, ${a.durationMonths} ${language === 'en' ? 'months' : 'meses'}`
            : `${a.durationYears || 0} ${language === 'en' ? 'years' : 'anos'}`;
          
          return `${index + 1}. **${a.title || type}**
   - ID: \`${a.id}\`
   - ${language === 'en' ? 'Type' : 'Tipo'}: ${type}
   - ${language === 'en' ? 'Organization' : 'Organização'}: ${a.organization || 'N/A'}
   - ${language === 'en' ? 'Duration' : 'Duração'}: ${duration}
   ${a.languageName ? `- ${language === 'en' ? 'Language' : 'Idioma'}: ${a.languageName}` : ''}`;
        }).join('\n\n');
        
        const footer = language === 'en'
          ? "\n\n*To update an activity, I need the ID shown above.*"
          : "\n\n*Para atualizar uma atividade, preciso do ID mostrado acima.*";
        
        return header + list + footer;
      } catch (error: any) {
        console.error(`[Read Tool] list_activities failed:`, error);
        return `Error listing activities: ${error.message}`;
      }
    },
  });

  const getPortfolioSummaryTool = new DynamicStructuredTool({
    name: "get_portfolio_summary",
    description: "Get an overall summary of the facilitator's portfolio including competency counts, strongest areas, growth areas, and two-pillar analysis (education vs experience). Use this when the user asks about their overall progress, what they need to work on, or how they're doing generally. Returns pre-formatted output ready to display.",
    schema: z.object({
      language: z.enum(['en', 'pt']).optional().describe("Language for the response (en=English, pt=Portuguese). Defaults to Portuguese."),
    }),
    func: async ({ language = 'pt' }) => {
      try {
        // Get all portfolio data
        const competencies = await storage.getFacilitatorCompetencies(facilitatorId);
        const qualifications = await storage.getFacilitatorQualifications(facilitatorId);
        const activities = await storage.getFacilitatorActivities(facilitatorId);
        
        // Calculate scores for two-pillar analysis
        const scores = calculateCompetencyScores(qualifications, activities);
        
        // Count competencies by level
        const byLevel = {
          advanced: 0,
          proficient: 0,
          growing: 0,
          emerging: 0,
          not_started: 0,
        };
        
        competencies.forEach(c => {
          byLevel[c.status as keyof typeof byLevel]++;
        });
        
        // Calculate total education and experience scores
        let totalEducationScore = 0;
        let totalExperienceScore = 0;
        for (const [_, edScore] of scores.education.entries()) {
          totalEducationScore += edScore;
        }
        for (const [_, expScore] of scores.experience.entries()) {
          totalExperienceScore += expScore;
        }
        
        // Identify strongest and weakest areas
        const competencyScores = competencies.map(c => ({
          id: c.competencyId,
          name: CORE_COMPETENCIES[c.competencyId]?.name || c.competencyId,
          status: c.status,
          score: scores.total.get(c.competencyId) || 0,
        })).sort((a, b) => b.score - a.score);
        
        const strongestAreas = competencyScores.slice(0, 3);
        const growthAreas = competencyScores.slice(-3).reverse().filter(c => c.status !== 'advanced');
        
        // Format output based on language
        const formatFn = language === 'en' ? formatStatus : formatStatusPt;
        
        if (language === 'en') {
          return `**Portfolio Summary**

**Competency Overview:**
🟢 Advanced: ${byLevel.advanced}
🟡 Proficient: ${byLevel.proficient}
🔵 Developing: ${byLevel.growing + byLevel.emerging}
⚪ Not Started: ${byLevel.not_started}

**Two-Pillar Analysis:**
📚 Education Score: ${Math.round(totalEducationScore * 10) / 10}
💼 Experience Score: ${Math.round(totalExperienceScore * 10) / 10}

**Strongest Areas:**
${strongestAreas.map(c => `${formatFn(c.status)} **${c.name}**`).join('\n')}

**Growth Opportunities:**
${growthAreas.map(c => `${formatFn(c.status)} **${c.name}**`).join('\n')}

**Portfolio Contents:**
📜 Qualifications: ${qualifications.length}
🎯 Activities: ${activities.length}`;
        } else {
          return `**Resumo do Portfólio**

**Visão Geral das Competências:**
🟢 Avançado: ${byLevel.advanced}
🟡 Proficiente: ${byLevel.proficient}
🔵 Em Desenvolvimento: ${byLevel.growing + byLevel.emerging}
⚪ Não Iniciado: ${byLevel.not_started}

**Análise de Dois Pilares:**
📚 Pontuação Educação: ${Math.round(totalEducationScore * 10) / 10}
💼 Pontuação Experiência: ${Math.round(totalExperienceScore * 10) / 10}

**Áreas Mais Fortes:**
${strongestAreas.map(c => `${formatFn(c.status)} **${c.name}**`).join('\n')}

**Oportunidades de Crescimento:**
${growthAreas.map(c => `${formatFn(c.status)} **${c.name}**`).join('\n')}

**Conteúdo do Portfólio:**
📜 Qualificações: ${qualifications.length}
🎯 Atividades: ${activities.length}`;
        }
      } catch (error: any) {
        console.error(`[Portfolio Tool] get_portfolio_summary failed:`, error);
        return `Error getting portfolio summary: ${error.message}`;
      }
    },
  });

  return [
    getPortfolioSummaryTool,
    listQualificationsTool,
    listActivitiesTool,
  ];
}

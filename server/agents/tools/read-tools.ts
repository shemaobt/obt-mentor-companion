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
  ];
}

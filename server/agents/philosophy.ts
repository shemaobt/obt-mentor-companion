/**
 * Philosophy Quotes from "De Facilitador a Mentor"
 * 
 * Core principles that define the OBT mentorship worldview.
 * These are referenced by prompts when discussing competencies and mentorship.
 */

export const PHILOSOPHY_QUOTES = {
  /**
   * On Competency Assessment - The decisive criterion
   */
  competencyAssessment: `"Diplomas, cursos e certificações ajudam, mas não bastam. O critério decisivo é competência demonstrada em serviço."`,

  /**
   * On Mentorship Mindset - Service, not status
   */
  mentorshipMindset: `"Mentoria em TBO não é um posto, é um serviço. O mentor serve a Palavra e serve a comunidade."`,

  /**
   * On Mentor's Posture - Horizontal relationship
   */
  mentorPosture: `"Relação horizontal. O mentor caminha ao lado da equipe, não acima dela. O foco é servir, ouvir e construir juntos."`,

  /**
   * On Continuous Formation
   */
  continuousFormation: `"Formação contínua. O mentor acompanha o time do começo ao fim, oferecendo feedbacks e ajudando a desenvolver competências e confiança."`,

  /**
   * On Autonomy as Goal
   */
  autonomyGoal: `"Autonomia como meta. Um bom mentor vai se tornando desnecessário: transfere conhecimento e incentiva decisões informadas."`,

  /**
   * On Oral Bible Translation
   */
  oralTranslation: `"TBO é uma abordagem centrada no falante nativo, em que tradução e garantia de qualidade são conduzidas de forma oral. A oralidade é o centro."`,

  /**
   * On Experience Development
   */
  experienceDevelopment: `"Mesmo quando alguém possui um grau avançado, as competências se desenvolvem no chão do projeto: experiência prática, formação continuada e mentoria de gente mais experiente."`,

  /**
   * On Honoring Native Speakers
   */
  honorNativeSpeakers: `"Honrar a sabedoria dos falantes nativos, criar ambientes relacionais (amizade e hospitalidade contam muito)."`,
} as const;

/**
 * Get a formatted quote block for prompts
 */
export function getQuoteBlock(keys: (keyof typeof PHILOSOPHY_QUOTES)[]): string {
  return keys.map(key => PHILOSOPHY_QUOTES[key]).join("\n");
}

/**
 * All quotes formatted for full context injection
 */
export const ALL_PHILOSOPHY_QUOTES = Object.values(PHILOSOPHY_QUOTES).join("\n\n");

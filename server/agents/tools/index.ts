/**
 * Tool Exports
 * 
 * Re-exports all tool creation functions for easy importing.
 */

export { createPortfolioTools } from "./portfolio-tools";
export { createCompetencyTools } from "./competency-tools";
export { createCertificateTools } from "./certificate-tools";
export { createReadTools } from "./read-tools";

import type { IStorage } from "../../storage";
import { createPortfolioTools } from "./portfolio-tools";
import { createCompetencyTools } from "./competency-tools";
import { createCertificateTools } from "./certificate-tools";
import { createReadTools } from "./read-tools";

/**
 * Create all tools for a facilitator
 */
export function createAllTools(storage: IStorage, facilitatorId: string) {
  return {
    portfolioTools: createPortfolioTools(storage, facilitatorId),
    competencyTools: createCompetencyTools(storage, facilitatorId),
    certificateTools: createCertificateTools(storage, facilitatorId),
    readTools: createReadTools(storage, facilitatorId),
  };
}

/**
 * Get tools for conversational node
 * 
 * SIMPLIFIED ARCHITECTURE: The conversational node now has ALL tools.
 * The LLM decides when to use portfolio/certificate tools based on conversation context.
 * This eliminates the need for complex routing logic in the supervisor.
 */
export function getConversationalTools(storage: IStorage, facilitatorId: string) {
  return [
    ...createReadTools(storage, facilitatorId),
    ...createCompetencyTools(storage, facilitatorId),
    ...createPortfolioTools(storage, facilitatorId),
    ...createCertificateTools(storage, facilitatorId),
  ];
}

/**
 * Get tools for portfolio node (portfolio management + certificate + read)
 */
export function getPortfolioNodeTools(storage: IStorage, facilitatorId: string) {
  return [
    ...createPortfolioTools(storage, facilitatorId),
    ...createCertificateTools(storage, facilitatorId),
    ...createReadTools(storage, facilitatorId),
  ];
}

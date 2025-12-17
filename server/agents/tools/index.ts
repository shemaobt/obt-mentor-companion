export { createPortfolioTools } from "./portfolio-tools";
export { createCompetencyTools } from "./competency-tools";
export { createCertificateTools } from "./certificate-tools";
export { createReadTools } from "./read-tools";

import type { IStorage } from "../../storage";
import { createPortfolioTools } from "./portfolio-tools";
import { createCompetencyTools } from "./competency-tools";
import { createCertificateTools } from "./certificate-tools";
import { createReadTools } from "./read-tools";

export function createAllTools(storage: IStorage, facilitatorId: string) {
  return {
    portfolioTools: createPortfolioTools(storage, facilitatorId),
    competencyTools: createCompetencyTools(storage, facilitatorId),
    certificateTools: createCertificateTools(storage, facilitatorId),
    readTools: createReadTools(storage, facilitatorId),
  };
}

export function getConversationalTools(storage: IStorage, facilitatorId: string) {
  return [...createReadTools(storage, facilitatorId), ...createCompetencyTools(storage, facilitatorId)];
}

export function getPortfolioNodeTools(storage: IStorage, facilitatorId: string) {
  return [
    ...createPortfolioTools(storage, facilitatorId),
    ...createCertificateTools(storage, facilitatorId),
    ...createReadTools(storage, facilitatorId),
  ];
}

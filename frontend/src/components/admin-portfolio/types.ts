import type { CompetencyId, FacilitatorCompetency } from "@shared/schema";

export const competencyStatusOptions = ['not_started', 'emerging', 'growing', 'proficient', 'advanced'] as const;
export type CompetencyStatus = typeof competencyStatusOptions[number];

export const statusLabels: Record<CompetencyStatus, string> = {
  not_started: 'Not Started',
  emerging: 'Emerging',
  growing: 'Growing',
  proficient: 'Proficient',
  advanced: 'Advanced'
};

export interface PendingStatusChange {
  competencyId: CompetencyId;
  newStatus: CompetencyStatus;
  currentNotes: string;
}

export interface FacilitatorProfileData {
  region: string | null;
  mentorSupervisor: string | null;
  totalLanguagesMentored?: number;
  totalChaptersMentored?: number;
}

export const getCompetencyStatus = (competencies: FacilitatorCompetency[], competencyId: CompetencyId): CompetencyStatus => {
  const competency = competencies.find(c => c.competencyId === competencyId);
  return (competency?.status as CompetencyStatus) || 'not_started';
};

export const getCompetencyNotes = (competencies: FacilitatorCompetency[], competencyId: CompetencyId): string => {
  const competency = competencies.find(c => c.competencyId === competencyId);
  return competency?.notes || '';
};

export const getCompetencyData = (competencies: FacilitatorCompetency[], competencyId: CompetencyId) => {
  return competencies.find(c => c.competencyId === competencyId);
};

import type { UseMutationResult } from "@tanstack/react-query";
import type {
  FacilitatorCompetency,
  FacilitatorQualification,
  MentorshipActivity,
  QuarterlyReport,
  CompetencyId
} from "@shared/schema";

export type CourseLevel = "introduction" | "certificate" | "bachelor" | "master" | "doctoral";

export type ActivityType = "translation" | "facilitation" | "teaching" | "biblical_teaching" | "long_term_mentoring" | "oral_facilitation" | "quality_assurance_work" | "community_engagement" | "indigenous_work" | "school_work" | "general_experience";

export type CompetencyStatus = "not_started" | "emerging" | "growing" | "proficient" | "advanced";

export const competencyStatusOptions = ['not_started', 'emerging', 'growing', 'proficient', 'advanced'] as const;

export const statusLabels: Record<CompetencyStatus, string> = {
  not_started: 'Not Started',
  emerging: 'Emerging',
  growing: 'Growing',
  proficient: 'Proficient',
  advanced: 'Advanced'
};

export const statusColors: Record<CompetencyStatus, string> = {
  not_started: '',
  emerging: '',
  growing: '',
  proficient: '',
  advanced: ''
};

export interface ActivityUpdateInput {
  id: string;
  activityType?: string;
  languageName?: string;
  chaptersCount?: number;
  durationYears?: number;
  durationMonths?: number;
  notes?: string;
  title?: string;
  organization?: string;
  yearsOfExperience?: number;
  description?: string;
  activityDate?: string;
}

export interface ReportCompetency {
  competencyId: string;
  status: string;
}

export interface ReportActivity {
  languageName: string;
  chaptersCount: number;
}

export interface ReportDataSummary {
  completedCompetencies?: number;
  totalCompetencies?: number;
  qualificationsCount?: number;
  totalQualifications?: number;
  totalActivities?: number;
  totalChapters?: number;
  languages?: string[];
}

export interface ReportData {
  summary?: ReportDataSummary;
  competencies?: ReportCompetency[];
  activities?: ReportActivity[];
}

export interface Supervisor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

export interface FacilitatorProfile {
  region: string | null;
  mentorSupervisor: string | null;
  supervisorId: string | null;
}

export interface CertificateUploadData {
  qualificationId: string;
  file: File;
}

export interface CertificateDeleteData {
  qualificationId: string;
  attachmentId: string;
}

export interface ProfileTabProps {
  loadingProfile: boolean;
  facilitatorProfile: FacilitatorProfile | undefined;
  isEditingProfile: boolean;
  setIsEditingProfile: (editing: boolean) => void;
  profileRegion: string;
  setProfileRegion: (region: string) => void;
  profileSupervisorId: string | undefined;
  setProfileSupervisorId: (id: string | undefined) => void;
  supervisorPopoverOpen: boolean;
  setSupervisorPopoverOpen: (open: boolean) => void;
  supervisors: Supervisor[];
  loadingSupervisors: boolean;
  updateProfileMutation: UseMutationResult<void, Error, { region: string; supervisorId?: string }>;
}

export interface CompetenciesTabProps {
  loadingCompetencies: boolean;
  competencies: FacilitatorCompetency[];
  isMobile: boolean;
  user: { isAdmin?: boolean } | null;
  editingCompetency: CompetencyId | null;
  setEditingCompetency: (id: CompetencyId | null) => void;
  tempNotes: string;
  setTempNotes: (notes: string) => void;
  updateCompetencyMutation: UseMutationResult<void, Error, { competencyId: CompetencyId; status: CompetencyStatus; notes?: string }>;
  recalculateCompetenciesMutation: UseMutationResult<void, Error, void>;
  analyzeChatHistoryMutation: UseMutationResult<{ evidenceCount: number; competenciesTracked: string[] }, Error, void>;
  applyPendingEvidenceMutation: UseMutationResult<{ updatedCompetencies: string[]; totalEvidence: number; message: string }, Error, void>;
}

export interface QualificationsTabProps {
  loadingQualifications: boolean;
  qualifications: FacilitatorQualification[];
  qualificationDialogOpen: boolean;
  setQualificationDialogOpen: (open: boolean) => void;
  newQualCourseTitle: string;
  setNewQualCourseTitle: (title: string) => void;
  newQualInstitution: string;
  setNewQualInstitution: (institution: string) => void;
  newQualCompletionDate: string;
  setNewQualCompletionDate: (date: string) => void;
  newQualCourseLevel: CourseLevel | "";
  setNewQualCourseLevel: (level: CourseLevel | "") => void;
  newQualDescription: string;
  setNewQualDescription: (description: string) => void;
  editingQualification: FacilitatorQualification | null;
  setEditingQualification: (qualification: FacilitatorQualification | null) => void;
  editQualificationDialogOpen: boolean;
  setEditQualificationDialogOpen: (open: boolean) => void;
  uploadingCertificateFor: string | null;
  createQualificationMutation: UseMutationResult<void, Error, { courseTitle: string; institution: string; completionDate: string; courseLevel: CourseLevel; description: string }>;
  updateQualificationMutation: UseMutationResult<void, Error, { id: string; courseTitle: string; institution: string; completionDate: string; courseLevel: CourseLevel; description: string }>;
  deleteQualificationMutation: UseMutationResult<void, Error, string>;
  uploadCertificateMutation: UseMutationResult<unknown, Error, CertificateUploadData>;
  deleteCertificateMutation: UseMutationResult<void, Error, CertificateDeleteData>;
}

export interface ActivitiesTabProps {
  loadingActivities: boolean;
  activities: MentorshipActivity[];
  activityDialogOpen: boolean;
  setActivityDialogOpen: (open: boolean) => void;
  newActivityLanguage: string;
  setNewActivityLanguage: (language: string) => void;
  newActivityChapters: string;
  setNewActivityChapters: (chapters: string) => void;
  newActivityDurationYears: string;
  setNewActivityDurationYears: (years: string) => void;
  newActivityDurationMonths: string;
  setNewActivityDurationMonths: (months: string) => void;
  newActivityNotes: string;
  setNewActivityNotes: (notes: string) => void;
  editingActivity: MentorshipActivity | null;
  setEditingActivity: (activity: MentorshipActivity | null) => void;
  editActivityDialogOpen: boolean;
  setEditActivityDialogOpen: (open: boolean) => void;
  createActivityMutation: UseMutationResult<void, Error, { languageName: string; chaptersCount: number; durationYears: number; durationMonths: number; notes?: string }>;
  updateActivityMutation: UseMutationResult<void, Error, ActivityUpdateInput>;
  deleteActivityMutation: UseMutationResult<void, Error, string>;
}

export interface ReportsTabProps {
  loadingReports: boolean;
  reports: QuarterlyReport[];
  reportDialogOpen: boolean;
  setReportDialogOpen: (open: boolean) => void;
  reportPeriodStart: string;
  setReportPeriodStart: (date: string) => void;
  reportPeriodEnd: string;
  setReportPeriodEnd: (date: string) => void;
  selectedReport: QuarterlyReport | null;
  setSelectedReport: (report: QuarterlyReport | null) => void;
  generateReportMutation: UseMutationResult<QuarterlyReport, Error, { periodStart: string; periodEnd: string }>;
  deleteReportMutation: UseMutationResult<void, Error, string>;
}

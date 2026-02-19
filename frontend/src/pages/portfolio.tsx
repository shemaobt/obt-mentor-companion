import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import Sidebar from "@/components/sidebar";
import {
  User,
  Target,
  GraduationCap,
  Activity,
  FileText,
  Menu
} from "lucide-react";
import {
  type CompetencyId,
  type FacilitatorCompetency,
  type FacilitatorQualification,
  type MentorshipActivity,
  type QuarterlyReport
} from "@shared/schema";
import {
  ProfileTab,
  CompetenciesTab,
  QualificationsTab,
  ActivitiesTab,
  ReportsTab,
  type CourseLevel,
  type CompetencyStatus,
  type Supervisor,
  type FacilitatorProfile,
  type ActivityUpdateInput
} from "@/components/portfolio";

export default function Portfolio() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const validTabs = ['profile', 'competencies', 'qualifications', 'activities', 'reports', 'settings'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const [editingCompetency, setEditingCompetency] = useState<CompetencyId | null>(null);
  const [tempNotes, setTempNotes] = useState("");

  const [newQualCourseTitle, setNewQualCourseTitle] = useState("");
  const [newQualInstitution, setNewQualInstitution] = useState("");
  const [newQualCompletionDate, setNewQualCompletionDate] = useState("");
  const [newQualCourseLevel, setNewQualCourseLevel] = useState<CourseLevel | "">("");
  const [newQualDescription, setNewQualDescription] = useState("");
  const [qualificationDialogOpen, setQualificationDialogOpen] = useState(false);
  const [editingQualification, setEditingQualification] = useState<FacilitatorQualification | null>(null);
  const [editQualificationDialogOpen, setEditQualificationDialogOpen] = useState(false);

  const [uploadingCertificateFor, setUploadingCertificateFor] = useState<string | null>(null);

  const [newActivityLanguage, setNewActivityLanguage] = useState("");
  const [newActivityChapters, setNewActivityChapters] = useState("0");
  const [newActivityDurationYears, setNewActivityDurationYears] = useState("0");
  const [newActivityDurationMonths, setNewActivityDurationMonths] = useState("0");
  const [newActivityNotes, setNewActivityNotes] = useState("");
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<MentorshipActivity | null>(null);
  const [editActivityDialogOpen, setEditActivityDialogOpen] = useState(false);

  const [reportPeriodStart, setReportPeriodStart] = useState("");
  const [reportPeriodEnd, setReportPeriodEnd] = useState("");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QuarterlyReport | null>(null);

  const { data: competencies = [], isLoading: loadingCompetencies } = useQuery<FacilitatorCompetency[]>({
    queryKey: ['/api/facilitator/competencies'],
    enabled: isAuthenticated
  });

  const { data: qualifications = [], isLoading: loadingQualifications } = useQuery<FacilitatorQualification[]>({
    queryKey: ['/api/facilitator/qualifications'],
    enabled: isAuthenticated
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery<MentorshipActivity[]>({
    queryKey: ['/api/facilitator/activities'],
    enabled: isAuthenticated
  });

  const { data: facilitatorProfile, isLoading: loadingProfile } = useQuery<FacilitatorProfile>({
    queryKey: ['/api/facilitator/profile'],
    enabled: isAuthenticated
  });

  const { data: supervisors = [], isLoading: loadingSupervisors } = useQuery<Supervisor[]>({
    queryKey: ['/api/supervisors'],
    enabled: isAuthenticated
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery<QuarterlyReport[]>({
    queryKey: ['/api/facilitator/reports'],
    enabled: isAuthenticated
  });

  const [profileRegion, setProfileRegion] = useState("");
  const [profileSupervisorId, setProfileSupervisorId] = useState<string | undefined>(undefined);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const updateCompetencyMutation = useMutation({
    mutationFn: async ({ competencyId, status, notes }: { competencyId: CompetencyId; status: CompetencyStatus; notes?: string }) => {
      await apiRequest("POST", "/api/facilitator/competencies", { competencyId, status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/competencies'] });
      toast({ title: "Success", description: "Competency status updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update competency", variant: "destructive" });
    },
  });

  const recalculateCompetenciesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/facilitator/recalculate-competencies", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/competencies'] });
      toast({ title: "Success", description: "Competencies recalculated successfully based on your qualifications and activities" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to recalculate competencies", variant: "destructive" });
    },
  });

  const analyzeChatHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/facilitator/analyze-chat-history", {});
      return await response.json() as { evidenceCount: number; competenciesTracked: string[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/competencies'] });
      toast({
        title: "Chat History Analyzed",
        description: `Found ${data.evidenceCount} pieces of competency evidence in your conversations. Competencies tracked: ${data.competenciesTracked.length}`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze chat history", variant: "destructive" });
    },
  });

  const applyPendingEvidenceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/facilitator/apply-pending-evidence", {});
      return await response.json() as { updatedCompetencies: string[]; totalEvidence: number; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/competencies'] });
      toast({
        title: data.updatedCompetencies.length > 0 ? "Competencies Updated" : "No Updates",
        description: data.message,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply pending evidence", variant: "destructive" });
    },
  });

  const createQualificationMutation = useMutation({
    mutationFn: async (data: { courseTitle: string; institution: string; completionDate: string; courseLevel: CourseLevel; description: string }) => {
      await apiRequest("POST", "/api/facilitator/qualifications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/qualifications'] });
      setQualificationDialogOpen(false);
      setNewQualCourseTitle("");
      setNewQualInstitution("");
      setNewQualCompletionDate("");
      setNewQualCourseLevel("");
      setNewQualDescription("");
      toast({ title: "Success", description: "Qualification added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add qualification", variant: "destructive" });
    },
  });

  const updateQualificationMutation = useMutation({
    mutationFn: async (data: { id: string; courseTitle: string; institution: string; completionDate: string; courseLevel: CourseLevel; description: string }) => {
      const { id, ...updates } = data;
      await apiRequest("PATCH", `/api/facilitator/qualifications/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/qualifications'] });
      setEditQualificationDialogOpen(false);
      setEditingQualification(null);
      toast({ title: "Success", description: "Qualification updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update qualification", variant: "destructive" });
    },
  });

  const deleteQualificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facilitator/qualifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/qualifications'] });
      toast({ title: "Success", description: "Qualification removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove qualification", variant: "destructive" });
    },
  });

  const uploadCertificateMutation = useMutation({
    mutationFn: async ({ qualificationId, file }: { qualificationId: string; file: File }) => {
      const formData = new FormData();
      formData.append('certificate', file);

      const response = await fetch(`/api/facilitator/qualifications/${qualificationId}/certificates`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onMutate: ({ qualificationId }) => {
      setUploadingCertificateFor(qualificationId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/facilitator/qualifications', variables.qualificationId, 'certificates']
      });
      setUploadingCertificateFor(null);
      toast({ title: "Success", description: "Certificate uploaded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to upload certificate", variant: "destructive" });
      setUploadingCertificateFor(null);
    },
  });

  const deleteCertificateMutation = useMutation({
    mutationFn: async ({ qualificationId, attachmentId }: { qualificationId: string; attachmentId: string }) => {
      await apiRequest("DELETE", `/api/facilitator/qualifications/${qualificationId}/certificates/${attachmentId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/facilitator/qualifications', variables.qualificationId, 'certificates']
      });
      toast({ title: "Success", description: "Certificate deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete certificate", variant: "destructive" });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: { languageName: string; chaptersCount: number; durationYears: number; durationMonths: number; notes?: string }) => {
      await apiRequest("POST", "/api/facilitator/activities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/activities'] });
      setActivityDialogOpen(false);
      setNewActivityLanguage("");
      setNewActivityChapters("0");
      setNewActivityDurationYears("0");
      setNewActivityDurationMonths("0");
      setNewActivityNotes("");
      toast({ title: "Success", description: "Activity registered" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to register activity", variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (data: ActivityUpdateInput) => {
      const { id, ...updates } = data;
      await apiRequest("PATCH", `/api/facilitator/activities/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/activities'] });
      setEditActivityDialogOpen(false);
      setEditingActivity(null);
      toast({ title: "Success", description: "Activity updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update activity", variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facilitator/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/activities'] });
      toast({ title: "Success", description: "Activity removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove activity", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { region: string; supervisorId: string | undefined }) => {
      await apiRequest("POST", "/api/facilitator/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/profile'] });
      setIsEditingProfile(false);
      toast({ title: "Success", description: "Profile updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { periodStart: string; periodEnd: string }) => {
      const response = await apiRequest("POST", "/api/facilitator/reports/generate", data);
      return await response.json() as QuarterlyReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/reports'] });
      setReportDialogOpen(false);
      setReportPeriodStart("");
      setReportPeriodEnd("");
      toast({ title: "Success", description: "Report generated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest("DELETE", `/api/facilitator/reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/reports'] });
      setSelectedReport(null);
      toast({ title: "Success", description: "Report removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove report", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (facilitatorProfile) {
      setProfileRegion(facilitatorProfile.region || "");
      setProfileSupervisorId(facilitatorProfile.supervisorId || undefined);
    }
  }, [facilitatorProfile]);

  const TOTAL_COMPETENCIES = 11;
  const proficientCompetencies = competencies.filter(c => c.status === 'proficient' || c.status === 'advanced');
  const competencyProgress = (proficientCompetencies.length / TOTAL_COMPETENCIES) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-portfolio">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 2xl:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      <div className={`
        ${isMobile
          ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } w-4/5 max-w-sm`
          : 'h-screen w-80'
        }
      `}>
        <Sidebar
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className={`flex-1 h-screen overflow-y-auto ${isMobile ? 'p-4' : 'p-8'}`}>
        <div className={`${isMobile ? 'max-w-full' : 'max-w-7xl'} mx-auto`}>
          <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
            <div className="flex items-start gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-1 flex-shrink-0"
                  data-testid="button-open-sidebar"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex-1">
                <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
                  Facilitator Portfolio
                </h1>
                <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>
                  Track your competencies, qualifications and translation activities
                </p>
              </div>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Competency Progress</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(competencyProgress)}% ({proficientCompetencies.length}/{TOTAL_COMPETENCIES})
                </span>
              </div>
              <Progress value={competencyProgress} className="h-2" />
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full inline-flex md:grid md:grid-cols-5 overflow-x-auto scrollbar-hide justify-start md:justify-center">
              <TabsTrigger value="profile" data-testid="tab-profile" className="flex-shrink-0 flex items-center gap-2 md:gap-0">
                <User className="h-4 w-4 md:mr-2" />
                <span className="whitespace-nowrap">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="competencies" data-testid="tab-competencies" className="flex-shrink-0 flex items-center gap-2 md:gap-0">
                <Target className="h-4 w-4 md:mr-2" />
                <span className="whitespace-nowrap">Competencies</span>
              </TabsTrigger>
              <TabsTrigger value="qualifications" data-testid="tab-qualifications" className="flex-shrink-0 flex items-center gap-2 md:gap-0">
                <GraduationCap className="h-4 w-4 md:mr-2" />
                <span className="whitespace-nowrap">Qualifications</span>
              </TabsTrigger>
              <TabsTrigger value="activities" data-testid="tab-activities" className="flex-shrink-0 flex items-center gap-2 md:gap-0">
                <Activity className="h-4 w-4 md:mr-2" />
                <span className="whitespace-nowrap">Activities</span>
              </TabsTrigger>
              <TabsTrigger value="reports" data-testid="tab-reports" className="flex-shrink-0 flex items-center gap-2 md:gap-0">
                <FileText className="h-4 w-4 md:mr-2" />
                <span className="whitespace-nowrap">Reports</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <ProfileTab
                loadingProfile={loadingProfile}
                facilitatorProfile={facilitatorProfile}
                isEditingProfile={isEditingProfile}
                setIsEditingProfile={setIsEditingProfile}
                profileRegion={profileRegion}
                setProfileRegion={setProfileRegion}
                profileSupervisorId={profileSupervisorId}
                setProfileSupervisorId={setProfileSupervisorId}
                supervisorPopoverOpen={supervisorPopoverOpen}
                setSupervisorPopoverOpen={setSupervisorPopoverOpen}
                supervisors={supervisors}
                loadingSupervisors={loadingSupervisors}
                updateProfileMutation={updateProfileMutation}
              />
            </TabsContent>

            <TabsContent value="competencies" className="mt-6">
              <CompetenciesTab
                loadingCompetencies={loadingCompetencies}
                competencies={competencies}
                isMobile={isMobile}
                user={user}
                editingCompetency={editingCompetency}
                setEditingCompetency={setEditingCompetency}
                tempNotes={tempNotes}
                setTempNotes={setTempNotes}
                updateCompetencyMutation={updateCompetencyMutation}
                recalculateCompetenciesMutation={recalculateCompetenciesMutation}
                analyzeChatHistoryMutation={analyzeChatHistoryMutation}
                applyPendingEvidenceMutation={applyPendingEvidenceMutation}
              />
            </TabsContent>

            <TabsContent value="qualifications" className="mt-6">
              <QualificationsTab
                loadingQualifications={loadingQualifications}
                qualifications={qualifications}
                qualificationDialogOpen={qualificationDialogOpen}
                setQualificationDialogOpen={setQualificationDialogOpen}
                newQualCourseTitle={newQualCourseTitle}
                setNewQualCourseTitle={setNewQualCourseTitle}
                newQualInstitution={newQualInstitution}
                setNewQualInstitution={setNewQualInstitution}
                newQualCompletionDate={newQualCompletionDate}
                setNewQualCompletionDate={setNewQualCompletionDate}
                newQualCourseLevel={newQualCourseLevel}
                setNewQualCourseLevel={setNewQualCourseLevel}
                newQualDescription={newQualDescription}
                setNewQualDescription={setNewQualDescription}
                editingQualification={editingQualification}
                setEditingQualification={setEditingQualification}
                editQualificationDialogOpen={editQualificationDialogOpen}
                setEditQualificationDialogOpen={setEditQualificationDialogOpen}
                uploadingCertificateFor={uploadingCertificateFor}
                createQualificationMutation={createQualificationMutation}
                updateQualificationMutation={updateQualificationMutation}
                deleteQualificationMutation={deleteQualificationMutation}
                uploadCertificateMutation={uploadCertificateMutation}
                deleteCertificateMutation={deleteCertificateMutation}
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-6">
              <ActivitiesTab
                loadingActivities={loadingActivities}
                activities={activities}
                activityDialogOpen={activityDialogOpen}
                setActivityDialogOpen={setActivityDialogOpen}
                newActivityLanguage={newActivityLanguage}
                setNewActivityLanguage={setNewActivityLanguage}
                newActivityChapters={newActivityChapters}
                setNewActivityChapters={setNewActivityChapters}
                newActivityDurationYears={newActivityDurationYears}
                setNewActivityDurationYears={setNewActivityDurationYears}
                newActivityDurationMonths={newActivityDurationMonths}
                setNewActivityDurationMonths={setNewActivityDurationMonths}
                newActivityNotes={newActivityNotes}
                setNewActivityNotes={setNewActivityNotes}
                editingActivity={editingActivity}
                setEditingActivity={setEditingActivity}
                editActivityDialogOpen={editActivityDialogOpen}
                setEditActivityDialogOpen={setEditActivityDialogOpen}
                createActivityMutation={createActivityMutation}
                updateActivityMutation={updateActivityMutation}
                deleteActivityMutation={deleteActivityMutation}
              />
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <ReportsTab
                loadingReports={loadingReports}
                reports={reports}
                reportDialogOpen={reportDialogOpen}
                setReportDialogOpen={setReportDialogOpen}
                reportPeriodStart={reportPeriodStart}
                setReportPeriodStart={setReportPeriodStart}
                reportPeriodEnd={reportPeriodEnd}
                setReportPeriodEnd={setReportPeriodEnd}
                selectedReport={selectedReport}
                setSelectedReport={setSelectedReport}
                generateReportMutation={generateReportMutation}
                deleteReportMutation={deleteReportMutation}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

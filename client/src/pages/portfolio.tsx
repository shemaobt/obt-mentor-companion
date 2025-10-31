import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import Sidebar from "@/components/sidebar";
import { 
  Award, 
  Calendar, 
  Plus, 
  Trash2,
  CheckCircle2,
  Circle,
  Target,
  GraduationCap,
  Activity,
  FileText,
  Download,
  User,
  Edit,
  Save,
  Sparkles,
  Zap,
  Menu,
  Pencil,
  RefreshCw,
  Check,
  ChevronsUpDown,
  X,
  Upload,
  File,
  Eye,
  MessageSquare,
  Settings,
  Lock,
  ImageIcon,
  EyeOff
} from "lucide-react";
import { 
  CORE_COMPETENCIES,
  getCompetencyName,
  type CompetencyId,
  type FacilitatorCompetency, 
  type FacilitatorQualification, 
  type MentorshipActivity,
  type QuarterlyReport,
  type QualificationAttachment
} from "@shared/schema";
import { cn } from "@/lib/utils";

type CourseLevel = "introduction" | "certificate" | "bachelor" | "master" | "doctoral";

interface Supervisor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

// Component to manage certificates for a single qualification
function QualificationCertificates({ 
  qualificationId,
  uploadCertificateMutation,
  deleteCertificateMutation,
  uploadingCertificateFor 
}: {
  qualificationId: string;
  uploadCertificateMutation: any;
  deleteCertificateMutation: any;
  uploadingCertificateFor: string | null;
}) {
  const { data: certificates = [], isLoading } = useQuery<QualificationAttachment[]>({
    queryKey: ['/api/facilitator/qualifications', qualificationId, 'certificates']
  });

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-medium">Certificates</Label>
        <input
          type="file"
          id={`cert-upload-${qualificationId}`}
          accept="application/pdf,image/jpeg,image/jpg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadCertificateMutation.mutate({
                qualificationId,
                file
              });
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => document.getElementById(`cert-upload-${qualificationId}`)?.click()}
          disabled={uploadCertificateMutation.isPending && uploadingCertificateFor === qualificationId}
          data-testid={`button-upload-certificate-${qualificationId}`}
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploadCertificateMutation.isPending && uploadingCertificateFor === qualificationId ? 'Uploading...' : 'Upload'}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : certificates.length > 0 ? (
        <div className="space-y-1">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <File className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate" title={cert.originalName} data-testid={`text-cert-name-${cert.id}`}>
                  {cert.originalName}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  ({(cert.fileSize / 1024).toFixed(0)} KB)
                </span>
              </div>
              <div className="flex space-x-1 flex-shrink-0 ml-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => window.open(`/api/facilitator/qualifications/${qualificationId}/certificates/${cert.id}`, '_blank')}
                  data-testid={`button-download-cert-${cert.id}`}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteCertificateMutation.mutate({
                    qualificationId,
                    attachmentId: cert.id
                  })}
                  data-testid={`button-delete-cert-${cert.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">No certificates uploaded</p>
      )}
    </div>
  );
}

const competencyStatusOptions = ['not_started', 'emerging', 'growing', 'proficient', 'advanced'] as const;
type CompetencyStatus = typeof competencyStatusOptions[number];

const statusLabels: Record<CompetencyStatus, string> = {
  not_started: 'Not Started',
  emerging: 'Emerging',
  growing: 'Growing',
  proficient: 'Proficient',
  advanced: 'Advanced'
};

const statusColors: Record<CompetencyStatus, string> = {
  not_started: '',
  emerging: '',
  growing: '',
  proficient: '',
  advanced: ''
};

export default function Portfolio() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false);

  // Check URL parameter for tab and update when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const validTabs = ['profile', 'competencies', 'qualifications', 'activities', 'reports', 'settings'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  // Ensure sidebar is closed when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Competency notes editing state
  const [editingCompetency, setEditingCompetency] = useState<CompetencyId | null>(null);
  const [tempNotes, setTempNotes] = useState("");

  // Qualifications state
  const [newQualCourseTitle, setNewQualCourseTitle] = useState("");
  const [newQualInstitution, setNewQualInstitution] = useState("");
  const [newQualCompletionDate, setNewQualCompletionDate] = useState("");
  const [newQualCourseLevel, setNewQualCourseLevel] = useState<CourseLevel | "">("");
  const [newQualDescription, setNewQualDescription] = useState("");
  const [qualificationDialogOpen, setQualificationDialogOpen] = useState(false);
  const [editingQualification, setEditingQualification] = useState<FacilitatorQualification | null>(null);
  const [editQualificationDialogOpen, setEditQualificationDialogOpen] = useState(false);
  
  // Certificate upload state
  const [uploadingCertificateFor, setUploadingCertificateFor] = useState<string | null>(null);

  // Activities state
  const [newActivityLanguage, setNewActivityLanguage] = useState("");
  const [newActivityChapters, setNewActivityChapters] = useState("0");
  const [newActivityDurationYears, setNewActivityDurationYears] = useState("0");
  const [newActivityDurationMonths, setNewActivityDurationMonths] = useState("0");
  const [newActivityNotes, setNewActivityNotes] = useState("");
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<MentorshipActivity | null>(null);
  const [editActivityDialogOpen, setEditActivityDialogOpen] = useState(false);

  // Reports state
  const [reportPeriodStart, setReportPeriodStart] = useState("");
  const [reportPeriodEnd, setReportPeriodEnd] = useState("");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QuarterlyReport | null>(null);

  // Fetch competencies
  const { data: competencies = [], isLoading: loadingCompetencies } = useQuery<FacilitatorCompetency[]>({
    queryKey: ['/api/facilitator/competencies'],
    enabled: isAuthenticated
  });

  // Fetch qualifications
  const { data: qualifications = [], isLoading: loadingQualifications } = useQuery<FacilitatorQualification[]>({
    queryKey: ['/api/facilitator/qualifications'],
    enabled: isAuthenticated
  });

  // Fetch activities
  const { data: activities = [], isLoading: loadingActivities } = useQuery<MentorshipActivity[]>({
    queryKey: ['/api/facilitator/activities'],
    enabled: isAuthenticated
  });

  // Fetch facilitator profile
  const { data: facilitatorProfile, isLoading: loadingProfile } = useQuery<{ region: string | null; mentorSupervisor: string | null; supervisorId: string | null }>({
    queryKey: ['/api/facilitator/profile'],
    enabled: isAuthenticated
  });

  // Fetch available supervisors
  const { data: supervisors = [], isLoading: loadingSupervisors } = useQuery<Supervisor[]>({
    queryKey: ['/api/supervisors'],
    enabled: isAuthenticated
  });

  // Profile editing state
  const [profileRegion, setProfileRegion] = useState("");
  const [profileSupervisorId, setProfileSupervisorId] = useState<string | undefined>(undefined);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Update competency status mutation
  const updateCompetencyMutation = useMutation({
    mutationFn: async ({ competencyId, status, notes }: { competencyId: CompetencyId; status: CompetencyStatus; notes?: string }) => {
      await apiRequest("POST", "/api/facilitator/competencies", { competencyId, status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/competencies'] });
      toast({
        title: "Success",
        description: "Competency status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update competency",
        variant: "destructive",
      });
    },
  });

  // Recalculate competencies mutation
  const recalculateCompetenciesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/facilitator/recalculate-competencies", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/competencies'] });
      toast({
        title: "Success",
        description: "Competencies recalculated successfully based on your qualifications and activities",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to recalculate competencies",
        variant: "destructive",
      });
    },
  });

  // Analyze chat history mutation
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
      toast({
        title: "Error",
        description: "Failed to analyze chat history",
        variant: "destructive",
      });
    },
  });

  // Apply pending evidence mutation
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
      toast({
        title: "Error",
        description: "Failed to apply pending evidence",
        variant: "destructive",
      });
    },
  });

  // Create qualification mutation
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
      toast({
        title: "Success",
        description: "Qualification added",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add qualification",
        variant: "destructive",
      });
    },
  });

  // Update qualification mutation
  const updateQualificationMutation = useMutation({
    mutationFn: async (data: { id: string; courseTitle: string; institution: string; completionDate: string; courseLevel: CourseLevel; description: string }) => {
      const { id, ...updates } = data;
      await apiRequest("PATCH", `/api/facilitator/qualifications/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/qualifications'] });
      setEditQualificationDialogOpen(false);
      setEditingQualification(null);
      toast({
        title: "Success",
        description: "Qualification updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update qualification",
        variant: "destructive",
      });
    },
  });

  // Delete qualification mutation
  const deleteQualificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facilitator/qualifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/qualifications'] });
      toast({
        title: "Success",
        description: "Qualification removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove qualification",
        variant: "destructive",
      });
    },
  });

  // Upload certificate mutation
  const uploadCertificateMutation = useMutation({
    mutationFn: async ({ qualificationId, file }: { qualificationId: string; file: File }) => {
      const formData = new FormData();
      formData.append('certificate', file);
      
      // Use native fetch for FormData (apiRequest doesn't support FormData)
      const response = await fetch(`/api/facilitator/qualifications/${qualificationId}/certificates`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // CSRF protection header
        },
        credentials: 'include', // Important: include session cookies
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
      // Invalidate certificates cache for this qualification
      queryClient.invalidateQueries({ 
        queryKey: ['/api/facilitator/qualifications', variables.qualificationId, 'certificates'] 
      });
      setUploadingCertificateFor(null);
      toast({
        title: "Success",
        description: "Certificate uploaded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload certificate",
        variant: "destructive",
      });
      setUploadingCertificateFor(null);
    },
  });

  // Delete certificate mutation
  const deleteCertificateMutation = useMutation({
    mutationFn: async ({ qualificationId, attachmentId }: { qualificationId: string; attachmentId: string }) => {
      await apiRequest("DELETE", `/api/facilitator/qualifications/${qualificationId}/certificates/${attachmentId}`);
    },
    onSuccess: (_, variables) => {
      // Invalidate certificates cache for this qualification
      queryClient.invalidateQueries({ 
        queryKey: ['/api/facilitator/qualifications', variables.qualificationId, 'certificates'] 
      });
      toast({
        title: "Success",
        description: "Certificate deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete certificate",
        variant: "destructive",
      });
    },
  });

  // Create activity mutation
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
      toast({
        title: "Success",
        description: "Activity registered",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to register activity",
        variant: "destructive",
      });
    },
  });

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: string; languageName?: string; chaptersCount?: number; durationYears?: number; durationMonths?: number; notes?: string }) => {
      const { id, ...updates } = data;
      await apiRequest("PATCH", `/api/facilitator/activities/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/activities'] });
      setEditActivityDialogOpen(false);
      setEditingActivity(null);
      toast({
        title: "Success",
        description: "Activity updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update activity",
        variant: "destructive",
      });
    },
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facilitator/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/activities'] });
      toast({
        title: "Success",
        description: "Activity removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove activity",
        variant: "destructive",
      });
    },
  });

  // Update facilitator profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { region: string; supervisorId: string | undefined }) => {
      await apiRequest("POST", "/api/facilitator/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/profile'] });
      setIsEditingProfile(false);
      toast({
        title: "Success",
        description: "Profile updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Fetch reports
  const { data: reports = [], isLoading: loadingReports } = useQuery<QuarterlyReport[]>({
    queryKey: ['/api/facilitator/reports'],
    enabled: isAuthenticated
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (data: { periodStart: string; periodEnd: string }) => {
      await apiRequest("POST", "/api/facilitator/reports/generate", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/reports'] });
      setReportDialogOpen(false);
      setReportPeriodStart("");
      setReportPeriodEnd("");
      toast({
        title: "Success",
        description: "Report generated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest("DELETE", `/api/facilitator/reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilitator/reports'] });
      setSelectedReport(null);
      toast({
        title: "Success",
        description: "Report removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove report",
        variant: "destructive",
      });
    },
  });


  // Populate profile form when profile data loads
  useEffect(() => {
    if (facilitatorProfile) {
      setProfileRegion(facilitatorProfile.region || "");
      setProfileSupervisorId(facilitatorProfile.supervisorId || undefined);
    }
  }, [facilitatorProfile]);

  // Calculate competency progress (always out of 11 total competencies)
  const TOTAL_COMPETENCIES = 11;
  const proficientCompetencies = competencies.filter(c => c.status === 'proficient' || c.status === 'advanced');
  const competencyProgress = (proficientCompetencies.length / TOTAL_COMPETENCIES) * 100;

  // Get status for a competency
  const getCompetencyStatus = (competencyId: CompetencyId): CompetencyStatus => {
    const competency = competencies.find(c => c.competencyId === competencyId);
    return (competency?.status as CompetencyStatus) || 'not_started';
  };

  // Get notes for a competency
  const getCompetencyNotes = (competencyId: CompetencyId): string => {
    const competency = competencies.find(c => c.competencyId === competencyId);
    return competency?.notes || '';
  };

  // Get competency data object
  const getCompetencyData = (competencyId: CompetencyId) => {
    return competencies.find(c => c.competencyId === competencyId);
  };

  // Check if competency has a suggestion different from current status
  const hasSuggestion = (competencyId: CompetencyId): boolean => {
    const competency = getCompetencyData(competencyId);
    if (!competency) return false;
    return competency.statusSource === 'manual' && 
           competency.suggestedStatus !== null && 
           competency.suggestedStatus !== competency.status;
  };

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
      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 2xl:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
          {/* Header */}
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

          {/* Competency Overview */}
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full inline-flex md:grid md:grid-cols-6 overflow-x-auto scrollbar-hide justify-start md:justify-center">
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
              <TabsTrigger value="settings" data-testid="tab-settings" className="flex-shrink-0 flex items-center gap-2 md:gap-0">
                <Settings className="h-4 w-4 md:mr-2" />
                <span className="whitespace-nowrap">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Facilitator Profile</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your profile information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingProfile ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="profile-region">Region (optional)</Label>
                        <div className="flex items-center space-x-2 mt-2">
                          <Input
                            id="profile-region"
                            value={profileRegion}
                            onChange={(e) => setProfileRegion(e.target.value)}
                            placeholder="e.g., Northeast Brazil"
                            disabled={!isEditingProfile}
                            data-testid="input-profile-region"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="profile-supervisor">Supervisor (optional)</Label>
                        <div className="mt-2">
                          <Popover open={supervisorPopoverOpen} onOpenChange={setSupervisorPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={supervisorPopoverOpen}
                                className={cn(
                                  "w-full justify-between",
                                  !profileSupervisorId && "text-muted-foreground"
                                )}
                                disabled={!isEditingProfile}
                                data-testid="button-select-supervisor"
                              >
                                {profileSupervisorId
                                  ? supervisors.find((supervisor) => supervisor.id === profileSupervisorId)?.fullName
                                  : "Select supervisor..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search supervisor..." data-testid="input-search-supervisor" />
                                <CommandEmpty>
                                  {loadingSupervisors ? "Loading..." : "No supervisor found."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => {
                                      setProfileSupervisorId(undefined);
                                      setSupervisorPopoverOpen(false);
                                    }}
                                    data-testid="option-supervisor-none"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        !profileSupervisorId ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    No supervisor
                                  </CommandItem>
                                  {supervisors.map((supervisor) => (
                                    <CommandItem
                                      key={supervisor.id}
                                      value={supervisor.fullName}
                                      onSelect={() => {
                                        setProfileSupervisorId(supervisor.id);
                                        setSupervisorPopoverOpen(false);
                                      }}
                                      data-testid={`option-supervisor-${supervisor.id}`}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          supervisor.id === profileSupervisorId
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {supervisor.fullName}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {isEditingProfile ? (
                          <>
                            <Button
                              onClick={() => {
                                updateProfileMutation.mutate({
                                  region: profileRegion,
                                  supervisorId: profileSupervisorId
                                });
                              }}
                              disabled={updateProfileMutation.isPending}
                              data-testid="button-save-profile"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsEditingProfile(false);
                                if (facilitatorProfile) {
                                  setProfileRegion(facilitatorProfile.region || "");
                                  setProfileSupervisorId(facilitatorProfile.supervisorId || undefined);
                                }
                              }}
                              disabled={updateProfileMutation.isPending}
                              data-testid="button-cancel-profile"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => setIsEditingProfile(true)}
                            data-testid="button-edit-profile"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Profile
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Competencies Tab */}
            <TabsContent value="competencies" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5" />
                        <span>Core Competencies</span>
                      </CardTitle>
                      <CardDescription>
                        Track the development of your OBT facilitation competencies
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => analyzeChatHistoryMutation.mutate()}
                        disabled={analyzeChatHistoryMutation.isPending}
                        variant="default"
                        size={isMobile ? "sm" : "default"}
                        data-testid="button-analyze-chat-history"
                      >
                        <MessageSquare className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${analyzeChatHistoryMutation.isPending ? 'animate-spin' : ''}`} />
                        {!isMobile && "Analyze Chats"}
                      </Button>
                      <Button
                        onClick={() => applyPendingEvidenceMutation.mutate()}
                        disabled={applyPendingEvidenceMutation.isPending}
                        variant="secondary"
                        size={isMobile ? "sm" : "default"}
                        data-testid="button-apply-evidence"
                      >
                        <Zap className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${applyPendingEvidenceMutation.isPending ? 'animate-spin' : ''}`} />
                        {!isMobile && "Apply Evidence"}
                      </Button>
                      <Button
                        onClick={() => recalculateCompetenciesMutation.mutate()}
                        disabled={recalculateCompetenciesMutation.isPending}
                        variant="outline"
                        size={isMobile ? "sm" : "default"}
                        data-testid="button-recalculate-competencies"
                      >
                        <RefreshCw className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${recalculateCompetenciesMutation.isPending ? 'animate-spin' : ''}`} />
                        {!isMobile && "Recalculate"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCompetencies ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(Object.keys(CORE_COMPETENCIES) as CompetencyId[]).map((competencyId) => {
                        const status = getCompetencyStatus(competencyId);
                        const notes = getCompetencyNotes(competencyId);
                        const isEditing = editingCompetency === competencyId;
                        const competencyData = getCompetencyData(competencyId);
                        const showSuggestion = hasSuggestion(competencyId);

                        return (
                          <Card key={competencyId} data-testid={`card-competency-${competencyId}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    {status === 'proficient' || status === 'advanced' ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground" />
                                    )}
                                    <h3 className="font-medium" data-testid={`text-competency-name-${competencyId}`}>
                                      {getCompetencyName(competencyId)}
                                    </h3>
                                  </div>
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <Select
                                      value={status}
                                      onValueChange={(value) => updateCompetencyMutation.mutate({ 
                                        competencyId, 
                                        status: value as CompetencyStatus,
                                        notes
                                      })}
                                    >
                                      <SelectTrigger className="w-48" data-testid={`select-status-${competencyId}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {competencyStatusOptions.map(statusOption => (
                                          <SelectItem key={statusOption} value={statusOption}>
                                            {statusLabels[statusOption]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Badge className={statusColors[status]}>
                                      {statusLabels[status]}
                                    </Badge>
                                  </div>
                                  {showSuggestion && competencyData?.suggestedStatus && (
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md" data-testid={`suggestion-${competencyId}`}>
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2 mb-1">
                                            <Zap className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                              System Suggestion
                                            </span>
                                          </div>
                                          <p className="text-sm text-blue-700 dark:text-blue-300">
                                            Based on your qualifications, we suggest: <strong>{statusLabels[competencyData.suggestedStatus as CompetencyStatus]}</strong>
                                          </p>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => updateCompetencyMutation.mutate({ 
                                            competencyId, 
                                            status: competencyData.suggestedStatus as CompetencyStatus,
                                            notes
                                          })}
                                          className="ml-2"
                                          data-testid={`button-accept-suggestion-${competencyId}`}
                                        >
                                          Accept
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {notes && !isEditing && !notes.startsWith('Auto-calculated:') && (
                                    <p className="text-sm text-muted-foreground mt-2" data-testid={`text-competency-notes-${competencyId}`}>
                                      {notes}
                                    </p>
                                  )}
                                  {isEditing && (
                                    <div className="mt-2 space-y-2">
                                      <Textarea
                                        value={tempNotes}
                                        onChange={(e) => setTempNotes(e.target.value)}
                                        placeholder="Add notes about your progress..."
                                        rows={2}
                                      />
                                      <div className="flex space-x-2">
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            updateCompetencyMutation.mutate({ 
                                              competencyId, 
                                              status,
                                              notes: tempNotes
                                            });
                                            setEditingCompetency(null);
                                          }}
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingCompetency(null);
                                            setTempNotes("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {!isEditing && user?.isAdmin && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => {
                                        setTempNotes(notes);
                                        setEditingCompetency(competencyId);
                                      }}
                                      className="mt-2"
                                    >
                                      {notes ? 'Edit Notes' : 'Add Notes'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Qualifications Tab */}
            <TabsContent value="qualifications" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <GraduationCap className="h-5 w-5" />
                        <span>Qualifications</span>
                      </CardTitle>
                      <CardDescription>
                        Manage your formal qualifications and certifications
                      </CardDescription>
                    </div>
                    <Dialog open={qualificationDialogOpen} onOpenChange={setQualificationDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-qualification">
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Qualification</DialogTitle>
                          <DialogDescription>
                            Register a new formal qualification or certification
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="qual-course">Course Title</Label>
                            <Input
                              id="qual-course"
                              value={newQualCourseTitle}
                              onChange={(e) => setNewQualCourseTitle(e.target.value)}
                              placeholder="e.g., OBT Certification"
                              data-testid="input-course-title"
                            />
                          </div>
                          <div>
                            <Label htmlFor="qual-institution">Institution</Label>
                            <Input
                              id="qual-institution"
                              value={newQualInstitution}
                              onChange={(e) => setNewQualInstitution(e.target.value)}
                              placeholder="e.g., YWAM"
                              data-testid="input-institution"
                            />
                          </div>
                          <div>
                            <Label htmlFor="qual-completion">Completion Date</Label>
                            <Input
                              id="qual-completion"
                              type="date"
                              value={newQualCompletionDate}
                              onChange={(e) => setNewQualCompletionDate(e.target.value)}
                              data-testid="input-completion-date"
                            />
                          </div>
                          <div>
                            <Label htmlFor="qual-course-level">Course Level *</Label>
                            <Select value={newQualCourseLevel} onValueChange={(value) => setNewQualCourseLevel(value as CourseLevel)}>
                              <SelectTrigger id="qual-course-level" data-testid="select-course-level">
                                <SelectValue placeholder="Select course level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="introduction">Introduction</SelectItem>
                                <SelectItem value="certificate">Certificate</SelectItem>
                                <SelectItem value="bachelor">Bachelor</SelectItem>
                                <SelectItem value="master">Master</SelectItem>
                                <SelectItem value="doctoral">Doctoral</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="qual-description">Description</Label>
                            <Textarea
                              id="qual-description"
                              value={newQualDescription}
                              onChange={(e) => setNewQualDescription(e.target.value)}
                              placeholder="Brief description of content..."
                              rows={3}
                              data-testid="input-description"
                              required
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (newQualCourseLevel) {
                                createQualificationMutation.mutate({
                                  courseTitle: newQualCourseTitle,
                                  institution: newQualInstitution,
                                  completionDate: newQualCompletionDate,
                                  courseLevel: newQualCourseLevel,
                                  description: newQualDescription
                                });
                              }
                            }}
                            disabled={!newQualCourseTitle.trim() || !newQualInstitution.trim() || !newQualCompletionDate || !newQualCourseLevel || !newQualDescription.trim() || createQualificationMutation.isPending}
                            data-testid="button-confirm-add-qualification"
                          >
                            {createQualificationMutation.isPending ? "Adding..." : "Add Qualification"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingQualifications ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : qualifications.length === 0 ? (
                    <div className="text-center py-8">
                      <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">No qualifications yet</p>
                      <p className="text-xs text-muted-foreground">Add your first qualification</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {qualifications.map((qualification) => (
                        <Card key={qualification.id} data-testid={`card-qualification-${qualification.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Award className="h-5 w-5 text-primary" />
                                  <h3 className="font-medium" data-testid={`text-course-title-${qualification.id}`}>
                                    {qualification.courseTitle}
                                  </h3>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2" data-testid={`text-institution-${qualification.id}`}>
                                  {qualification.institution}
                                </p>
                                <div className="flex items-center space-x-3 text-sm mb-2 flex-wrap">
                                  {qualification.courseLevel && (
                                    <Badge variant="secondary" data-testid={`badge-course-level-${qualification.id}`}>
                                      {qualification.courseLevel.charAt(0).toUpperCase() + qualification.courseLevel.slice(1)}
                                    </Badge>
                                  )}
                                  {qualification.completionDate && (
                                    <span className="text-muted-foreground" data-testid={`text-completion-date-${qualification.id}`}>
                                      {new Date(qualification.completionDate).toLocaleDateString('en-US')}
                                    </span>
                                  )}
                                </div>
                                {qualification.description && (
                                  <p className="text-sm text-muted-foreground mb-3" data-testid={`text-description-${qualification.id}`}>
                                    {qualification.description}
                                  </p>
                                )}
                                
                                <QualificationCertificates
                                  qualificationId={qualification.id}
                                  uploadCertificateMutation={uploadCertificateMutation}
                                  deleteCertificateMutation={deleteCertificateMutation}
                                  uploadingCertificateFor={uploadingCertificateFor}
                                />
                              </div>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingQualification(qualification);
                                    setEditQualificationDialogOpen(true);
                                  }}
                                  data-testid={`button-edit-qualification-${qualification.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteQualificationMutation.mutate(qualification.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-qualification-${qualification.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Qualification Dialog */}
              <Dialog open={editQualificationDialogOpen} onOpenChange={setEditQualificationDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Qualification</DialogTitle>
                    <DialogDescription>
                      Update the details of this qualification
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-qual-title">Course Title</Label>
                      <Input
                        id="edit-qual-title"
                        value={editingQualification?.courseTitle || ""}
                        onChange={(e) => setEditingQualification(prev => prev ? { ...prev, courseTitle: e.target.value } : null)}
                        placeholder="e.g., OBT Facilitator Training"
                        data-testid="input-edit-course-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-qual-institution">Institution</Label>
                      <Input
                        id="edit-qual-institution"
                        value={editingQualification?.institution || ""}
                        onChange={(e) => setEditingQualification(prev => prev ? { ...prev, institution: e.target.value } : null)}
                        placeholder="e.g., YWAM"
                        data-testid="input-edit-institution"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-qual-date">Completion Date</Label>
                      <Input
                        id="edit-qual-date"
                        type="date"
                        value={editingQualification?.completionDate ? new Date(editingQualification.completionDate).toISOString().split('T')[0] : ""}
                        onChange={(e) => setEditingQualification(prev => prev ? { ...prev, completionDate: new Date(e.target.value) } : null)}
                        data-testid="input-edit-completion-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-qual-course-level">Course Level *</Label>
                      <Select 
                        value={editingQualification?.courseLevel || ""} 
                        onValueChange={(value) => setEditingQualification(prev => prev ? { ...prev, courseLevel: value as CourseLevel } : null)}
                      >
                        <SelectTrigger id="edit-qual-course-level" data-testid="select-edit-course-level">
                          <SelectValue placeholder="Select course level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="introduction">Introduction</SelectItem>
                          <SelectItem value="certificate">Certificate</SelectItem>
                          <SelectItem value="bachelor">Bachelor</SelectItem>
                          <SelectItem value="master">Master</SelectItem>
                          <SelectItem value="doctoral">Doctoral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-qual-description">Description</Label>
                      <Textarea
                        id="edit-qual-description"
                        value={editingQualification?.description || ""}
                        onChange={(e) => setEditingQualification(prev => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="Brief description of content..."
                        rows={3}
                        data-testid="input-edit-description"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (editingQualification && editingQualification.completionDate && editingQualification.courseLevel) {
                          updateQualificationMutation.mutate({
                            id: editingQualification.id,
                            courseTitle: editingQualification.courseTitle,
                            institution: editingQualification.institution,
                            completionDate: new Date(editingQualification.completionDate).toISOString().split('T')[0],
                            courseLevel: editingQualification.courseLevel,
                            description: editingQualification.description
                          });
                        }
                      }}
                      disabled={!editingQualification?.courseTitle?.trim() || !editingQualification?.institution?.trim() || !editingQualification?.completionDate || !editingQualification?.courseLevel || !editingQualification?.description?.trim() || updateQualificationMutation.isPending}
                      data-testid="button-confirm-edit-qualification"
                    >
                      {updateQualificationMutation.isPending ? "Updating..." : "Update Qualification"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Activities Tab */}
            <TabsContent value="activities" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="h-5 w-5" />
                        <span>Activities and Experiences</span>
                      </CardTitle>
                      <CardDescription>
                        Register translations and other work experiences (AI can add general experiences)
                      </CardDescription>
                    </div>
                    <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-activity">
                          <Plus className="h-4 w-4 mr-2" />
                          Register
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Register Activity</DialogTitle>
                          <DialogDescription>
                            Register a new Bible translation activity
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="activity-language">Language Name</Label>
                            <Input
                              id="activity-language"
                              value={newActivityLanguage}
                              onChange={(e) => setNewActivityLanguage(e.target.value)}
                              placeholder="e.g., Karajá, Yanomami"
                              data-testid="input-language-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="activity-chapters">Number of Chapters</Label>
                            <Input
                              id="activity-chapters"
                              type="number"
                              min="0"
                              value={newActivityChapters}
                              onChange={(e) => setNewActivityChapters(e.target.value)}
                              data-testid="input-chapters-count"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="activity-duration-years">Duration (Years)</Label>
                              <Input
                                id="activity-duration-years"
                                type="number"
                                min="0"
                                value={newActivityDurationYears}
                                onChange={(e) => setNewActivityDurationYears(e.target.value)}
                                data-testid="input-duration-years"
                              />
                            </div>
                            <div>
                              <Label htmlFor="activity-duration-months">Duration (Months)</Label>
                              <Input
                                id="activity-duration-months"
                                type="number"
                                min="0"
                                max="11"
                                value={newActivityDurationMonths}
                                onChange={(e) => setNewActivityDurationMonths(e.target.value)}
                                data-testid="input-duration-months"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="activity-notes">Notes (optional)</Label>
                            <Textarea
                              id="activity-notes"
                              value={newActivityNotes}
                              onChange={(e) => setNewActivityNotes(e.target.value)}
                              placeholder="Additional context about the activity..."
                              rows={4}
                              data-testid="input-activity-notes"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => createActivityMutation.mutate({
                              languageName: newActivityLanguage,
                              chaptersCount: parseInt(newActivityChapters) || 0,
                              durationYears: parseInt(newActivityDurationYears) || 0,
                              durationMonths: parseInt(newActivityDurationMonths) || 0,
                              notes: newActivityNotes || undefined
                            })}
                            disabled={!newActivityLanguage.trim() || createActivityMutation.isPending}
                            data-testid="button-confirm-add-activity"
                          >
                            {createActivityMutation.isPending ? "Registering..." : "Register Activity"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingActivities ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">No activities yet</p>
                      <p className="text-xs text-muted-foreground">Register your first translation activity</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <Card key={activity.id} data-testid={`card-activity-${activity.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {/* Translation Activity */}
                                {(activity.activityType === 'translation' || !activity.activityType) && (
                                  <>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Calendar className="h-5 w-5 text-primary" />
                                      <h3 className="font-medium" data-testid={`text-language-name-${activity.id}`}>
                                        {activity.title || activity.languageName || 'Bible Translation Work'}
                                      </h3>
                                    </div>
                                    <div className="flex items-center space-x-3 text-sm mb-2">
                                      {activity.languageName && !activity.title && (
                                        <Badge variant="outline">{activity.languageName}</Badge>
                                      )}
                                      {activity.chaptersCount && (
                                        <Badge>{activity.chaptersCount} chapter(s)</Badge>
                                      )}
                                      {activity.activityDate && (
                                        <span className="text-muted-foreground" data-testid={`text-activity-date-${activity.id}`}>
                                          {new Date(activity.activityDate).toLocaleDateString('en-US')}
                                        </span>
                                      )}
                                    </div>
                                    {(activity.notes || activity.description) && (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-activity-notes-${activity.id}`}>
                                        {activity.notes || activity.description}
                                      </p>
                                    )}
                                  </>
                                )}

                                {/* General Experience Activity */}
                                {activity.activityType && activity.activityType !== 'translation' && (
                                  <>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Calendar className="h-5 w-5 text-primary" />
                                      <h3 className="font-medium" data-testid={`text-activity-title-${activity.id}`}>
                                        {activity.title || 'Professional Experience'}
                                      </h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                                      <Badge variant="outline">
                                        {activity.activityType === 'facilitation' ? 'Facilitation' :
                                         activity.activityType === 'teaching' ? 'Teaching' :
                                         activity.activityType === 'indigenous_work' ? 'Work with People Groups' :
                                         activity.activityType === 'school_work' ? 'School Work' :
                                         'General Experience'}
                                      </Badge>
                                      {activity.organization && (
                                        <span className="text-muted-foreground" data-testid={`text-organization-${activity.id}`}>
                                          {activity.organization}
                                        </span>
                                      )}
                                      {activity.yearsOfExperience && (
                                        <span className="text-muted-foreground">
                                          {activity.yearsOfExperience} {activity.yearsOfExperience === 1 ? 'year' : 'years'}
                                        </span>
                                      )}
                                      {activity.activityDate && (
                                        <span className="text-muted-foreground" data-testid={`text-activity-date-${activity.id}`}>
                                          {new Date(activity.activityDate).toLocaleDateString('en-US')}
                                        </span>
                                      )}
                                    </div>
                                    {activity.description && (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-activity-description-${activity.id}`}>
                                        {activity.description}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingActivity(activity);
                                    setEditActivityDialogOpen(true);
                                  }}
                                  data-testid={`button-edit-activity-${activity.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteActivityMutation.mutate(activity.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-activity-${activity.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Activity Dialog */}
              <Dialog open={editActivityDialogOpen} onOpenChange={setEditActivityDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Activity</DialogTitle>
                    <DialogDescription>
                      Update the details of this activity
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Activity Type */}
                    <div>
                      <Label htmlFor="edit-activity-type">Activity Type</Label>
                      <Select
                        value={editingActivity?.activityType || 'translation'}
                        onValueChange={(value) => setEditingActivity(prev => prev ? { ...prev, activityType: value as any } : null)}
                      >
                        <SelectTrigger id="edit-activity-type" data-testid="select-edit-activity-type">
                          <SelectValue placeholder="Select activity type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="translation">Translation</SelectItem>
                          <SelectItem value="facilitation">Facilitation</SelectItem>
                          <SelectItem value="teaching">Teaching</SelectItem>
                          <SelectItem value="indigenous_work">Work with People Groups</SelectItem>
                          <SelectItem value="school_work">School Work</SelectItem>
                          <SelectItem value="general_experience">General Experience</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Translation-specific fields */}
                    {(editingActivity?.activityType === 'translation' || !editingActivity?.activityType) && (
                      <>
                        <div>
                          <Label htmlFor="edit-activity-language">Language Name</Label>
                          <Input
                            id="edit-activity-language"
                            value={editingActivity?.languageName || ""}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, languageName: e.target.value } : null)}
                            placeholder="e.g., Portuguese, Spanish"
                            data-testid="input-edit-language"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-activity-chapters">Chapters Translated</Label>
                          <Input
                            id="edit-activity-chapters"
                            type="number"
                            min="0"
                            value={editingActivity?.chaptersCount || 0}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, chaptersCount: parseInt(e.target.value) || 0 } : null)}
                            data-testid="input-edit-chapters"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-duration-years">Duration (Years)</Label>
                            <Input
                              id="edit-duration-years"
                              type="number"
                              min="0"
                              value={editingActivity?.durationYears || 0}
                              onChange={(e) => setEditingActivity(prev => prev ? { ...prev, durationYears: parseInt(e.target.value) || 0 } : null)}
                              data-testid="input-edit-duration-years"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-duration-months">Duration (Months)</Label>
                            <Input
                              id="edit-duration-months"
                              type="number"
                              min="0"
                              max="11"
                              value={editingActivity?.durationMonths || 0}
                              onChange={(e) => setEditingActivity(prev => prev ? { ...prev, durationMonths: parseInt(e.target.value) || 0 } : null)}
                              data-testid="input-edit-duration-months"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="edit-activity-notes">Notes</Label>
                          <Textarea
                            id="edit-activity-notes"
                            value={editingActivity?.notes || ""}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, notes: e.target.value } : null)}
                            placeholder="Additional context about the activity..."
                            rows={4}
                            data-testid="input-edit-notes"
                          />
                        </div>
                      </>
                    )}

                    {/* General experience fields */}
                    {editingActivity?.activityType && editingActivity.activityType !== 'translation' && (
                      <>
                        <div>
                          <Label htmlFor="edit-activity-title">Title</Label>
                          <Input
                            id="edit-activity-title"
                            value={editingActivity?.title || ""}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, title: e.target.value } : null)}
                            placeholder="e.g., Translation Facilitator"
                            data-testid="input-edit-title"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-activity-organization">Organization</Label>
                          <Input
                            id="edit-activity-organization"
                            value={editingActivity?.organization || ""}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, organization: e.target.value } : null)}
                            placeholder="e.g., YWAM"
                            data-testid="input-edit-organization"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-years-experience">Years of Experience</Label>
                          <Input
                            id="edit-years-experience"
                            type="number"
                            min="0"
                            step="0.5"
                            value={editingActivity?.yearsOfExperience || 0}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, yearsOfExperience: parseFloat(e.target.value) || 0 } : null)}
                            data-testid="input-edit-years-experience"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-activity-description">Description</Label>
                          <Textarea
                            id="edit-activity-description"
                            value={editingActivity?.description || ""}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, description: e.target.value } : null)}
                            placeholder="Describe your experience..."
                            rows={4}
                            data-testid="input-edit-description"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-activity-date">Activity Date</Label>
                          <Input
                            id="edit-activity-date"
                            type="date"
                            value={editingActivity?.activityDate ? new Date(editingActivity.activityDate).toISOString().split('T')[0] : ""}
                            onChange={(e) => setEditingActivity(prev => prev ? { ...prev, activityDate: e.target.value ? new Date(e.target.value) : null } : null)}
                            data-testid="input-edit-activity-date"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditActivityDialogOpen(false);
                        setEditingActivity(null);
                      }}
                      data-testid="button-cancel-edit-activity"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingActivity) {
                          const updates: any = {
                            id: editingActivity.id,
                            activityType: editingActivity.activityType || 'translation',
                          };

                          if (editingActivity.activityType === 'translation' || !editingActivity.activityType) {
                            updates.languageName = editingActivity.languageName || undefined;
                            updates.chaptersCount = editingActivity.chaptersCount || undefined;
                            updates.durationYears = editingActivity.durationYears || undefined;
                            updates.durationMonths = editingActivity.durationMonths || undefined;
                            updates.notes = editingActivity.notes || undefined;
                          } else {
                            updates.title = editingActivity.title || undefined;
                            updates.organization = editingActivity.organization || undefined;
                            updates.yearsOfExperience = editingActivity.yearsOfExperience || undefined;
                            updates.description = editingActivity.description || undefined;
                            updates.activityDate = editingActivity.activityDate || undefined;
                          }

                          updateActivityMutation.mutate(updates);
                        }
                      }}
                      disabled={updateActivityMutation.isPending}
                      data-testid="button-confirm-edit-activity"
                    >
                      {updateActivityMutation.isPending ? "Updating..." : "Update Activity"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5" />
                        <span>Quarterly Reports</span>
                      </CardTitle>
                      <CardDescription>
                        Generate and view quarterly progress reports
                      </CardDescription>
                    </div>
                    <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-generate-report">
                          <Plus className="h-4 w-4 mr-2" />
                          Generate Report
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Generate Quarterly Report</DialogTitle>
                          <DialogDescription>
                            Select the period for the report
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="report-start">Period Start</Label>
                            <Input
                              id="report-start"
                              type="date"
                              value={reportPeriodStart}
                              onChange={(e) => setReportPeriodStart(e.target.value)}
                              data-testid="input-period-start"
                            />
                          </div>
                          <div>
                            <Label htmlFor="report-end">Period End</Label>
                            <Input
                              id="report-end"
                              type="date"
                              value={reportPeriodEnd}
                              onChange={(e) => setReportPeriodEnd(e.target.value)}
                              data-testid="input-period-end"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => generateReportMutation.mutate({
                              periodStart: reportPeriodStart,
                              periodEnd: reportPeriodEnd
                            })}
                            disabled={!reportPeriodStart || !reportPeriodEnd || generateReportMutation.isPending}
                            data-testid="button-confirm-generate-report"
                          >
                            {generateReportMutation.isPending ? "Generating..." : "Generate Report"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingReports ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">No reports yet</p>
                      <p className="text-xs text-muted-foreground">Generate your first quarterly report</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reports.map((report) => {
                        const reportData = report.reportData as any;
                        return (
                          <Card key={report.id} data-testid={`card-report-${report.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <h3 className="font-medium" data-testid={`text-report-period-${report.id}`}>
                                      Report: {new Date(report.periodStart).toLocaleDateString('en-US')} - {new Date(report.periodEnd).toLocaleDateString('en-US')}
                                    </h3>
                                  </div>
                                  <div className="text-sm text-muted-foreground mb-3">
                                    Generated on: {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-US') : 'N/A'}
                                  </div>
                                  
                                  {selectedReport?.id === report.id && reportData && (
                                    <div className="mt-4 space-y-4 border-t pt-4">
                                      {/* Summary */}
                                      <div>
                                        <h4 className="font-medium mb-2">Summary</h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                          <div>
                                            <span className="text-muted-foreground">Completed Competencies:</span>{' '}
                                            <span className="font-medium">{reportData.summary?.completedCompetencies || 0} / {reportData.summary?.totalCompetencies || 0}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Qualifications:</span>{' '}
                                            <span className="font-medium">{reportData.summary?.totalQualifications || 0}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Activities:</span>{' '}
                                            <span className="font-medium">{reportData.summary?.totalActivities || 0}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Translated Chapters:</span>{' '}
                                            <span className="font-medium">{reportData.summary?.totalChapters || 0}</span>
                                          </div>
                                        </div>
                                        {reportData.summary?.languages && reportData.summary.languages.length > 0 && (
                                          <div className="mt-2">
                                            <span className="text-sm text-muted-foreground">Languages:</span>{' '}
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {reportData.summary.languages.map((lang: string, idx: number) => (
                                                <Badge key={idx} variant="secondary">{lang}</Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Competencies */}
                                      {reportData.competencies && reportData.competencies.length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2">Competencies ({reportData.competencies.length})</h4>
                                          <div className="space-y-1 text-sm">
                                            {reportData.competencies.slice(0, 5).map((comp: any, idx: number) => (
                                              <div key={idx} className="flex justify-between">
                                                <span>{getCompetencyName(comp.competencyId as CompetencyId)}</span>
                                                <Badge variant="outline" className="text-xs">
                                                  {statusLabels[comp.status as CompetencyStatus]}
                                                </Badge>
                                              </div>
                                            ))}
                                            {reportData.competencies.length > 5 && (
                                              <p className="text-xs text-muted-foreground italic">
                                                +{reportData.competencies.length - 5} more...
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Activities */}
                                      {reportData.activities && reportData.activities.length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2">Period Activities ({reportData.activities.length})</h4>
                                          <div className="space-y-1 text-sm">
                                            {reportData.activities.slice(0, 3).map((act: any, idx: number) => (
                                              <div key={idx} className="flex justify-between">
                                                <span>{act.languageName}</span>
                                                <span className="text-muted-foreground">{act.chaptersCount} ch.</span>
                                              </div>
                                            ))}
                                            {reportData.activities.length > 3 && (
                                              <p className="text-xs text-muted-foreground italic">
                                                +{reportData.activities.length - 3} more...
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="flex space-x-2 mt-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                                      data-testid={`button-toggle-report-${report.id}`}
                                    >
                                      {selectedReport?.id === report.id ? 'Hide Details' : 'View Details'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={async () => {
                                        try {
                                          const response = await fetch(`/api/facilitator/reports/${report.id}/download`, {
                                            credentials: 'include',
                                          });
                                          
                                          if (!response.ok) {
                                            throw new Error('Failed to download report');
                                          }
                                          
                                          const blob = await response.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `relatorio-${new Date(report.periodStart).toISOString().split('T')[0]}.docx`;
                                          document.body.appendChild(a);
                                          a.click();
                                          window.URL.revokeObjectURL(url);
                                          document.body.removeChild(a);
                                        } catch (error) {
                                          toast({
                                            title: "Error",
                                            description: "Could not download the report",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                      data-testid={`button-download-report-${report.id}`}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Download .docx
                                    </Button>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteReportMutation.mutate(report.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-report-${report.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-6">
              <div className="space-y-6">
                {/* Profile Image Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <ImageIcon className="h-5 w-5" />
                      <span>Profile Image</span>
                    </CardTitle>
                    <CardDescription>
                      Upload a profile picture for your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProfileImageUpload />
                  </CardContent>
                </Card>

                {/* Change Password Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Lock className="h-5 w-5" />
                      <span>Change Password</span>
                    </CardTitle>
                    <CardDescription>
                      Update your account password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChangePasswordForm />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// Profile Image Upload Component
function ProfileImageUpload() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.profileImageUrl || null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WEBP, or GIF image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      
      // Upload to backend
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/user/profile-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      
      // Update preview
      setPreviewUrl(data.profileImageUrl);
      
      // Refresh user data
      await refreshUser();

      toast({
        title: "Success",
        description: "Profile image updated successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload profile image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="h-32 w-32 rounded-full overflow-hidden bg-muted flex items-center justify-center">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Profile" 
              className="h-full w-full object-cover"
              data-testid="img-profile-preview"
            />
          ) : (
            <User className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
      </div>

      <div>
        <input
          type="file"
          id="profile-image-upload"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageUpload}
          disabled={uploading}
        />
        <Button
          onClick={() => document.getElementById('profile-image-upload')?.click()}
          disabled={uploading}
          data-testid="button-upload-profile-image"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Image"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Recommended: Square image, max 5MB (JPEG, PNG, WEBP, or GIF)
      </p>
    </div>
  );
}

// Change Password Form Component
function ChangePasswordForm() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "New password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="current-password">Current Password</Label>
        <div className="relative mt-2">
          <Input
            id="current-password"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            data-testid="input-current-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowCurrent(!showCurrent)}
            data-testid="button-toggle-current-password"
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="new-password">New Password</Label>
        <div className="relative mt-2">
          <Input
            id="new-password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            data-testid="input-new-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowNew(!showNew)}
            data-testid="button-toggle-new-password"
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <div className="relative mt-2">
          <Input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            data-testid="input-confirm-new-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowConfirm(!showConfirm)}
            data-testid="button-toggle-confirm-password"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Button 
        type="submit" 
        disabled={loading}
        data-testid="button-change-password"
      >
        {loading ? "Changing..." : "Change Password"}
      </Button>
    </form>
  );
}

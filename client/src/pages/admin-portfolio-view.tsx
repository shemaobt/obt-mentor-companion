import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2,
  Circle,
  Target,
  GraduationCap,
  Activity,
  FileText,
  User,
  Sparkles,
  Download,
  Calendar,
  Edit,
  Save,
  X,
  Menu,
  Plus
} from "lucide-react";
import { 
  CORE_COMPETENCIES,
  getCompetencyName,
  type CompetencyId,
  type FacilitatorCompetency, 
  type FacilitatorQualification, 
  type MentorshipActivity,
  type QuarterlyReport
} from "@shared/schema";

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

interface AdminPortfolioProps {
  params: {
    userId: string;
  };
}

export default function AdminPortfolioView({ params }: AdminPortfolioProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("competencies");
  const userId = params.userId;
  
  // Determine if this is supervisor view based on URL
  const isSupervisorView = window.location.pathname.includes('/supervisor/');
  
  // Competency editing state
  const [editingCompetency, setEditingCompetency] = useState<CompetencyId | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  
  // Report generation state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPeriodStart, setReportPeriodStart] = useState("");
  const [reportPeriodEnd, setReportPeriodEnd] = useState("");

  // Fetch competencies for the user
  const { data: competencies = [], isLoading: loadingCompetencies } = useQuery<FacilitatorCompetency[]>({
    queryKey: ['/api/admin/users', userId, 'competencies'],
    enabled: isAuthenticated && !!userId
  });

  // Fetch qualifications for the user
  const { data: qualifications = [], isLoading: loadingQualifications } = useQuery<FacilitatorQualification[]>({
    queryKey: ['/api/admin/users', userId, 'qualifications'],
    enabled: isAuthenticated && !!userId
  });

  // Fetch activities for the user
  const { data: activities = [], isLoading: loadingActivities } = useQuery<MentorshipActivity[]>({
    queryKey: ['/api/admin/users', userId, 'activities'],
    enabled: isAuthenticated && !!userId
  });

  // Fetch reports for the user
  const { data: reports = [], isLoading: loadingReports } = useQuery<QuarterlyReport[]>({
    queryKey: ['/api/admin/users', userId, 'reports'],
    enabled: isAuthenticated && !!userId
  });

  // Fetch facilitator profile for the user
  const { data: facilitatorProfile, isLoading: loadingProfile } = useQuery<{ region: string | null; mentorSupervisor: string | null; totalLanguagesMentored?: number; totalChaptersMentored?: number }>({
    queryKey: ['/api/admin/users', userId, 'profile'],
    enabled: isAuthenticated && !!userId
  });

  // Calculate competency progress
  const competencyProgress = Object.keys(CORE_COMPETENCIES).length > 0
    ? (competencies.filter(c => c.status === 'proficient' || c.status === 'advanced').length / Object.keys(CORE_COMPETENCIES).length) * 100
    : 0;

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
  
  // Update competency mutation
  const updateCompetencyMutation = useMutation({
    mutationFn: async ({ competencyId, status, notes }: { competencyId: CompetencyId; status: CompetencyStatus; notes?: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/competencies`, { competencyId, status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'competencies'] });
      toast({
        title: "Success",
        description: "Competency updated successfully",
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

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/generate-report`, { periodStart, periodEnd });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'reports'] });
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

  // Get competency data object
  const getCompetencyData = (competencyId: CompetencyId) => {
    return competencies.find(c => c.competencyId === competencyId);
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
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-admin-portfolio">
      {/* Sidebar - Hidden on mobile by default */}
      <div className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } w-4/5 max-w-sm`
          : 'h-screen w-80'
        }
      `}>
        <Sidebar 
          isMobile={isMobile}
          isOpen={isMobile ? sidebarOpen : true}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
          data-testid="overlay-sidebar"
        />
      )}
      
      <div className={`flex-1 h-screen overflow-y-auto ${isMobile ? 'p-4' : 'p-8'}`}>
        <div className={`${isMobile ? 'max-w-full' : 'max-w-7xl'} mx-auto`}>
          {/* Header */}
          <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="min-h-[44px] min-w-[44px]"
                  data-testid="button-open-sidebar"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
                  Facilitator Portfolio {isSupervisorView ? '(Supervisor View)' : '(Admin View)'}
                </h1>
                <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>
                  {isSupervisorView ? 'View and manage supervised facilitator portfolio' : 'Read-only view of facilitator portfolio'}
                </p>
              </div>
            </div>
          </div>

          {/* Competency Overview */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Competency Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(competencyProgress)}%</span>
              </div>
              <Progress value={competencyProgress} className="h-2" />
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="competencies" data-testid="tab-competencies">
                <Target className="h-4 w-4 mr-2" />
                {!isMobile && "Competencies"}
              </TabsTrigger>
              <TabsTrigger value="qualifications" data-testid="tab-qualifications">
                <GraduationCap className="h-4 w-4 mr-2" />
                {!isMobile && "Qualifications"}
              </TabsTrigger>
              <TabsTrigger value="activities" data-testid="tab-activities">
                <Activity className="h-4 w-4 mr-2" />
                {!isMobile && "Activities"}
              </TabsTrigger>
              <TabsTrigger value="reports" data-testid="tab-reports">
                <FileText className="h-4 w-4 mr-2" />
                {!isMobile && "Reports"}
              </TabsTrigger>
            </TabsList>

            {/* Competencies Tab */}
            <TabsContent value="competencies" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Core Competencies</span>
                  </CardTitle>
                  <CardDescription>
                    OBT facilitation competencies
                  </CardDescription>
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
                                  </div>
                                  {!isEditing && notes && (
                                    <div className="mt-2 flex items-start justify-between">
                                      <p className="text-sm text-muted-foreground flex-1">
                                        {notes}
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingCompetency(competencyId);
                                          setTempNotes(notes);
                                        }}
                                        data-testid={`button-edit-notes-${competencyId}`}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  {!isEditing && !notes && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingCompetency(competencyId);
                                        setTempNotes('');
                                      }}
                                      className="mt-2"
                                      data-testid={`button-add-notes-${competencyId}`}
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
                                      Add Notes
                                    </Button>
                                  )}
                                  {isEditing && (
                                    <div className="mt-2 space-y-2">
                                      <Textarea
                                        value={tempNotes}
                                        onChange={(e) => setTempNotes(e.target.value)}
                                        placeholder="Add notes about this competency..."
                                        className="min-h-[80px]"
                                        data-testid={`textarea-notes-${competencyId}`}
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
                                          data-testid={`button-save-notes-${competencyId}`}
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingCompetency(null)}
                                          data-testid={`button-cancel-notes-${competencyId}`}
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
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
                  <CardTitle className="flex items-center space-x-2">
                    <GraduationCap className="h-5 w-5" />
                    <span>Qualifications</span>
                  </CardTitle>
                  <CardDescription>
                    Completed courses and certifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingQualifications ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : qualifications.length === 0 ? (
                    <div className="text-center py-8">
                      <GraduationCap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No qualifications recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {qualifications.map((qualification) => (
                        <Card key={qualification.id}>
                          <CardContent className="p-4">
                            <h3 className="font-medium text-foreground">{qualification.courseTitle}</h3>
                            <p className="text-sm text-muted-foreground">{qualification.institution}</p>
                            <div className="flex items-center space-x-2 mt-2">
                              {qualification.courseLevel && (
                                <Badge variant="secondary">
                                  {qualification.courseLevel.charAt(0).toUpperCase() + qualification.courseLevel.slice(1)}
                                </Badge>
                              )}
                              {qualification.completionDate && (
                                <Badge variant="outline">
                                  {new Date(qualification.completionDate).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                            {qualification.description && (
                              <p className="text-sm text-muted-foreground mt-2">{qualification.description}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activities Tab */}
            <TabsContent value="activities" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Activities and Experiences</span>
                  </CardTitle>
                  <CardDescription>
                    Record of translation work and general experiences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingActivities ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No activities recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <Card key={activity.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {/* Translation Activity */}
                                {(activity.activityType === 'translation' || !activity.activityType) && (
                                  <>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Calendar className="h-5 w-5 text-primary" />
                                      <h3 className="font-medium text-foreground">{activity.languageName}</h3>
                                    </div>
                                    <div className="flex items-center space-x-3 text-sm mb-2">
                                      <Badge>{activity.chaptersCount} chapter(s)</Badge>
                                      {activity.activityDate && (
                                        <span className="text-muted-foreground">
                                          {new Date(activity.activityDate).toLocaleDateString('en-US')}
                                        </span>
                                      )}
                                    </div>
                                    {activity.notes && (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.notes}</p>
                                    )}
                                  </>
                                )}

                                {/* General Experience Activity */}
                                {activity.activityType && activity.activityType !== 'translation' && (
                                  <>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Calendar className="h-5 w-5 text-primary" />
                                      <h3 className="font-medium text-foreground">
                                        {activity.title || 'Professional Experience'}
                                      </h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                                      <Badge variant="outline">
                                        {activity.activityType === 'facilitation' ? 'Facilitation' :
                                         activity.activityType === 'teaching' ? 'Teaching' :
                                         activity.activityType === 'indigenous_work' ? 'Work with Indigenous Peoples' :
                                         activity.activityType === 'school_work' ? 'School Work' :
                                         'General Experience'}
                                      </Badge>
                                      {activity.organization && (
                                        <span className="text-muted-foreground">{activity.organization}</span>
                                      )}
                                      {activity.yearsOfExperience && (
                                        <span className="text-muted-foreground">
                                          {activity.yearsOfExperience} {activity.yearsOfExperience === 1 ? 'year' : 'years'}
                                        </span>
                                      )}
                                      {activity.activityDate && (
                                        <span className="text-muted-foreground">
                                          {new Date(activity.activityDate).toLocaleDateString('en-US')}
                                        </span>
                                      )}
                                    </div>
                                    {activity.description && (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.description}</p>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                            <Label htmlFor="periodStart">Period Start</Label>
                            <Input
                              id="periodStart"
                              type="date"
                              value={reportPeriodStart}
                              onChange={(e) => setReportPeriodStart(e.target.value)}
                              data-testid="input-period-start"
                            />
                          </div>
                          <div>
                            <Label htmlFor="periodEnd">Period End</Label>
                            <Input
                              id="periodEnd"
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
                      <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No reports generated</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reports.map((report) => (
                        <Card key={report.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-foreground mb-1">
                                  Report {new Date(report.periodStart).toLocaleDateString('en-US')} - {new Date(report.periodEnd).toLocaleDateString('en-US')}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Generated on {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-US') : 'Unknown date'}
                                </p>
                                <div className="mt-3">
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
                                        a.download = `report-${new Date(report.periodStart).toISOString().split('T')[0]}.docx`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Could not download report",
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
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

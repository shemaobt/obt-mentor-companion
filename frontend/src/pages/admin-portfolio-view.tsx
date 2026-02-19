import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, GraduationCap, Activity, FileText, Menu } from "lucide-react";
import { 
  CORE_COMPETENCIES,
  type CompetencyId,
  type FacilitatorCompetency, 
  type FacilitatorQualification, 
  type MentorshipActivity,
  type QuarterlyReport
} from "@shared/schema";
import {
  AdminCompetenciesTab,
  AdminQualificationsTab,
  AdminActivitiesTab,
  AdminReportsTab,
  ConfirmStatusChangeDialog,
  type CompetencyStatus,
  type PendingStatusChange,
  type FacilitatorProfileData,
  getCompetencyStatus,
  getCompetencyNotes
} from "@/components/admin-portfolio";

interface AdminPortfolioProps {
  params: {
    userId: string;
  };
}

export default function AdminPortfolioView({ params }: AdminPortfolioProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("competencies");
  const userId = params.userId;
  
  const isSupervisorView = window.location.pathname.includes('/supervisor/');
  
  const [editingCompetency, setEditingCompetency] = useState<CompetencyId | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [changeReason, setChangeReason] = useState("");
  
  const [expandedHistory, setExpandedHistory] = useState<CompetencyId | null>(null);
  
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPeriodStart, setReportPeriodStart] = useState("");
  const [reportPeriodEnd, setReportPeriodEnd] = useState("");

  const { data: competencies = [], isLoading: loadingCompetencies } = useQuery<FacilitatorCompetency[]>({
    queryKey: ['/api/admin/users', userId, 'competencies'],
    enabled: isAuthenticated && !!userId
  });

  const { data: qualifications = [], isLoading: loadingQualifications } = useQuery<FacilitatorQualification[]>({
    queryKey: ['/api/admin/users', userId, 'qualifications'],
    enabled: isAuthenticated && !!userId
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery<MentorshipActivity[]>({
    queryKey: ['/api/admin/users', userId, 'activities'],
    enabled: isAuthenticated && !!userId
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery<QuarterlyReport[]>({
    queryKey: ['/api/admin/users', userId, 'reports'],
    enabled: isAuthenticated && !!userId
  });

  const competencyProgress = Object.keys(CORE_COMPETENCIES).length > 0
    ? (competencies.filter(c => c.status === 'proficient' || c.status === 'advanced').length / Object.keys(CORE_COMPETENCIES).length) * 100
    : 0;
  
  const updateCompetencyMutation = useMutation({
    mutationFn: async ({ competencyId, status, notes }: { competencyId: CompetencyId; status: CompetencyStatus; notes?: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/competencies`, { competencyId, status, notes });
      return response.json();
    },
    onSuccess: async (updatedCompetency: FacilitatorCompetency) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'competencies'] });
      
      if (updatedCompetency?.id) {
        await queryClient.invalidateQueries({ 
          queryKey: ['/api/admin/users', userId, 'competencies', updatedCompetency.id, 'history'] 
        });
      }
      
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

  const handleStatusChange = (competencyId: CompetencyId, newStatus: CompetencyStatus) => {
    const currentStatus = getCompetencyStatus(competencies, competencyId);
    const currentNotes = getCompetencyNotes(competencies, competencyId);
    
    if (currentStatus !== newStatus) {
      setPendingStatusChange({ competencyId, newStatus, currentNotes });
      setChangeReason("");
      setConfirmDialogOpen(true);
    }
  };
  
  const confirmStatusChange = () => {
    if (!pendingStatusChange) return;
    
    updateCompetencyMutation.mutate({
      competencyId: pendingStatusChange.competencyId,
      status: pendingStatusChange.newStatus,
      notes: changeReason || pendingStatusChange.currentNotes,
    });
    
    setConfirmDialogOpen(false);
    setPendingStatusChange(null);
    setChangeReason("");
  };

  const handleEditCompetency = (competencyId: CompetencyId, notes: string) => {
    setEditingCompetency(competencyId);
    setTempNotes(notes);
  };

  const handleSaveNotes = (competencyId: CompetencyId, status: CompetencyStatus, notes: string) => {
    updateCompetencyMutation.mutate({ competencyId, status, notes });
    setEditingCompetency(null);
  };

  const handleCancelEdit = () => {
    setEditingCompetency(null);
  };

  const handleToggleHistory = (competencyId: CompetencyId) => {
    setExpandedHistory(expandedHistory === competencyId ? null : competencyId);
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

      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
          data-testid="overlay-sidebar"
        />
      )}
      
      <div className={`flex-1 h-screen overflow-y-auto ${isMobile ? 'p-4' : 'p-8'}`}>
        <div className={`${isMobile ? 'max-w-full' : 'max-w-7xl'} mx-auto`}>
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

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Competency Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(competencyProgress)}%</span>
              </div>
              <Progress value={competencyProgress} className="h-2" />
            </CardContent>
          </Card>

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

            <TabsContent value="competencies" className="mt-6">
              <AdminCompetenciesTab
                competencies={competencies}
                isLoading={loadingCompetencies}
                userId={userId}
                editingCompetency={editingCompetency}
                tempNotes={tempNotes}
                expandedHistory={expandedHistory}
                onEditCompetency={handleEditCompetency}
                onSaveNotes={handleSaveNotes}
                onCancelEdit={handleCancelEdit}
                onStatusChange={handleStatusChange}
                onToggleHistory={handleToggleHistory}
                setTempNotes={setTempNotes}
              />
            </TabsContent>

            <TabsContent value="qualifications" className="mt-6">
              <AdminQualificationsTab
                qualifications={qualifications}
                isLoading={loadingQualifications}
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-6">
              <AdminActivitiesTab
                activities={activities}
                isLoading={loadingActivities}
              />
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <AdminReportsTab
                reports={reports}
                isLoading={loadingReports}
                reportDialogOpen={reportDialogOpen}
                reportPeriodStart={reportPeriodStart}
                reportPeriodEnd={reportPeriodEnd}
                isGenerating={generateReportMutation.isPending}
                onDialogOpenChange={setReportDialogOpen}
                onPeriodStartChange={setReportPeriodStart}
                onPeriodEndChange={setReportPeriodEnd}
                onGenerateReport={() => generateReportMutation.mutate({
                  periodStart: reportPeriodStart,
                  periodEnd: reportPeriodEnd
                })}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <ConfirmStatusChangeDialog
        open={confirmDialogOpen}
        pendingChange={pendingStatusChange}
        changeReason={changeReason}
        currentStatus={pendingStatusChange ? getCompetencyStatus(competencies, pendingStatusChange.competencyId) : 'not_started'}
        isPending={updateCompetencyMutation.isPending}
        onOpenChange={setConfirmDialogOpen}
        onReasonChange={setChangeReason}
        onConfirm={confirmStatusChange}
        onCancel={() => {
          setConfirmDialogOpen(false);
          setPendingStatusChange(null);
          setChangeReason("");
        }}
      />
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCompetencyName, type CompetencyId } from "@shared/schema";
import type { ReportsTabProps, ReportData, ReportCompetency, ReportActivity, CompetencyStatus } from "./types";
import { statusLabels } from "./types";

export function ReportsTab({
  loadingReports,
  reports,
  reportDialogOpen,
  setReportDialogOpen,
  reportPeriodStart,
  setReportPeriodStart,
  reportPeriodEnd,
  setReportPeriodEnd,
  selectedReport,
  setSelectedReport,
  generateReportMutation,
  deleteReportMutation
}: ReportsTabProps) {
  const { toast } = useToast();

  const handleDownload = async (reportId: string, periodStart: string) => {
    try {
      const response = await fetch(`/api/facilitator/reports/${reportId}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${new Date(periodStart).toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({
        title: "Error",
        description: "Could not download the report",
        variant: "destructive",
      });
    }
  };

  return (
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
              const reportData = report.reportData as ReportData;
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

                            {reportData.competencies && reportData.competencies.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2">Competencies ({reportData.competencies.length})</h4>
                                <div className="space-y-1 text-sm">
                                  {reportData.competencies.slice(0, 5).map((comp: ReportCompetency, idx: number) => (
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

                            {reportData.activities && reportData.activities.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2">Period Activities ({reportData.activities.length})</h4>
                                <div className="space-y-1 text-sm">
                                  {reportData.activities.slice(0, 3).map((act: ReportActivity, idx: number) => (
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
                            onClick={() => handleDownload(report.id, report.periodStart)}
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
  );
}

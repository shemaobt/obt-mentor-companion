import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Download, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { QuarterlyReport } from "@shared/schema";

interface AdminReportsTabProps {
  reports: QuarterlyReport[];
  isLoading: boolean;
  reportDialogOpen: boolean;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  isGenerating: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onGenerateReport: () => void;
}

export function AdminReportsTab({
  reports,
  isLoading,
  reportDialogOpen,
  reportPeriodStart,
  reportPeriodEnd,
  isGenerating,
  onDialogOpenChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onGenerateReport
}: AdminReportsTabProps) {
  const { toast } = useToast();

  const handleDownload = async (report: QuarterlyReport) => {
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
  };

  return (
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
          <Dialog open={reportDialogOpen} onOpenChange={onDialogOpenChange}>
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
                    onChange={(e) => onPeriodStartChange(e.target.value)}
                    data-testid="input-period-start"
                  />
                </div>
                <div>
                  <Label htmlFor="periodEnd">Period End</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={reportPeriodEnd}
                    onChange={(e) => onPeriodEndChange(e.target.value)}
                    data-testid="input-period-end"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={onGenerateReport}
                  disabled={!reportPeriodStart || !reportPeriodEnd || isGenerating}
                  data-testid="button-confirm-generate-report"
                >
                  {isGenerating ? "Generating..." : "Generate Report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
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
                          onClick={() => handleDownload(report)}
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
  );
}

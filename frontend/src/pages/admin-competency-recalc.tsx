import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/sidebar";
import { 
  RefreshCw, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calculator,
  Menu,
  TrendingUp
} from "lucide-react";

interface RecalcResult {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  errors: string[];
  message: string;
}

export default function AdminCompetencyRecalc() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recalcResult, setRecalcResult] = useState<RecalcResult | null>(null);

  // Trigger recalculation mutation
  const recalcMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/recalculate-all-competencies", 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: (data: RecalcResult) => {
      setRecalcResult(data);
      if (data.success && data.failed === 0) {
        toast({
          title: "Success",
          description: `Recalculated competencies for all ${data.processed} facilitators`,
        });
      } else {
        toast({
          title: "Completed with errors",
          description: `${data.processed} successful, ${data.failed} failed`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to recalculate competencies",
        variant: "destructive",
      });
    },
  });

  const handleRecalc = () => {
    setRecalcResult(null);
    recalcMutation.mutate();
  };

  if (!isAuthenticated || !user?.isAdmin) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-admin-competency-recalc">
      {/* Sidebar - Hidden on mobile by default */}
      <div className={`
        ${isMobile 
          ? sidebarOpen 
            ? 'absolute inset-y-0 left-0 z-40 w-64' 
            : 'hidden'
          : 'w-64 flex-shrink-0'
        }
        border-r bg-card transition-all duration-200
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center justify-between p-4 border-b bg-card/95 backdrop-blur">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Competency Recalculation</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Bulk Competency Recalculation</h1>
            <p className="text-muted-foreground">
              Recalculate competency scores for all facilitators using the current scoring formula
            </p>
          </div>

          {/* Main Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Competency Recalculation
              </CardTitle>
              <CardDescription>
                This will recalculate ALL facilitators' competency levels based on their current qualifications and activities using the updated scoring formula.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Information Alert */}
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <strong>Updated Scoring System:</strong> Course multipliers have been recalibrated (Bachelor: 1.2x, Master: 1.5x, Doctoral: 1.8x). 
                  Thresholds are now: Emerging (1-5), Growing (6-12), Proficient (13-20), Advanced (21+).
                </AlertDescription>
              </Alert>

              {/* Warning Alert */}
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This operation will update all competency levels automatically. 
                  Existing auto-calculated notes will be replaced with new calculations showing the education + experience breakdown.
                </AlertDescription>
              </Alert>

              {/* Action Button */}
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleRecalc}
                  disabled={recalcMutation.isPending}
                  size="lg"
                  data-testid="button-recalculate-all"
                >
                  {recalcMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                      Recalculating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Recalculate All Competencies
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Card */}
          {recalcResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {recalcResult.failed === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  )}
                  Recalculation Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{recalcResult.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{recalcResult.processed}</div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{recalcResult.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>

                {/* Success/Error Badge */}
                <div className="flex justify-center">
                  <Badge 
                    variant={recalcResult.failed === 0 ? "default" : "destructive"}
                    className="text-base px-4 py-2"
                  >
                    {recalcResult.message}
                  </Badge>
                </div>

                {/* Error Details */}
                {recalcResult.errors && recalcResult.errors.length > 0 && (
                  <div className="border rounded-lg p-4 bg-destructive/10">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Errors ({recalcResult.errors.length})
                    </h4>
                    <div className="space-y-1 text-sm max-h-64 overflow-auto">
                      {recalcResult.errors.map((error, idx) => (
                        <div key={idx} className="text-destructive font-mono">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

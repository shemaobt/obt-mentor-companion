import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Database, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Server,
  HardDrive,
  Menu
} from "lucide-react";

interface SyncStatus {
  configured: boolean;
  productionConfigured: boolean;
  developmentConfigured: boolean;
  syncDirection: string;
  syncTables: string[];
  excludedTables: string[];
}

interface SyncResult {
  success: boolean;
  message: string;
  details?: {
    usersCreated: number;
    usersUpdated: number;
    facilitatorsCreated: number;
    facilitatorsUpdated: number;
  };
  errors?: string[];
}

export default function AdminDbSync() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Fetch sync status
  const { data: syncStatus, isLoading: statusLoading } = useQuery<SyncStatus>({
    queryKey: ["/api/admin/db-sync/status"],
    enabled: isAuthenticated && user?.isAdmin,
  });

  // Trigger sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/db-sync/trigger", 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: (data: SyncResult) => {
      setSyncResult(data);
      if (data.success) {
        toast({
          title: "Success",
          description: "Database sync completed successfully",
        });
      } else {
        toast({
          title: "Sync completed with errors",
          description: "Check the results below for details",
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
        description: "Failed to trigger database sync",
        variant: "destructive",
      });
    },
  });

  const handleSync = () => {
    setSyncResult(null);
    syncMutation.mutate();
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-admin-db-sync">
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
                  Database Sync
                </h1>
                <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>
                  Sync users and facilitators from production to development
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span>Configuration Status</span>
              </CardTitle>
              <CardDescription>
                One-way sync: Production → Development (Read-only access to production)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Status:</span>
                  {syncStatus?.configured ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Not Configured
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Production Database:</span>
                  {syncStatus?.productionConfigured ? (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Missing
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Development Database:</span>
                  {syncStatus?.developmentConfigured ? (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Missing
                    </Badge>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Production</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Development</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Tables Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sync Scope</CardTitle>
              <CardDescription>
                Which tables are included and excluded from synchronization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">
                    ✓ Synced Tables
                  </h4>
                  <ul className="space-y-1">
                    {syncStatus?.syncTables.map(table => (
                      <li key={table} className="text-sm text-muted-foreground">
                        • {table}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">
                    ✗ Excluded Tables
                  </h4>
                  <ul className="space-y-1">
                    {syncStatus?.excludedTables.map(table => (
                      <li key={table} className="text-sm text-muted-foreground">
                        • {table}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning Alert */}
          <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> This is a one-way sync from production to development.
              It will never write to production. User passwords and API keys are synced but
              development data (chats, messages, documents) is never synced.
            </AlertDescription>
          </Alert>

          {/* Trigger Sync */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Manual Sync</CardTitle>
              <CardDescription>
                Trigger a manual synchronization from production to development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSync}
                disabled={!syncStatus?.configured || syncMutation.isPending}
                size="lg"
                className="w-full"
                data-testid="button-trigger-sync"
              >
                {syncMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Trigger Sync Now
                  </>
                )}
              </Button>

              {!syncStatus?.configured && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Database sync is not configured. Please set PRODUCTION_DATABASE_URL in secrets.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sync Results */}
          {syncResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {syncResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>Sync Results</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm">{syncResult.message}</p>

                  {syncResult.details && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Users Created</p>
                        <p className="text-2xl font-bold text-green-600">
                          {syncResult.details.usersCreated}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Users Updated</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {syncResult.details.usersUpdated}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Facilitators Created</p>
                        <p className="text-2xl font-bold text-green-600">
                          {syncResult.details.facilitatorsCreated}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Facilitators Updated</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {syncResult.details.facilitatorsUpdated}
                        </p>
                      </div>
                    </div>
                  )}

                  {syncResult.errors && syncResult.errors.length > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                        Errors ({syncResult.errors.length})
                      </h4>
                      <ul className="space-y-1">
                        {syncResult.errors.map((error, index) => (
                          <li key={index} className="text-sm text-red-700 dark:text-red-300">
                            • {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

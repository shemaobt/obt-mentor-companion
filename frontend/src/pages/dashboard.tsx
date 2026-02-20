import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import { BarChart3, Menu } from "lucide-react";
import {
  StatsCards,
  ApiKeysList,
  CreateApiKeyDialog,
  NewKeyAlert,
  type DashboardStats,
  type ApiKeyWithMask,
} from "@/components/dashboard";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
    retry: false,
  });

  const { data: apiKeys = [] } = useQuery<ApiKeyWithMask[]>({
    queryKey: ["/api/api-keys"],
    retry: false,
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/api-keys", { name });
      return response.json();
    },
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setShowNewKey(newKey.key);
      setNewKeyName("");
      toast({
        title: "Success",
        description: "API key created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest("DELETE", `/api/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Success",
        description: "API key deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
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
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-dashboard">
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
            <div className="flex items-center justify-between">
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
                  <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>Dashboard</h1>
                  <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>Monitor your OBT Mentor Companion usage</p>
                </div>
              </div>
            </div>
          </div>

          <StatsCards stats={stats} isMobile={isMobile} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>API Keys</span>
                </CardTitle>
                <CreateApiKeyDialog
                  newKeyName={newKeyName}
                  setNewKeyName={setNewKeyName}
                  onCreateKey={() => createApiKeyMutation.mutate(newKeyName)}
                  isPending={createApiKeyMutation.isPending}
                />
              </div>
            </CardHeader>
            <CardContent>
              {showNewKey && (
                <NewKeyAlert
                  apiKey={showNewKey}
                  onCopy={() => copyToClipboard(showNewKey)}
                  onDismiss={() => setShowNewKey(null)}
                />
              )}
              <ApiKeysList
                apiKeys={apiKeys}
                isMobile={isMobile}
                onCopyKey={copyToClipboard}
                onDeleteKey={(keyId) => deleteApiKeyMutation.mutate(keyId)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

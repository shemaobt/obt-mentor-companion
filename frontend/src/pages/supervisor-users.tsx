import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/sidebar";
import { Users, Search, Menu } from "lucide-react";
import { SupervisedUserCard, type UserWithStats, formatName } from "@/components/supervisor-users";

export default function SupervisorUsers() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
    
    if (!isLoading && isAuthenticated && user && !user.isSupervisor && !user.isAdmin) {
      toast({
        title: "Access Denied",
        description: "Supervisor privileges required. Redirecting to dashboard...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<UserWithStats[]>({
    queryKey: ["/api/supervisor/supervised-users"],
    retry: false,
    enabled: isAuthenticated && (user?.isSupervisor === true || user?.isAdmin === true),
  });

  useEffect(() => {
    if (usersError) {
      if (isUnauthorizedError(usersError)) {
        toast({
          title: "Session Expired",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      
      if ((usersError as any)?.status === 403) {
        toast({
          title: "Access Denied",
          description: "Supervisor privileges required. Redirecting to dashboard...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/supervisor/users/${userId}/approve`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/supervised-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/pending-users/count"] });
      toast({
        title: "Success",
        description: "User approved successfully",
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
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    },
  });

  const rejectUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/supervisor/users/${userId}/reject`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/supervised-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/pending-users/count"] });
      toast({
        title: "Success",
        description: "User rejected successfully",
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
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    },
  });

  const filteredAndSortedUsers = users.filter((u) => {
    const searchLower = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(searchLower) ||
           formatName(u).toLowerCase().includes(searchLower);
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || (user && !user.isSupervisor && !user.isAdmin)) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-supervisor-users">
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
                  <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>
                    My Supervised Users
                  </h1>
                  <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>
                    View and manage users you supervise
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 ${isMobile ? 'min-h-12' : ''}`}
                  data-testid="input-search-users"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Supervised Users ({filteredAndSortedUsers.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredAndSortedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No supervised users found</p>
                  <p className="text-xs text-muted-foreground">
                    {users.length === 0 ? "You don't supervise any users yet" : "Try adjusting your search"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAndSortedUsers.map((supervisedUser) => (
                    <SupervisedUserCard
                      key={supervisedUser.id}
                      user={supervisedUser}
                      isMobile={isMobile}
                      onApprove={(userId) => approveUserMutation.mutate(userId)}
                      onReject={(userId) => rejectUserMutation.mutate(userId)}
                      isApproving={approveUserMutation.isPending}
                      isRejecting={rejectUserMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

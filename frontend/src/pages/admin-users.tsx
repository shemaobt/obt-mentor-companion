import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Sidebar from "@/components/sidebar";
import {
  UsersList,
  ApprovalSettingsCard,
  UserSearchCard,
  PasswordResetDialog,
  type UserWithStats,
  type PasswordResetDialogState,
  type ApprovalSetting,
  formatName
} from "@/components/admin-users";

export default function AdminUsers() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [passwordResetDialog, setPasswordResetDialog] = useState<PasswordResetDialogState>({ open: false });

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
    
    if (!isLoading && isAuthenticated && user && !user.isAdmin) {
      toast({
        title: "Access Denied",
        description: "Admin privileges required. Redirecting to dashboard...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
    enabled: isAuthenticated && user?.isAdmin === true,
  });

  const { data: approvalSetting } = useQuery<ApprovalSetting>({
    queryKey: ["/api/admin/settings/require-approval"],
    enabled: isAuthenticated && user?.isAdmin === true,
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
          description: "Admin privileges required. Redirecting to dashboard...",
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

  const toggleAdminStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/admin`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User admin status updated successfully",
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
        description: "Failed to update user admin status",
        variant: "destructive",
      });
    },
  });

  const toggleSupervisorStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/supervisor`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User supervisor status updated successfully",
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
        description: "Failed to update user supervisor status",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`, 
        undefined,
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
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
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      const dialogUser: UserWithStats = users.find((u: UserWithStats) => u.id === data.id) || {
        id: data.id,
        email: data.email || 'Unknown user',
        firstName: null,
        lastName: null,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        stats: { totalChats: 0, totalMessages: 0, totalApiKeys: 0, totalApiCalls: 0 }
      };
      setPasswordResetDialog({ 
        open: true, 
        user: dialogUser,
        password: data.temporaryPassword 
      });
      toast({
        title: "Success",
        description: "User password reset successfully",
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
        description: "Failed to reset user password",
        variant: "destructive",
      });
    },
  });

  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/approve`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
      const response = await apiRequest("POST", `/api/admin/users/${userId}/reject`, 
        {},
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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

  const updateApprovalSettingMutation = useMutation({
    mutationFn: async (requireApproval: boolean) => {
      const response = await apiRequest("POST", "/api/admin/settings/require-approval", 
        { requireApproval },
        { "X-Requested-With": "XMLHttpRequest" }
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/require-approval"] });
      toast({
        title: "Success",
        description: data.requireApproval 
          ? "User approval system enabled. New users will require admin approval."
          : "User approval system disabled. New users will be auto-approved.",
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
        description: "Failed to update approval system setting",
        variant: "destructive",
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async ({ userId, periodStart, periodEnd }: { userId: string; periodStart: string; periodEnd: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/generate-report`, {
        periodStart,
        periodEnd,
      }, { "X-Requested-With": "XMLHttpRequest" });
      return response.json();
    },
    onSuccess: (data, variables) => {
      const targetUser = users.find((u: UserWithStats) => u.id === variables.userId);
      toast({
        title: "Success",
        description: `Report generated successfully for ${formatName(targetUser as UserWithStats)}`,
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
        description: "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  const filteredAndSortedUsers = (users as UserWithStats[])
    .filter((u: UserWithStats) => {
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

  if (!isAuthenticated || (user && !user.isAdmin)) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-admin-users">
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
                    User Management
                  </h1>
                  <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>
                    Manage user accounts, permissions, and view usage statistics
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ApprovalSettingsCard
            approvalSetting={approvalSetting}
            isMobile={isMobile}
            onToggle={(checked) => updateApprovalSettingMutation.mutate(checked)}
            isPending={updateApprovalSettingMutation.isPending}
          />

          <UserSearchCard
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isMobile={isMobile}
          />

          <UsersList
            users={users}
            filteredUsers={filteredAndSortedUsers}
            isLoading={usersLoading}
            isMobile={isMobile}
            onToggleAdmin={(userId) => toggleAdminStatusMutation.mutate(userId)}
            onToggleSupervisor={(userId) => toggleSupervisorStatusMutation.mutate(userId)}
            onResetPassword={(userId) => resetPasswordMutation.mutate(userId)}
            onDeleteUser={(userId) => deleteUserMutation.mutate(userId)}
            onApproveUser={(userId) => approveUserMutation.mutate(userId)}
            onRejectUser={(userId) => rejectUserMutation.mutate(userId)}
            onGenerateReport={(userId, periodStart, periodEnd) => generateReportMutation.mutate({ userId, periodStart, periodEnd })}
            isToggleAdminPending={toggleAdminStatusMutation.isPending}
            isToggleSupervisorPending={toggleSupervisorStatusMutation.isPending}
            isResetPasswordPending={resetPasswordMutation.isPending}
            isApproveUserPending={approveUserMutation.isPending}
            isRejectUserPending={rejectUserMutation.isPending}
            isGenerateReportPending={generateReportMutation.isPending}
          />
        </div>
      </div>

      <PasswordResetDialog
        dialogState={passwordResetDialog}
        onOpenChange={(open) => setPasswordResetDialog({ ...passwordResetDialog, open })}
      />
    </div>
  );
}

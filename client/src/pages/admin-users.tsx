import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/sidebar";
import { 
  Users, 
  MoreHorizontal, 
  Trash2, 
  Mail,
  User,
  Calendar,
  Shield,
  ShieldOff,
  KeyRound,
  Search,
  Activity,
  MessageSquare,
  Key,
  BarChart3,
  Eye,
  EyeOff,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  FileText,
  FileBarChart2,
  Menu
} from "lucide-react";
import { Link } from "wouter";

interface UserWithStats {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin: boolean;
  isSupervisor?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLoginAt: string | Date | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
  approvedAt?: string | Date | null;
  approvedBy?: string | null;
  stats: {
    totalChats: number;
    totalMessages: number;
    totalApiKeys: number;
    totalApiCalls: number;
  };
}

export default function AdminUsers() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [passwordResetDialog, setPasswordResetDialog] = useState<{ open: boolean; user?: UserWithStats; password?: string }>({ open: false });
  const [copied, setCopied] = useState(false);

  // Redirect to login if not authenticated, to dashboard if not admin
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

  // Query for approval system setting
  const { data: approvalSetting } = useQuery<{ requireApproval: boolean }>({
    queryKey: ["/api/admin/settings/require-approval"],
    enabled: isAuthenticated && user?.isAdmin === true,
  });

  // Handle query errors with useEffect
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
      
      // Handle 403 Forbidden (not admin)
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
      // Show the password reset dialog with the temporary password
      // Use data from API response instead of searching in local state
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

  // Approval management mutations
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

  // Update approval system setting mutation
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

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async ({ userId, periodStart, periodEnd }: { userId: string; periodStart: string; periodEnd: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/generate-report`, {
        periodStart,
        periodEnd,
      }, { "X-Requested-With": "XMLHttpRequest" });
      return response.json();
    },
    onSuccess: (data, variables) => {
      const user = users.find((u: UserWithStats) => u.id === variables.userId);
      toast({
        title: "Success",
        description: `Report generated successfully for ${formatName(user as UserWithStats)}`,
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

  const formatTimestamp = (timestamp: string | Date | null | undefined) => {
    if (!timestamp) return "Never";
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const formatName = (user: UserWithStats) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return name || "No name set";
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Temporary password copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  // Filter users by search query only
  const filteredAndSortedUsers = (users as UserWithStats[])
    .filter((user: UserWithStats) => {
      const searchLower = searchQuery.toLowerCase();
      return user.email.toLowerCase().includes(searchLower) ||
             formatName(user).toLowerCase().includes(searchLower);
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

          {/* System Settings */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="approval-toggle" className="text-base font-medium">
                    Require Admin Approval for New Users
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, new user accounts will be set to pending status and require admin approval before they can access the system.
                  </p>
                </div>
                <Switch
                  id="approval-toggle"
                  checked={approvalSetting?.requireApproval ?? false}
                  onCheckedChange={(checked) => updateApprovalSettingMutation.mutate(checked)}
                  disabled={updateApprovalSettingMutation.isPending}
                  data-testid="switch-require-approval"
                />
              </div>
            </CardContent>
          </Card>

          {/* Search */}
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

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Users ({filteredAndSortedUsers.length})</span>
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
                  <p className="text-sm text-muted-foreground">No users found</p>
                  <p className="text-xs text-muted-foreground">
                    {(users as UserWithStats[]).length === 0 ? "No users exist yet" : "Try adjusting your filters"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAndSortedUsers.map((user: UserWithStats) => (
                    <Card key={user.id} className="relative" data-testid={`card-user-${user.id}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Header with name, email and admin badge */}
                            <div className="flex items-start gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-foreground" data-testid={`text-user-name-${user.id}`}>
                                    {formatName(user)}
                                  </h3>
                                  {user.isAdmin && (
                                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" data-testid={`badge-admin-${user.id}`}>
                                      <Shield className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                  )}
                                  {/* Approval Status Badge */}
                                  {user.approvalStatus === 'pending' && (
                                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" data-testid={`badge-pending-${user.id}`}>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )}
                                  {user.approvalStatus === 'rejected' && (
                                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" data-testid={`badge-rejected-${user.id}`}>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Rejected
                                    </Badge>
                                  )}
                                  {(user.approvalStatus === 'approved' || user.approvalStatus === null) && (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" data-testid={`badge-approved-${user.id}`}>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approved
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid={`text-user-email-${user.id}`}>
                                  <Mail className="h-3 w-3" />
                                  {user.email}
                                </p>
                              </div>
                            </div>

                            {/* User Information */}
                            <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className="text-muted-foreground">Registered: </span>
                                  <span className="text-foreground" data-testid={`text-user-created-${user.id}`}>
                                    {formatTimestamp(user.createdAt)}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className="text-muted-foreground">Last Login: </span>
                                  <span className="text-foreground" data-testid={`text-user-last-login-${user.id}`}>
                                    {formatTimestamp(user.lastLoginAt)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Usage Statistics */}
                            <div className="bg-muted/30 rounded-lg p-4">
                              <h4 className="font-medium text-foreground mb-3">Usage Statistics</h4>
                              <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-4'}`}>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground" data-testid={`stat-chats-${user.id}`}>
                                    <MessageSquare className="h-5 w-5" />
                                    {user.stats.totalChats}
                                  </div>
                                  <p className="text-xs text-muted-foreground">Chats</p>
                                </div>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground" data-testid={`stat-messages-${user.id}`}>
                                    <BarChart3 className="h-5 w-5" />
                                    {user.stats.totalMessages}
                                  </div>
                                  <p className="text-xs text-muted-foreground">Messages</p>
                                </div>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground" data-testid={`stat-api-keys-${user.id}`}>
                                    <Key className="h-5 w-5" />
                                    {user.stats.totalApiKeys}
                                  </div>
                                  <p className="text-xs text-muted-foreground">API Keys</p>
                                </div>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground" data-testid={`stat-api-calls-${user.id}`}>
                                    <Activity className="h-5 w-5" />
                                    {user.stats.totalApiCalls}
                                  </div>
                                  <p className="text-xs text-muted-foreground">API Calls</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions Menu */}
                          <div className="ml-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={isMobile ? 'h-8 w-8 p-0 touch-manipulation' : 'h-8 w-8 p-0'}
                                  data-testid={`button-user-menu-${user.id}`}
                                  aria-label="User options"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleAdminStatusMutation.mutate(user.id)}
                                  disabled={toggleAdminStatusMutation.isPending}
                                  data-testid={`button-toggle-admin-${user.id}`}
                                >
                                  {user.isAdmin ? (
                                    <>
                                      <ShieldOff className="mr-2 h-4 w-4" />
                                      Remove Admin
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="mr-2 h-4 w-4" />
                                      Make Admin
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => toggleSupervisorStatusMutation.mutate(user.id)}
                                  disabled={toggleSupervisorStatusMutation.isPending}
                                  data-testid={`menu-toggle-supervisor-${user.id}`}
                                >
                                  {user.isSupervisor ? (
                                    <>
                                      <UserX className="mr-2 h-4 w-4" />
                                      Remove Supervisor
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Make Supervisor
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => resetPasswordMutation.mutate(user.id)}
                                  disabled={resetPasswordMutation.isPending}
                                  data-testid={`button-reset-password-${user.id}`}
                                >
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Reset Password
                                </DropdownMenuItem>

                                {/* Portfolio and Report Actions */}
                                <Link href={`/admin/portfolio/${user.id}`}>
                                  <DropdownMenuItem data-testid={`button-view-portfolio-${user.id}`}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    View Portfolio
                                  </DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const today = new Date();
                                    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                                    const periodStart = threeMonthsAgo.toISOString().split('T')[0];
                                    const periodEnd = today.toISOString().split('T')[0];
                                    generateReportMutation.mutate({ userId: user.id, periodStart, periodEnd });
                                  }}
                                  disabled={generateReportMutation.isPending}
                                  data-testid={`button-generate-report-${user.id}`}
                                >
                                  <FileBarChart2 className="mr-2 h-4 w-4" />
                                  Generate Report
                                </DropdownMenuItem>
                                
                                {/* Approval Actions - Only show for pending users */}
                                {user.approvalStatus === 'pending' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => approveUserMutation.mutate(user.id)}
                                      disabled={approveUserMutation.isPending}
                                      className="text-green-600 focus:text-green-600"
                                      data-testid={`button-approve-user-${user.id}`}
                                    >
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Approve User
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => rejectUserMutation.mutate(user.id)}
                                      disabled={rejectUserMutation.isPending}
                                      className="text-red-600 focus:text-red-600"
                                      data-testid={`button-reject-user-${user.id}`}
                                    >
                                      <UserX className="mr-2 h-4 w-4" />
                                      Reject User
                                    </DropdownMenuItem>
                                  </>
                                )}
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem 
                                      className="text-destructive focus:text-destructive"
                                      onSelect={(e) => e.preventDefault()}
                                      data-testid={`button-delete-user-${user.id}`}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this user account? This will permanently remove:
                                        <br />• User profile and authentication
                                        <br />• All chat conversations ({user.stats.totalChats} chats)
                                        <br />• All messages ({user.stats.totalMessages} messages)
                                        <br />• All API keys ({user.stats.totalApiKeys} keys)
                                        <br />• All usage data ({user.stats.totalApiCalls} API calls)
                                        <br /><br />This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteUserMutation.mutate(user.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        data-testid={`button-confirm-delete-${user.id}`}
                                      >
                                        Delete User
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={passwordResetDialog.open} onOpenChange={(open) => setPasswordResetDialog({ ...passwordResetDialog, open })}>
        <DialogContent data-testid="dialog-password-reset">
          <DialogHeader>
            <DialogTitle>Password Reset Successful</DialogTitle>
            <DialogDescription>
              The password has been reset for {passwordResetDialog.user ? formatName(passwordResetDialog.user) : ""}. 
              Please provide the user with this temporary password:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <Label className="text-sm font-medium">Temporary Password</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Input 
                  type="text" 
                  value={passwordResetDialog.password || ""} 
                  readOnly 
                  className="font-mono"
                  data-testid="input-temp-password"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => passwordResetDialog.password && copyToClipboard(passwordResetDialog.password)}
                  data-testid="button-copy-password"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Important:</strong> The user should change this password immediately after logging in. 
              This temporary password will be shown only once.
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setPasswordResetDialog({ open: false })} data-testid="button-close-password-dialog">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
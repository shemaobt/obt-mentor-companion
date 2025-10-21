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
import Sidebar from "@/components/sidebar";
import { 
  Users, 
  Mail,
  Calendar,
  Shield,
  Search,
  Activity,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  Menu,
  Eye
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

export default function SupervisorUsers() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect to login if not authenticated, to dashboard if not supervisor
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
      
      // Handle 403 Forbidden (not supervisor)
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

  // Approval management mutations
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

  const formatTimestamp = (timestamp: string | Date | null | undefined) => {
    if (!timestamp) return "Never";
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const formatName = (user: UserWithStats) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return name || "No name set";
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

  if (!isAuthenticated || (user && !user.isSupervisor && !user.isAdmin)) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden" data-testid="page-supervisor-users">
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
                    My Supervised Users
                  </h1>
                  <p className={`text-muted-foreground mt-2 ${isMobile ? 'text-sm' : ''}`}>
                    View and manage users you supervise
                  </p>
                </div>
              </div>
            </div>
          </div>

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
                    {(users as UserWithStats[]).length === 0 ? "You don't supervise any users yet" : "Try adjusting your search"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAndSortedUsers.map((supervisedUser: UserWithStats) => (
                    <Card key={supervisedUser.id} className="relative" data-testid={`card-user-${supervisedUser.id}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Header with name, email and badges */}
                            <div className="flex items-start gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-foreground" data-testid={`text-user-name-${supervisedUser.id}`}>
                                    {formatName(supervisedUser)}
                                  </h3>
                                  {supervisedUser.isAdmin && (
                                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" data-testid={`badge-admin-${supervisedUser.id}`}>
                                      <Shield className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                  )}
                                  {/* Approval Status Badge */}
                                  {supervisedUser.approvalStatus === 'pending' && (
                                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" data-testid={`badge-pending-${supervisedUser.id}`}>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending Approval
                                    </Badge>
                                  )}
                                  {supervisedUser.approvalStatus === 'rejected' && (
                                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" data-testid={`badge-rejected-${supervisedUser.id}`}>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Rejected
                                    </Badge>
                                  )}
                                  {(supervisedUser.approvalStatus === 'approved' || supervisedUser.approvalStatus === null) && (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" data-testid={`badge-approved-${supervisedUser.id}`}>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approved
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1" data-testid={`text-user-email-${supervisedUser.id}`}>
                                  <Mail className="h-3 w-3" />
                                  {supervisedUser.email}
                                </p>
                              </div>
                            </div>

                            {/* User Information */}
                            <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className="text-muted-foreground">Registered: </span>
                                  <span className="text-foreground" data-testid={`text-user-created-${supervisedUser.id}`}>
                                    {new Date(supervisedUser.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className="text-muted-foreground">Last Login: </span>
                                  <span className="text-foreground" data-testid={`text-user-last-login-${supervisedUser.id}`}>
                                    {supervisedUser.lastLoginAt ? new Date(supervisedUser.lastLoginAt).toLocaleDateString() : 'Never'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Usage Statistics */}
                            <div className="bg-muted/30 rounded-lg p-4">
                              <h4 className="font-medium text-foreground mb-3 text-sm">Usage Statistics</h4>
                              <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 gap-4'}`}>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground" data-testid={`stat-chats-${supervisedUser.id}`}>
                                    <MessageSquare className="h-4 w-4" />
                                    {supervisedUser.stats.totalChats}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">Chats</div>
                                </div>
                                <div className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground" data-testid={`stat-messages-${supervisedUser.id}`}>
                                    <MessageSquare className="h-4 w-4" />
                                    {supervisedUser.stats.totalMessages}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">Messages</div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-wrap">
                              {/* View Portfolio Button */}
                              <Link href={`/supervisor/users/${supervisedUser.id}/portfolio`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="min-h-[44px]"
                                  data-testid={`button-view-portfolio-${supervisedUser.id}`}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Portfolio
                                </Button>
                              </Link>

                              {/* Approval Actions - Only for pending users */}
                              {supervisedUser.approvalStatus === 'pending' && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => approveUserMutation.mutate(supervisedUser.id)}
                                    disabled={approveUserMutation.isPending}
                                    className="min-h-[44px] bg-green-600 hover:bg-green-700"
                                    data-testid={`button-approve-${supervisedUser.id}`}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => rejectUserMutation.mutate(supervisedUser.id)}
                                    disabled={rejectUserMutation.isPending}
                                    className="min-h-[44px] text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                    data-testid={`button-reject-${supervisedUser.id}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </>
                              )}
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
        </div>
      </div>
    </div>
  );
}

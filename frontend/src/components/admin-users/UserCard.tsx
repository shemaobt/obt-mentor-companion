import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  MoreHorizontal,
  Trash2,
  Mail,
  Calendar,
  Shield,
  ShieldOff,
  KeyRound,
  Activity,
  MessageSquare,
  Key,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  FileText,
  FileBarChart2
} from "lucide-react";
import { Link } from "wouter";
import { UserWithStats, formatTimestamp, formatName } from "./types";

interface UserCardProps {
  user: UserWithStats;
  isMobile: boolean;
  onToggleAdmin: (userId: string) => void;
  onToggleSupervisor: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onApproveUser: (userId: string) => void;
  onRejectUser: (userId: string) => void;
  onGenerateReport: (userId: string, periodStart: string, periodEnd: string) => void;
  isToggleAdminPending: boolean;
  isToggleSupervisorPending: boolean;
  isResetPasswordPending: boolean;
  isApproveUserPending: boolean;
  isRejectUserPending: boolean;
  isGenerateReportPending: boolean;
}

export function UserCard({
  user,
  isMobile,
  onToggleAdmin,
  onToggleSupervisor,
  onResetPassword,
  onDeleteUser,
  onApproveUser,
  onRejectUser,
  onGenerateReport,
  isToggleAdminPending,
  isToggleSupervisorPending,
  isResetPasswordPending,
  isApproveUserPending,
  isRejectUserPending,
  isGenerateReportPending
}: UserCardProps) {
  const handleGenerateReport = () => {
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    const periodStart = threeMonthsAgo.toISOString().split('T')[0];
    const periodEnd = today.toISOString().split('T')[0];
    onGenerateReport(user.id, periodStart, periodEnd);
  };

  return (
    <Card key={user.id} className="relative" data-testid={`card-user-${user.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
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
                  {user.isSupervisor && (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" data-testid={`badge-supervisor-${user.id}`}>
                      <UserCheck className="h-3 w-3 mr-1" />
                      Supervisor
                    </Badge>
                  )}
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
                  onClick={() => onToggleAdmin(user.id)}
                  disabled={isToggleAdminPending}
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
                  onClick={() => onToggleSupervisor(user.id)}
                  disabled={isToggleSupervisorPending}
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
                  onClick={() => onResetPassword(user.id)}
                  disabled={isResetPasswordPending}
                  data-testid={`button-reset-password-${user.id}`}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset Password
                </DropdownMenuItem>

                <Link href={`/admin/portfolio/${user.id}`}>
                  <DropdownMenuItem data-testid={`button-view-portfolio-${user.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Portfolio
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={handleGenerateReport}
                  disabled={isGenerateReportPending}
                  data-testid={`button-generate-report-${user.id}`}
                >
                  <FileBarChart2 className="mr-2 h-4 w-4" />
                  Generate Report
                </DropdownMenuItem>
                
                {user.approvalStatus === 'pending' && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onApproveUser(user.id)}
                      disabled={isApproveUserPending}
                      className="text-green-600 focus:text-green-600"
                      data-testid={`button-approve-user-${user.id}`}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Approve User
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onRejectUser(user.id)}
                      disabled={isRejectUserPending}
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
                        onClick={() => onDeleteUser(user.id)}
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
  );
}

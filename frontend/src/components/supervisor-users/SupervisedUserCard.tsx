import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, Calendar, Shield, Activity, MessageSquare, 
  Clock, CheckCircle, XCircle, UserCheck, Eye 
} from "lucide-react";
import { Link } from "wouter";
import type { SupervisedUserCardProps } from "./types";
import { formatName } from "./types";

export function SupervisedUserCard({ 
  user, 
  isMobile, 
  onApprove, 
  onReject, 
  isApproving, 
  isRejecting 
}: SupervisedUserCardProps) {
  return (
    <Card className="relative" data-testid={`card-user-${user.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground" data-testid={`text-user-name-${user.id}`}>
                    {formatName(user)}
                  </h3>
                  {user.isAdmin && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" data-testid={`badge-admin-${user.id}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {user.approvalStatus === 'pending' && (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" data-testid={`badge-pending-${user.id}`}>
                      <Clock className="h-3 w-3 mr-1" />
                      Pending Approval
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
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1" data-testid={`text-user-email-${user.id}`}>
                  <Mail className="h-3 w-3" />
                  {user.email}
                </p>
              </div>
            </div>

            <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Registered: </span>
                  <span className="text-foreground" data-testid={`text-user-created-${user.id}`}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Last Login: </span>
                  <span className="text-foreground" data-testid={`text-user-last-login-${user.id}`}>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-3 text-sm">Usage Statistics</h4>
              <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 gap-4'}`}>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground" data-testid={`stat-chats-${user.id}`}>
                    <MessageSquare className="h-4 w-4" />
                    {user.stats.totalChats}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Chats</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground" data-testid={`stat-messages-${user.id}`}>
                    <MessageSquare className="h-4 w-4" />
                    {user.stats.totalMessages}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Messages</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href={`/supervisor/users/${user.id}/portfolio`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  data-testid={`button-view-portfolio-${user.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Portfolio
                </Button>
              </Link>

              {user.approvalStatus === 'pending' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApprove(user.id)}
                    disabled={isApproving}
                    className="min-h-[44px] bg-green-600 hover:bg-green-700"
                    data-testid={`button-approve-${user.id}`}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReject(user.id)}
                    disabled={isRejecting}
                    className="min-h-[44px] text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid={`button-reject-${user.id}`}
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
  );
}

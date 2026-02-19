import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { UserCard } from "./UserCard";
import { UserWithStats } from "./types";

interface UsersListProps {
  users: UserWithStats[];
  filteredUsers: UserWithStats[];
  isLoading: boolean;
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

export function UsersList({
  users,
  filteredUsers,
  isLoading,
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
}: UsersListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Users ({filteredUsers.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
            <p className="text-xs text-muted-foreground">
              {users.length === 0 ? "No users exist yet" : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isMobile={isMobile}
                onToggleAdmin={onToggleAdmin}
                onToggleSupervisor={onToggleSupervisor}
                onResetPassword={onResetPassword}
                onDeleteUser={onDeleteUser}
                onApproveUser={onApproveUser}
                onRejectUser={onRejectUser}
                onGenerateReport={onGenerateReport}
                isToggleAdminPending={isToggleAdminPending}
                isToggleSupervisorPending={isToggleSupervisorPending}
                isResetPasswordPending={isResetPasswordPending}
                isApproveUserPending={isApproveUserPending}
                isRejectUserPending={isRejectUserPending}
                isGenerateReportPending={isGenerateReportPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

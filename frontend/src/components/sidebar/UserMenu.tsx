import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FeedbackForm from "../feedback-form";
import { ThemeSwitcher } from "../ThemeSwitcher";
import {
  User as UserIcon,
  Users,
  ChevronUp,
  BarChart3,
  Settings,
  LogOut,
  MessageSquare,
  UserCheck,
  FileText,
  TrendingUp,
  QrCode
} from "lucide-react";
import type { UserMenuProps } from "./types";

export function UserMenu({
  userMenuOpen,
  onToggle,
  user,
  isAdmin,
  isSupervisor,
  pendingUsersCount,
  supervisorPendingUsersCount,
  unreadFeedbackCount,
  isMobile,
  onClose,
  onLogout
}: UserMenuProps) {
  return (
    <div className="p-3 md:p-4 border-t border-border">
      <Button
        variant="ghost" 
        className={`flex items-center space-x-2 md:space-x-3 p-2 rounded-md hover:bg-accent w-full justify-start ${isMobile ? 'h-10 sm:h-12' : 'h-10'}`}
        onClick={onToggle}
        aria-expanded={userMenuOpen}
        aria-label="User menu"
        data-testid="button-user-menu"
      >
        <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
          {user?.profileImageUrl ? (
            <img 
              src={user.profileImageUrl} 
              alt="Profile" 
              className="h-8 w-8 rounded-full object-cover"
              data-testid="img-user-avatar"
            />
          ) : (
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
            {user?.firstName || user?.lastName 
              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
              : user?.email || "User"
            }
          </p>
          <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
            {user?.email || ""}
          </p>
        </div>
        <ChevronUp className={`h-3 w-3 text-muted-foreground transition-transform ${userMenuOpen ? "" : "rotate-180"}`} />
      </Button>
      
      {userMenuOpen && (
        <div className="mt-2 bg-popover border border-border rounded-md shadow-lg py-2 max-h-96 overflow-y-auto">
          {isAdmin && (
            <>
              <Link href="/admin/users" className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-sm px-3 md:px-4 ${isMobile ? 'h-10 sm:h-12' : 'py-2 h-auto'}`}
                  onClick={onClose}
                  data-testid="link-admin-users"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">User Management</span>
                  {pendingUsersCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-2 h-5 min-w-[1.25rem] text-xs px-1.5 py-0 rounded-full flex items-center justify-center"
                      data-testid="badge-pending-users"
                    >
                      {pendingUsersCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/admin/feedback" className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-sm px-3 md:px-4 ${isMobile ? 'h-10 sm:h-12' : 'py-2 h-auto'}`}
                  onClick={onClose}
                  data-testid="link-admin-feedback"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">Manage Feedback</span>
                  {unreadFeedbackCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-2 h-5 min-w-[1.25rem] text-xs px-1.5 py-0 rounded-full flex items-center justify-center"
                      data-testid="badge-unread-feedback"
                    >
                      {unreadFeedbackCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/admin/documents" className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-sm px-3 md:px-4 ${isMobile ? 'h-10 sm:h-12' : 'py-2 h-auto'}`}
                  onClick={onClose}
                  data-testid="link-admin-documents"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">Documents</span>
                </Button>
              </Link>
              <Link href="/admin/competency-recalc" className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-sm px-3 md:px-4 ${isMobile ? 'h-10 sm:h-12' : 'py-2 h-auto'}`}
                  onClick={onClose}
                  data-testid="link-admin-competency-recalc"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">Recalculate Competencies</span>
                </Button>
              </Link>
              <Separator className="my-1" />
            </>
          )}
          {isSupervisor && !isAdmin && (
            <>
              <Link href="/supervisor/users" className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-sm px-3 md:px-4 ${isMobile ? 'h-10 sm:h-12' : 'py-2 h-auto'}`}
                  onClick={onClose}
                  data-testid="link-supervisor-users"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">My Supervised Users</span>
                  {supervisorPendingUsersCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-2 h-5 min-w-[1.25rem] text-xs px-1.5 py-0 rounded-full flex items-center justify-center"
                      data-testid="badge-supervisor-pending-users"
                    >
                      {supervisorPendingUsersCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Separator className="my-1" />
            </>
          )}
          <Link href="/portfolio" className="block">
            <Button
              variant="ghost"
              className={`w-full justify-start text-sm px-4 ${isMobile ? 'h-12' : 'py-2 h-auto'}`}
              onClick={onClose}
              data-testid="link-portfolio"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Portfolio
            </Button>
          </Link>
          
          <FeedbackForm
            trigger={
              <Button
                variant="ghost"
                className={`w-full justify-start text-sm px-4 ${isMobile ? 'h-12' : 'py-2 h-auto'}`}
                data-testid="button-feedback"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Feedback
              </Button>
            }
          />
          
          <ThemeSwitcher />
          
          <Link href="/settings" className="block">
            <Button
              variant="ghost"
              className={`w-full justify-start text-sm px-4 ${isMobile ? 'h-12' : 'py-2 h-auto'}`}
              onClick={onClose}
              data-testid="link-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          
          <Link href="/qr-code" className="block">
            <Button
              variant="ghost"
              className={`w-full justify-start text-sm px-4 ${isMobile ? 'h-12' : 'py-2 h-auto'}`}
              onClick={onClose}
              data-testid="link-qr-code"
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
            </Button>
          </Link>
          
          <Separator className="my-1" />
          
          <Button
            variant="ghost"
            className={`w-full justify-start text-sm px-4 ${isMobile ? 'h-12' : 'py-2 h-auto'}`}
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}

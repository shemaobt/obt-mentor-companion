import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Mail, User, Calendar, Circle, Eye, CheckCircle2 } from "lucide-react";
import type { FeedbackCardProps } from "./types";
import { getStatusIcon, getStatusColor, getCategoryIcon, formatTimestamp } from "./types";

export function FeedbackCard({ feedback, isMobile, onUpdateStatus, onDelete }: FeedbackCardProps) {
  return (
    <Card className="relative" data-testid={`card-feedback-${feedback.id}`}>
      <CardContent className={isMobile ? "p-4" : "p-6"}>
        <div className={isMobile ? "space-y-4" : "flex items-start justify-between"}>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge 
                className={`flex items-center gap-1 ${getStatusColor(feedback.status)}`}
                data-testid={`badge-status-${feedback.id}`}
              >
                {getStatusIcon(feedback.status)}
                {feedback.status?.charAt(0).toUpperCase() + feedback.status?.slice(1)}
              </Badge>
              {feedback.category && (
                <Badge variant="outline" className="flex items-center gap-1" data-testid={`badge-category-${feedback.id}`}>
                  {getCategoryIcon(feedback.category)}
                  {feedback.category?.charAt(0).toUpperCase() + feedback.category?.slice(1)}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatTimestamp(feedback.createdAt)}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-foreground whitespace-pre-wrap" data-testid={`text-message-${feedback.id}`}>
                {feedback.message}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {feedback.userName && (
                <span className="flex items-center gap-1" data-testid={`text-user-name-${feedback.id}`}>
                  <User className="h-3 w-3" />
                  {feedback.userName}
                </span>
              )}
              {feedback.userEmail && (
                <span className="flex items-center gap-1" data-testid={`text-user-email-${feedback.id}`}>
                  <Mail className="h-3 w-3" />
                  {feedback.userEmail}
                </span>
              )}
            </div>
          </div>

          <div className={isMobile ? "flex gap-2 w-full" : "flex items-center gap-2"}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size={isMobile ? "default" : "sm"}
                  className={isMobile ? "flex-1 min-h-[44px]" : ""}
                  data-testid={`button-status-menu-${feedback.id}`}
                >
                  <MoreHorizontal className={isMobile ? "h-4 w-4 mr-2" : "h-4 w-4"} />
                  {isMobile && "Status"}
                  {!isMobile && "Update Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onUpdateStatus(feedback.id, "new")}
                  disabled={feedback.status === "new"}
                  data-testid={`button-status-new-${feedback.id}`}
                >
                  <Circle className="mr-2 h-4 w-4" />
                  Mark as New
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onUpdateStatus(feedback.id, "read")}
                  disabled={feedback.status === "read"}
                  data-testid={`button-status-read-${feedback.id}`}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Mark as Read
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onUpdateStatus(feedback.id, "resolved")}
                  disabled={feedback.status === "resolved"}
                  data-testid={`button-status-resolved-${feedback.id}`}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Resolved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size={isMobile ? "default" : "sm"}
                  className={isMobile ? "min-h-[44px] min-w-[44px] px-3" : "text-destructive hover:text-destructive"}
                  data-testid={`button-delete-${feedback.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this feedback? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`button-cancel-delete-${feedback.id}`}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(feedback.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid={`button-confirm-delete-${feedback.id}`}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

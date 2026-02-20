import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCompetencyName, type CompetencyId } from "@shared/schema";
import { statusLabels, type CompetencyStatus, type PendingStatusChange } from "./types";

interface ConfirmStatusChangeDialogProps {
  open: boolean;
  pendingChange: PendingStatusChange | null;
  changeReason: string;
  currentStatus: CompetencyStatus;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmStatusChangeDialog({
  open,
  pendingChange,
  changeReason,
  currentStatus,
  isPending,
  onOpenChange,
  onReasonChange,
  onConfirm,
  onCancel
}: ConfirmStatusChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-confirm-status-change">
        <DialogHeader>
          <DialogTitle>Confirm Status Change</DialogTitle>
          <DialogDescription>
            You are changing the status of {pendingChange && getCompetencyName(pendingChange.competencyId)} 
            {pendingChange && ` from ${statusLabels[currentStatus]} to ${statusLabels[pendingChange.newStatus]}`}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="change-reason">Why are you making this change? *</Label>
          <Textarea
            id="change-reason"
            value={changeReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Explain the reason for this status change..."
            className="mt-2 min-h-[100px]"
            data-testid="textarea-change-reason"
          />
          <p className="text-sm text-muted-foreground mt-2">
            This note will be recorded in the change history and visible to the facilitator.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-change"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!changeReason.trim() || isPending}
            data-testid="button-confirm-change"
          >
            {isPending ? "Updating..." : "Confirm Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

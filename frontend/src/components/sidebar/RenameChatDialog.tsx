import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RenameChatDialogProps } from "./types";

export function RenameChatDialog({
  renamingChatId,
  newChatTitle,
  onTitleChange,
  onConfirm,
  onCancel,
  isPending
}: RenameChatDialogProps) {
  return (
    <Dialog open={renamingChatId !== null} onOpenChange={(open) => {
      if (!open) onCancel();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
          <DialogDescription>
            Enter a new name for this conversation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="chat-title">Chat Title</Label>
            <Input
              id="chat-title"
              value={newChatTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter chat title..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newChatTitle.trim() && renamingChatId) {
                  onConfirm();
                }
              }}
              data-testid="input-rename-chat-title"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-rename"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!newChatTitle.trim() || isPending}
            data-testid="button-confirm-rename"
          >
            {isPending ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UserWithStats, PasswordResetDialogState, formatName } from "./types";

interface PasswordResetDialogProps {
  dialogState: PasswordResetDialogState;
  onOpenChange: (open: boolean) => void;
}

export function PasswordResetDialog({ dialogState, onOpenChange }: PasswordResetDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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

  return (
    <Dialog open={dialogState.open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-password-reset">
        <DialogHeader>
          <DialogTitle>Password Reset Successful</DialogTitle>
          <DialogDescription>
            The password has been reset for {dialogState.user ? formatName(dialogState.user) : ""}. 
            Please provide the user with this temporary password:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <Label className="text-sm font-medium">Temporary Password</Label>
            <div className="flex items-center space-x-2 mt-2">
              <Input 
                type="text" 
                value={dialogState.password || ""} 
                readOnly 
                className="font-mono"
                data-testid="input-temp-password"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => dialogState.password && copyToClipboard(dialogState.password)}
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
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-password-dialog">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

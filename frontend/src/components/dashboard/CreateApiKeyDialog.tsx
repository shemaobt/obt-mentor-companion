import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { CreateApiKeyDialogProps } from "./types";

export function CreateApiKeyDialog({ newKeyName, setNewKeyName, onCreateKey, isPending }: CreateApiKeyDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button data-testid="button-create-api-key">
          <Plus className="h-4 w-4 mr-2" />
          Generate New Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Generate a new API key to access your OBT Mentor Companion programmatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Production API, Development API, etc."
              data-testid="input-key-name"
            />
          </div>
          <Button
            onClick={onCreateKey}
            disabled={!newKeyName.trim() || isPending}
            className="w-full"
            data-testid="button-confirm-create-key"
          >
            {isPending ? "Creating..." : "Create API Key"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

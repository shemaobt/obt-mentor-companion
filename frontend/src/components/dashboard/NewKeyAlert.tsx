import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy } from "lucide-react";
import type { NewKeyAlertProps } from "./types";

const logoImage = "/logo.png";

export function NewKeyAlert({ apiKey, onCopy, onDismiss }: NewKeyAlertProps) {
  return (
    <Alert className="mb-6">
      <img 
        src={logoImage} 
        alt="Assistant" 
        className="h-4 w-4 object-contain"
        data-testid="img-alert-icon"
      />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-medium">Your new API key has been generated:</p>
          <div className="flex items-center space-x-2">
            <code className="bg-muted px-2 py-1 rounded text-sm flex-1" data-testid="text-new-api-key">
              {apiKey}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
              data-testid="button-copy-new-key"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Make sure to copy this key now. You won't be able to see it again.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            data-testid="button-dismiss-new-key"
          >
            I've saved this key
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

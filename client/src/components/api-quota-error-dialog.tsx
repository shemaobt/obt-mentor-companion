import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

interface ApiQuotaErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ApiQuotaErrorDialog({ open, onOpenChange }: ApiQuotaErrorDialogProps) {
  const [, setLocation] = useLocation();

  const handleContactAdmin = () => {
    onOpenChange(false);
    setLocation("/feedback");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-api-quota-error">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Service Temporarily Unavailable</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-3 pt-2">
            <p>
              We're currently experiencing high demand and have reached our AI service capacity. 
              This is a temporary issue that our administrators are working to resolve.
            </p>
            <p className="font-medium text-foreground">
              Please contact the administrator for assistance or try again later.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogAction
            onClick={() => onOpenChange(false)}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            data-testid="button-close-dialog"
          >
            Close
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleContactAdmin}
            data-testid="button-contact-admin"
          >
            Contact Admin
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

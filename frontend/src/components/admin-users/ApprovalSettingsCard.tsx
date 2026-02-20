import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ApprovalSetting } from "./types";

interface ApprovalSettingsCardProps {
  approvalSetting: ApprovalSetting | undefined;
  isMobile: boolean;
  onToggle: (checked: boolean) => void;
  isPending: boolean;
}

export function ApprovalSettingsCard({ approvalSetting, isMobile, onToggle, isPending }: ApprovalSettingsCardProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className={isMobile ? "space-y-4" : "flex items-center justify-between"}>
          <div className="space-y-0.5">
            <Label htmlFor="approval-toggle" className="text-base font-medium">
              Require Admin Approval for New Users
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, new user accounts will be set to pending status and require admin approval before they can access the system.
            </p>
          </div>
          <div className={isMobile ? "flex items-center justify-between pt-2" : ""}>
            {isMobile && (
              <span className="text-sm font-medium">
                {approvalSetting?.requireApproval ? "Enabled" : "Disabled"}
              </span>
            )}
            <Switch
              id="approval-toggle"
              checked={approvalSetting?.requireApproval ?? false}
              onCheckedChange={onToggle}
              disabled={isPending}
              className={isMobile ? "scale-125" : ""}
              data-testid="switch-require-approval"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

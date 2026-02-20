import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form";
import { User, Upload } from "lucide-react";
import type { ProfileImageUploadProps } from "./types";

export function ProfileImageUpload({ profileImagePreview, onImageSelect }: ProfileImageUploadProps) {
  return (
    <div className="flex flex-col items-center space-y-3 py-2">
      <FormLabel>Profile Picture (optional)</FormLabel>
      <div className="relative">
        <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
          {profileImagePreview ? (
            <img 
              src={profileImagePreview} 
              alt="Profile preview" 
              className="h-full w-full object-cover"
              data-testid="img-signup-profile-preview"
            />
          ) : (
            <User className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
      </div>
      <div>
        <input
          type="file"
          id="signup-profile-image"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onImageSelect}
          data-testid="input-signup-profile-image"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('signup-profile-image')?.click()}
          data-testid="button-choose-signup-image"
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose Image
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Max 5MB (JPEG, PNG, WEBP, or GIF)
      </p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

export function ProfileImageUpload() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.profileImageUrl || null);

  useEffect(() => {
    setPreviewUrl(user?.profileImageUrl || null);
  }, [user?.profileImageUrl]);

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/user/profile-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      setPreviewUrl(data.profileImageUrl);
      await refreshUser();
      toast({
        title: "Success",
        description: "Profile image updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload profile image",
        variant: "destructive",
      });
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/profile-image', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }
    },
    onSuccess: async () => {
      setPreviewUrl(null);
      await refreshUser();
      toast({
        title: "Success",
        description: "Profile image removed successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Remove error:', error);
      toast({
        title: "Remove failed",
        description: "Failed to remove profile image",
        variant: "destructive",
      });
    },
  });

  const uploading = uploadImageMutation.isPending || removeImageMutation.isPending;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WEBP, or GIF image",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    uploadImageMutation.mutate(file);
  };

  const handleRemoveImage = () => {
    removeImageMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative h-32 w-32 rounded-full overflow-hidden bg-muted flex items-center justify-center border-4 border-border">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Profile" 
              className="h-full w-full object-cover"
              data-testid="img-settings-profile-preview"
            />
          ) : (
            <User className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex gap-2">
          <input
            type="file"
            id="settings-profile-image"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageUpload}
            data-testid="input-settings-profile-image"
          />
          <Button
            onClick={() => document.getElementById('settings-profile-image')?.click()}
            disabled={uploading}
            data-testid="button-upload-settings-image"
          >
            {uploading ? 'Uploading...' : previewUrl ? 'Change Image' : 'Upload Image'}
          </Button>
          
          {previewUrl && (
            <Button
              variant="outline"
              onClick={handleRemoveImage}
              disabled={uploading}
              data-testid="button-remove-settings-image"
            >
              Remove
            </Button>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground text-center">
          Max 5MB (JPEG, PNG, WEBP, or GIF)
        </p>
      </div>
    </div>
  );
}

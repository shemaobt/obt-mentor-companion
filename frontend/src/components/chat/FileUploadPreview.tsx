import { Button } from "@/components/ui/button";
import { X, Image, Music, FileText } from "lucide-react";

interface FileUploadPreviewProps {
  file: File;
  onRemove: () => void;
}

export function FileUploadPreview({ file, onRemove }: FileUploadPreviewProps) {
  const isImage = file.type.startsWith('image/');
  const isAudio = file.type.startsWith('audio/');
  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

  return (
    <div className="mb-3 p-3 bg-muted rounded-lg border border-border" data-testid="file-preview">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {isImage ? (
            <>
              <Image className="h-5 w-5 text-primary flex-shrink-0" />
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="h-12 w-12 object-cover rounded border border-border"
                data-testid="img-file-preview"
              />
            </>
          ) : isAudio ? (
            <Music className="h-5 w-5 text-primary flex-shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-file-name">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-file-size">
              {fileSizeMB} MB
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 flex-shrink-0"
          data-testid="button-remove-file"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

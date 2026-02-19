import { useQuery } from "@tanstack/react-query";
import { UseMutationResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, File, Eye } from "lucide-react";
import type { QualificationAttachment } from "@shared/schema";

interface CertificateUploadData {
  qualificationId: string;
  file: File;
}

interface CertificateDeleteData {
  qualificationId: string;
  attachmentId: string;
}

interface CertificateManagerProps {
  qualificationId: string;
  uploadCertificateMutation: UseMutationResult<unknown, Error, CertificateUploadData>;
  deleteCertificateMutation: UseMutationResult<unknown, Error, CertificateDeleteData>;
  uploadingCertificateFor: string | null;
}

export function CertificateManager({ 
  qualificationId,
  uploadCertificateMutation,
  deleteCertificateMutation,
  uploadingCertificateFor 
}: CertificateManagerProps) {
  const { data: certificates = [], isLoading } = useQuery<QualificationAttachment[]>({
    queryKey: ['/api/facilitator/qualifications', qualificationId, 'certificates']
  });

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-medium">Certificates</Label>
        <input
          type="file"
          id={`cert-upload-${qualificationId}`}
          accept="application/pdf,image/jpeg,image/jpg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadCertificateMutation.mutate({
                qualificationId,
                file
              });
              e.target.value = '';
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => document.getElementById(`cert-upload-${qualificationId}`)?.click()}
          disabled={uploadingCertificateFor === qualificationId}
        >
          {uploadingCertificateFor === qualificationId ? (
            <span className="animate-pulse">Uploading...</span>
          ) : (
            <>
              <Upload className="h-3 w-3 mr-1" />
              Upload
            </>
          )}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading certificates...</div>
      ) : certificates.length === 0 ? (
        <div className="text-xs text-muted-foreground">No certificates uploaded</div>
      ) : (
        <div className="space-y-2">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
              <div className="flex items-center min-w-0 flex-1 mr-2">
                <File className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
                <span className="truncate">{cert.fileName}</span>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => window.open(cert.fileUrl, '_blank')}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteCertificateMutation.mutate({
                    qualificationId,
                    attachmentId: cert.id
                  })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Sidebar from "@/components/sidebar";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";

interface Document {
  id: string;
  documentId: string;
  filename: string;
  uploadedBy: string;
  uploadedAt: string | Date;
  isActive: boolean;
  fileType: 'pdf' | 'docx' | 'txt';
  chunkCount: number;
}

export default function AdminDocuments() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  console.log('[AdminDocuments] Component rendering:', { location, isAuthenticated, isLoading, isAdmin: user?.isAdmin });

  // Redirect to login if not authenticated, to dashboard if not admin
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
    
    if (!isLoading && isAuthenticated && user && !user.isAdmin) {
      toast({
        title: "Access Denied",
        description: "Admin privileges required. Redirecting to dashboard...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  const { data: documents = [], isLoading: documentsLoading, error: documentsError } = useQuery<Document[]>({
    queryKey: ["/api/admin/documents"],
    retry: false,
    enabled: isAuthenticated && user?.isAdmin === true,
  });

  // Handle query errors
  useEffect(() => {
    if (documentsError) {
      if (isUnauthorizedError(documentsError)) {
        toast({
          title: "Session Expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      } else {
        toast({
          title: "Error",
          description: "Failed to load documents",
          variant: "destructive",
        });
      }
    }
  }, [documentsError, toast]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiRequest('POST', '/api/admin/documents/upload', formData, {
        'X-CSRF-Protection': '1',
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded and processed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('PATCH', `/api/admin/documents/${documentId}/toggle`, {}, {
        'X-CSRF-Protection': '1',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({
        title: "Success",
        description: "Document status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document status",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('DELETE', `/api/admin/documents/${documentId}`, {}, {
        'X-CSRF-Protection': '1',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleToggle = (documentId: string) => {
    toggleMutation.mutate(documentId);
  };

  const handleDelete = (documentId: string) => {
    deleteMutation.mutate(documentId);
  };

  if (!isAuthenticated || !user?.isAdmin) {
    console.log('[AdminDocuments] Returning null - auth check failed');
    return null;
  }

  console.log('[AdminDocuments] Rendering full page layout');

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-document-management">Document Management</h1>
            <p className="text-muted-foreground">
              Upload and manage documents for the AI assistant's knowledge base
            </p>
          </div>

          {/* Upload Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="document-upload">
                    Choose a document (PDF, DOCX, or TXT)
                  </Label>
                  <input
                    ref={fileInputRef}
                    id="document-upload"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="mt-2 block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90
                      file:cursor-pointer cursor-pointer"
                    data-testid="input-document-upload"
                  />
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{selectedFile.name}</span>
                    <span className="text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                )}
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  data-testid="button-upload-document"
                >
                  {uploadMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {uploadMutation.isPending ? 'Processing...' : 'Upload & Process'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Uploaded Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents uploaded yet
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`document-item-${doc.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{doc.filename}</span>
                          <span className="text-xs text-muted-foreground uppercase">
                            {doc.fileType}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {doc.chunkCount} chunks • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={doc.isActive}
                            onCheckedChange={() => handleToggle(doc.documentId)}
                            disabled={toggleMutation.isPending}
                            data-testid={`toggle-document-${doc.id}`}
                          />
                          <Label className="text-sm">
                            {doc.isActive ? 'Active' : 'Inactive'}
                          </Label>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-document-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{doc.filename}"? This will remove all chunks from the knowledge base.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(doc.documentId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

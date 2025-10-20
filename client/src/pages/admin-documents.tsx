import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Sidebar from "@/components/sidebar";
import { Upload, FileText, Trash2, Save } from "lucide-react";

interface Document {
  id: string;
  documentId: string;
  filename: string;
  uploadedAt: string | Date;
  isActive: boolean;
  fileType: 'pdf' | 'docx' | 'txt';
  chunkCount: number;
}

export default function AdminDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [systemPrompt, setSystemPrompt] = useState("");

  // Carregar documentos
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/admin/documents"],
    enabled: user?.isAdmin === true,
  });

  // Upload de documento
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      const response = await fetch('/api/admin/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload falhou');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Documento enviado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar documento", variant: "destructive" });
    },
  });

  // Toggle ativo/inativo
  const toggleMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest(`/api/admin/documents/${documentId}/toggle`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Status atualizado" });
    },
  });

  // Deletar documento
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest(`/api/admin/documents/${documentId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Documento removido" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  if (!user?.isAdmin) {
    return <div className="p-8">Acesso negado</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          
          {/* TÍTULO PRINCIPAL */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Configuração do Assistente</h1>
            <p className="text-muted-foreground">
              Configure o prompt do sistema e adicione documentos de contexto
            </p>
          </div>

          {/* SEÇÃO 1: PROMPT DO SISTEMA */}
          <Card className="p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6" />
              <h2 className="text-2xl font-semibold">Prompt do Sistema</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Instruções que o assistente seguirá em todas as conversas
            </p>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Digite as instruções do sistema aqui..."
              className="min-h-[200px] mb-4 font-mono text-sm"
            />
            <Button onClick={() => toast({ title: "Prompt salvo (em desenvolvimento)" })}>
              <Save className="mr-2 h-4 w-4" />
              Salvar Prompt
            </Button>
          </Card>

          {/* SEÇÃO 2: DOCUMENTOS DE CONTEXTO */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="h-6 w-6" />
              <h2 className="text-2xl font-semibold">Documentos de Contexto</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Faça upload de documentos (PDF, DOCX, TXT) que o assistente usará como referência
            </p>
            
            {/* Upload */}
            <div className="mb-8">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Clique para fazer upload ou arraste o arquivo aqui
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX ou TXT (máx. 10MB)
                  </p>
                </div>
              </Label>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Lista de Documentos */}
            <div className="space-y-3">
              <h3 className="font-medium mb-3">
                Documentos Carregados ({documents.length})
              </h3>
              
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum documento carregado ainda
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.chunkCount} chunks • {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={doc.isActive}
                          onCheckedChange={() => toggleMutation.mutate(doc.documentId)}
                        />
                        <Label className="text-sm">
                          {doc.isActive ? 'Ativo' : 'Inativo'}
                        </Label>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover "${doc.filename}"?`)) {
                            deleteMutation.mutate(doc.documentId);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { User, Volume2, VolumeX, Pause, Loader2, Music, FileAudio, Maximize2, FileText, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, MessageAttachment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import LogoWithBackground from "./LogoWithBackground";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface MessageProps {
  message: Message;
  speechSynthesis?: SpeechSynthesis;
  selectedLanguage?: string;
}

export default function MessageComponent({ message, speechSynthesis, selectedLanguage }: MessageProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: attachments = [] } = useQuery<MessageAttachment[]>({
    queryKey: ["/api/messages", message.id, "attachments"],
    retry: false,
  });

  const getDisplayContent = (content: string) => {
    return content.replace(/\[Attachment:\s*[^\]]+\]/g, '').trim();
  };
  
  useEffect(() => {
    if (speechSynthesis) {
      setIsSpeaking(speechSynthesis.isSpeaking);
      setIsLoading(speechSynthesis.isLoading);
    }
  }, [speechSynthesis?.isSpeaking, speechSynthesis?.isLoading]);

  const handleSpeak = () => {
    if (!speechSynthesis || !speechSynthesis.isSupported) return;
    
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speechSynthesis.speak(message.content, selectedLanguage);
      setIsSpeaking(true);
    }
  };
  const formatTimestamp = (timestamp: string | Date | null | undefined) => {
    if (!timestamp) return "Unknown";
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)} minutes ago`;
    
    const diffInHours = diffInMinutes / 60;
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    
    return date.toLocaleDateString();
  };

  if (message.role === "user") {
    const displayContent = getDisplayContent(message.content);
    return (
      <div className="flex justify-end" data-testid={`message-user-${message.id}`}>
        <div className="max-w-2xl">
          <div className="bg-primary text-primary-foreground rounded-lg rounded-br-sm p-4">
            {displayContent && <p data-testid={`text-message-content-${message.id}`}>{displayContent}</p>}
            {/* Display attachments */}
            {attachments.length > 0 && (
              <div className={`space-y-2 ${displayContent ? 'mt-3' : ''}`}>
                {attachments.map((attachment) => (
                  <div key={attachment.id} data-testid={`attachment-${attachment.id}`}>
                    {attachment.fileType === 'image' ? (
                      <Dialog>
                        <div className="relative group">
                          <img
                            src={`/${attachment.storagePath}`}
                            alt={attachment.originalName}
                            className="max-w-sm max-h-64 object-contain rounded border border-primary-foreground/20 cursor-pointer hover:opacity-90 transition-opacity"
                            data-testid={`img-attachment-${attachment.id}`}
                          />
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              data-testid={`button-expand-image-${attachment.id}`}
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        </div>
                        <DialogContent className="max-w-4xl">
                          <img
                            src={`/${attachment.storagePath}`}
                            alt={attachment.originalName}
                            className="w-full h-auto max-h-[80vh] object-contain"
                            data-testid={`img-attachment-expanded-${attachment.id}`}
                          />
                        </DialogContent>
                      </Dialog>
                    ) : attachment.fileType === 'audio' ? (
                      <div className="bg-primary-foreground/10 rounded p-2">
                        <div className="flex items-center space-x-2 mb-2">
                          <FileAudio className="h-4 w-4" />
                          <span className="text-sm" data-testid={`text-attachment-name-${attachment.id}`}>
                            {attachment.originalName}
                          </span>
                        </div>
                        <audio 
                          controls 
                          className="w-full" 
                          data-testid={`audio-player-${attachment.id}`}
                        >
                          <source src={`/${attachment.storagePath}`} type={attachment.mimeType} />
                          Your browser does not support the audio element.
                        </audio>
                        {attachment.transcription && (
                          <div className="mt-2 pt-2 border-t border-primary-foreground/20">
                            <p className="text-xs font-medium mb-1">Transcription:</p>
                            <p className="text-sm" data-testid={`text-transcription-${attachment.id}`}>
                              {attachment.transcription}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : attachment.fileType === 'document' ? (
                      <a 
                        href={`/${attachment.storagePath}`} 
                        download={attachment.originalName}
                        className="block bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg p-3 hover:bg-primary-foreground/20 hover:border-primary-foreground/30 transition-all"
                        data-testid={`link-document-${attachment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" data-testid={`text-attachment-name-${attachment.id}`}>
                              {attachment.originalName}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatFileSize(attachment.fileSize)}
                            </div>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" />
                        </div>
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right" data-testid={`text-message-timestamp-${message.id}`}>
            {formatTimestamp(message.createdAt || "")}
          </p>
        </div>
      </div>
    );
  }

  const displayContent = getDisplayContent(message.content);
  return (
    <div className="flex justify-start" data-testid={`message-assistant-${message.id}`}>
      <div className="max-w-2xl">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            <LogoWithBackground size="sm" />
          </div>
          <div className="bg-card border border-border rounded-lg rounded-bl-sm p-4">
            {displayContent && (
              <div className="text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none" data-testid={`text-message-content-${message.id}`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                    em: ({node, ...props}) => <em className="italic" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                    li: ({node, ...props}) => <li className="mb-1" {...props} />,
                    code: ({node, inline, ...props}) => 
                      inline 
                        ? <code className="bg-muted text-foreground px-1 py-0.5 rounded text-sm font-mono" {...props} />
                        : <pre className="bg-muted p-2 rounded overflow-x-auto"><code className="text-foreground text-sm font-mono whitespace-pre" {...props} /></pre>,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 italic my-2" {...props} />,
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              </div>
            )}
            {/* Display attachments */}
            {attachments.length > 0 && (
              <div className={`space-y-2 ${displayContent ? 'mt-3' : ''}`}>
                {attachments.map((attachment) => (
                  <div key={attachment.id} data-testid={`attachment-${attachment.id}`}>
                    {attachment.fileType === 'image' ? (
                      <Dialog>
                        <div className="relative group">
                          <img
                            src={`/${attachment.storagePath}`}
                            alt={attachment.originalName}
                            className="max-w-sm max-h-64 object-contain rounded border border-border cursor-pointer hover:opacity-90 transition-opacity"
                            data-testid={`img-attachment-${attachment.id}`}
                          />
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              data-testid={`button-expand-image-${attachment.id}`}
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        </div>
                        <DialogContent className="max-w-4xl">
                          <img
                            src={`/${attachment.storagePath}`}
                            alt={attachment.originalName}
                            className="w-full h-auto max-h-[80vh] object-contain"
                            data-testid={`img-attachment-expanded-${attachment.id}`}
                          />
                        </DialogContent>
                      </Dialog>
                    ) : attachment.fileType === 'audio' ? (
                      <div className="bg-muted rounded p-2">
                        <div className="flex items-center space-x-2 mb-2">
                          <FileAudio className="h-4 w-4 text-primary" />
                          <span className="text-sm" data-testid={`text-attachment-name-${attachment.id}`}>
                            {attachment.originalName}
                          </span>
                        </div>
                        <audio 
                          controls 
                          className="w-full" 
                          data-testid={`audio-player-${attachment.id}`}
                        >
                          <source src={`/${attachment.storagePath}`} type={attachment.mimeType} />
                          Your browser does not support the audio element.
                        </audio>
                        {attachment.transcription && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs font-medium mb-1 text-muted-foreground">Transcription:</p>
                            <p className="text-sm" data-testid={`text-transcription-${attachment.id}`}>
                              {attachment.transcription}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : attachment.fileType === 'document' ? (
                      <a 
                        href={`/${attachment.storagePath}`} 
                        download={attachment.originalName}
                        className="block bg-muted border border-border rounded-lg p-3 hover:bg-muted/80 hover:border-primary/30 transition-all"
                        data-testid={`link-document-${attachment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" data-testid={`text-attachment-name-${attachment.id}`}>
                              {attachment.originalName}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatFileSize(attachment.fileSize)}
                            </div>
                          </div>
                          <Download className="h-4 w-4 text-primary flex-shrink-0" />
                        </div>
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {speechSynthesis && speechSynthesis.isSupported && (
              <Button
                onClick={handleSpeak}
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2"
                data-testid={`button-speak-${message.id}`}
                disabled={isLoading}
                aria-label={
                  isLoading 
                    ? "Loading audio..." 
                    : isSpeaking 
                      ? "Stop speaking" 
                      : "Play message"
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading...
                  </>
                ) : isSpeaking ? (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3 w-3 mr-1" />
                    Play
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-11" data-testid={`text-message-timestamp-${message.id}`}>
          {formatTimestamp(message.createdAt || "")}
        </p>
      </div>
    </div>
  );
}

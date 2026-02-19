import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Mic, MicOff, Square, Paperclip, Loader2, X, Image, Music, FileText, Menu } from "lucide-react";
import LogoWithBackground from "../LogoWithBackground";
import FeedbackForm from "../feedback-form";
import { VoiceRecordingIndicator } from "./VoiceRecordingIndicator";

interface WelcomeScreenProps {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  message: string;
  setMessage: (msg: string) => void;
  selectedFile: File | null;
  uploadProgress: number;
  isTyping: boolean;
  isListening: boolean;
  isSpeechRecognitionSupported: boolean;
  permissionDenied: boolean;
  elapsedTime: number;
  volumeLevel: number;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  toggleSpeechRecognition: () => void;
  sendMessagePending: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  currentAssistantName: string;
  currentAssistantDescription: string;
}

export function WelcomeScreen({
  isMobile = false,
  onOpenSidebar,
  message,
  setMessage,
  selectedFile,
  uploadProgress,
  isTyping,
  isListening,
  isSpeechRecognitionSupported,
  permissionDenied,
  elapsedTime,
  volumeLevel,
  onSubmit,
  onKeyDown,
  onFileSelect,
  onRemoveFile,
  toggleSpeechRecognition,
  sendMessagePending,
  fileInputRef,
  textareaRef,
  currentAssistantName,
  currentAssistantDescription
}: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="welcome-screen">
      {isMobile && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-12 px-3 touch-manipulation hover:bg-muted/50"
            onClick={onOpenSidebar}
            data-testid="button-sidebar-toggle-welcome"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <span className="font-semibold text-foreground" data-testid="heading-app-title">
            OBT Mentor Companion
          </span>

          <FeedbackForm
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-12 px-3 touch-manipulation hover:bg-muted/50"
                data-testid="button-feedback-welcome"
                aria-label="Send feedback"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      )}

      <div className="flex-1 flex justify-center items-center overflow-y-auto">
        <div className={`max-w-2xl text-center mx-auto ${isMobile ? 'px-4 phone-xs:px-3 phone-sm:px-4' : ''}`}>
          <div className="flex justify-center mx-auto mb-4">
            <LogoWithBackground size="lg" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to {currentAssistantName}</h2>
          <p className="text-muted-foreground mb-6">{currentAssistantDescription}</p>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Start typing below to begin a new conversation
            </p>

            <FeedbackForm
              trigger={
                <Button
                  variant="outline"
                  className={`w-full max-w-sm ${isMobile ? 'h-12' : ''} border-primary/20 hover:bg-primary/5`}
                  data-testid="button-feedback-welcome-center"
                  aria-label="Send feedback about the app"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Feedback
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <div className={`border-t border-border bg-card sticky bottom-0 z-40 shadow-up ${isMobile ? 'p-3 phone-xs:p-2 phone-sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'p-4'}`}>
        {isListening && (
          <VoiceRecordingIndicator
            elapsedTime={elapsedTime}
            volumeLevel={volumeLevel}
            onStop={toggleSpeechRecognition}
            isMobile={isMobile}
          />
        )}

        <form onSubmit={onSubmit} className={`flex ${isMobile ? 'space-x-2 phone-xs:space-x-1 phone-sm:space-x-2' : 'space-x-3'}`} data-testid="form-message">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onFileSelect}
            className="hidden"
            data-testid="input-file"
          />
          <div className="flex-1 min-w-0">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={isTyping}
              className={`resize-none min-h-[44px] max-h-[60px] md:max-h-[120px] ${isMobile ? 'text-sm phone-sm:text-base' : ''} ${isTyping ? 'opacity-60' : ''}`}
              placeholder={
                isTyping
                  ? "AI is responding..."
                  : isListening
                    ? "Listening..."
                    : ""
              }
              data-testid="textarea-message"
            />
          </div>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
            className={`${isMobile ? 'min-h-[44px] min-w-[44px] h-11 w-11 phone-sm:h-12 phone-sm:w-12 p-0 touch-manipulation shrink-0' : 'h-11 w-11'}`}
            data-testid="button-attach-file"
            aria-label="Attach file"
            disabled={isTyping}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          {isSpeechRecognitionSupported && (
            <Button
              type="button"
              onClick={toggleSpeechRecognition}
              variant={isListening ? "destructive" : "secondary"}
              className={`${isMobile ? 'min-h-[44px] min-w-[44px] h-11 w-11 phone-sm:h-12 phone-sm:w-12 p-0 touch-manipulation shrink-0' : 'h-11 w-11'} ${isListening ? 'recording-active' : ''}`}
              data-testid="button-microphone"
              aria-label={isListening ? "Stop recording" : "Start recording"}
              disabled={permissionDenied || isTyping}
            >
              {isListening ? (
                <Square className="h-4 w-4" />
              ) : permissionDenied ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            type="submit"
            disabled={(!message.trim() && !selectedFile) || sendMessagePending || isTyping}
            className={`${isMobile ? 'min-h-[44px] min-w-[44px] h-11 w-11 phone-sm:h-12 phone-sm:w-12 p-0 touch-manipulation shrink-0' : 'h-11'}`}
            data-testid="button-send"
            aria-label={
              isTyping || sendMessagePending
                ? "Sending..."
                : "Send message"
            }
          >
            {isTyping || sendMessagePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground mt-2 text-center`}>
          You are chatting with {currentAssistantName}
        </p>
      </div>
    </div>
  );
}

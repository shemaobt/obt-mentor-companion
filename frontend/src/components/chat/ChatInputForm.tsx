import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, MicOff, Square, Paperclip, Loader2, X, Image, Music, FileText } from "lucide-react";
import type { ChatInputFormProps } from "./types";

export function ChatInputForm({
  message,
  setMessage,
  isTyping,
  isMobile,
  selectedFile,
  uploadProgress,
  onFileSelect,
  onRemoveFile,
  onSubmit,
  onKeyDown,
  textareaRef,
  fileInputRef,
  isListening,
  isSpeechRecognitionSupported,
  permissionDenied,
  toggleSpeechRecognition,
  sendMessageMutationPending,
  currentAssistantName
}: ChatInputFormProps) {
  return (
    <div className={`border-t border-border bg-card sticky bottom-0 z-40 shadow-up ${isMobile ? 'p-3 phone-xs:p-2 phone-sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'p-4'}`}>
      {selectedFile && (
        <div className="mb-3 p-3 bg-muted rounded-lg border border-border" data-testid="file-preview">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {selectedFile.type.startsWith('image/') ? (
                <>
                  <Image className="h-5 w-5 text-primary flex-shrink-0" />
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Preview"
                    className="h-12 w-12 object-cover rounded border border-border"
                    data-testid="img-file-preview"
                  />
                </>
              ) : selectedFile.type.startsWith('audio/') ? (
                <Music className="h-5 w-5 text-primary flex-shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-file-name">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-file-size">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-1 w-full bg-secondary rounded-full h-1">
                    <div
                      className="bg-primary h-1 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                      data-testid="progress-upload"
                    />
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveFile}
              className="h-8 w-8 p-0 flex-shrink-0"
              data-testid="button-remove-file"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
                  : (isMobile ? "Ask about stories..." : "Type your message...")
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
          disabled={(!message.trim() && !selectedFile) || sendMessageMutationPending || isTyping}
          className={`${isMobile ? 'min-h-[44px] min-w-[44px] h-11 w-11 phone-sm:h-12 phone-sm:w-12 p-0 touch-manipulation shrink-0' : 'h-11'}`}
          data-testid="button-send"
          aria-label={
            isTyping || sendMessageMutationPending
              ? "Sending..."
              : "Send message"
          }
        >
          {isTyping || sendMessageMutationPending ? (
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
  );
}

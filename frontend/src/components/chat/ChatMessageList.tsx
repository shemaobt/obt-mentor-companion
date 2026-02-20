import MessageComponent from "../message";
import LogoWithBackground from "../LogoWithBackground";
import type { ChatMessageListProps } from "./types";

export function ChatMessageList({
  messages,
  streamingMessage,
  isTyping,
  isMobile,
  speechSynthesis,
  selectedLanguage,
  messagesEndRef
}: ChatMessageListProps) {
  return (
    <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-3 pb-28 space-y-4' : 'p-4 pb-32 space-y-6'}`} data-testid="chat-messages">
      {messages.map((msg) => (
        <MessageComponent
          key={msg.id}
          message={msg}
          speechSynthesis={speechSynthesis}
          selectedLanguage={selectedLanguage}
        />
      ))}

      {streamingMessage && (
        <div className="flex justify-start" data-testid="streaming-message">
          <div className="max-w-2xl">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                <LogoWithBackground size="sm" />
              </div>
              <div className="bg-card border border-border rounded-lg rounded-bl-sm p-4">
                <div className="text-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-streaming-content">
                  {streamingMessage.content}
                  {!streamingMessage.isComplete && (
                    <span className="animate-pulse">▋</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-11">
              {streamingMessage.isComplete ? "Just now" : "Generating..."}
            </p>
          </div>
        </div>
      )}

      {isTyping && !streamingMessage && (
        <div className="flex justify-start" data-testid="typing-indicator">
          <div className="max-w-2xl">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                <LogoWithBackground size="sm" />
              </div>
              <div className="bg-card border border-border rounded-lg rounded-bl-sm p-4">
                <div className="flex space-x-1">
                  <div className="typing-indicator"></div>
                  <div className="typing-indicator"></div>
                  <div className="typing-indicator"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

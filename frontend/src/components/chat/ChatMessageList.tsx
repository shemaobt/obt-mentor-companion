import MessageComponent from "../message";
import { StreamingMessage } from "./StreamingMessage";
import { TypingIndicator } from "./TypingIndicator";
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

      {streamingMessage && <StreamingMessage streamingMessage={streamingMessage} />}

      {isTyping && !streamingMessage && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}

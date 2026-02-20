import LogoWithBackground from "../LogoWithBackground";

export function TypingIndicator() {
  return (
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
  );
}

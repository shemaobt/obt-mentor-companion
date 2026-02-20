import { useState, useEffect, useRef } from "react";
import LogoWithBackground from "../LogoWithBackground";
import type { StreamingMessage as StreamingMessageType } from "./types";

const TYPING_SPEED_MS = 15;

interface StreamingMessageProps {
  streamingMessage: StreamingMessageType;
}

export function StreamingMessage({ streamingMessage }: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const targetContentRef = useRef("");
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    targetContentRef.current = streamingMessage.content;
    
    if (displayedContent.length < streamingMessage.content.length && !isAnimating) {
      setIsAnimating(true);
    }
  }, [streamingMessage.content, displayedContent.length, isAnimating]);

  useEffect(() => {
    if (!isAnimating) return;

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= TYPING_SPEED_MS) {
        lastUpdateRef.current = timestamp;
        
        setDisplayedContent(prev => {
          const target = targetContentRef.current;
          if (prev.length < target.length) {
            const charsToAdd = Math.min(3, target.length - prev.length);
            return target.slice(0, prev.length + charsToAdd);
          }
          return prev;
        });
      }

      if (displayedContent.length < targetContentRef.current.length) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, displayedContent.length]);

  useEffect(() => {
    if (streamingMessage.isComplete && displayedContent.length < streamingMessage.content.length) {
      setDisplayedContent(streamingMessage.content);
      setIsAnimating(false);
    }
  }, [streamingMessage.isComplete, streamingMessage.content, displayedContent.length]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const showCursor = !streamingMessage.isComplete || isAnimating;

  return (
    <div className="flex justify-start" data-testid="streaming-message">
      <div className="max-w-2xl">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            <LogoWithBackground size="sm" />
          </div>
          <div className="bg-card border border-border rounded-lg rounded-bl-sm p-4">
            <div className="text-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-streaming-content">
              {displayedContent.length === 0 && !streamingMessage.isComplete ? (
                <div className="flex space-x-1">
                  <div className="typing-indicator"></div>
                  <div className="typing-indicator"></div>
                  <div className="typing-indicator"></div>
                </div>
              ) : (
                <>
                  {displayedContent}
                  {showCursor && (
                    <span className="animate-pulse">▋</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-11">
          {streamingMessage.isComplete && !isAnimating ? "Just now" : "Generating..."}
        </p>
      </div>
    </div>
  );
}

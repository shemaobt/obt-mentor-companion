import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";

interface VoiceRecordingIndicatorProps {
  elapsedTime: number;
  volumeLevel: number;
  onStop: () => void;
  isMobile?: boolean;
}

export function VoiceRecordingIndicator({ 
  elapsedTime, 
  volumeLevel, 
  onStop,
  isMobile = false 
}: VoiceRecordingIndicatorProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRandomHeight = (index: number): number => {
    const baseHeight = 30 + (volumeLevel / 3);
    const variation = Math.sin(Date.now() / 100 + index) * 20;
    return Math.max(10, Math.min(90, baseHeight + variation));
  };

  return (
    <div 
      className="mb-3 p-4 bg-destructive/10 dark:bg-destructive/20 rounded-lg border border-destructive/30 backdrop-blur-sm" 
      data-testid="audio-recording-indicator"
      role="status"
      aria-live="polite"
      aria-label={`Recording audio. Duration: ${Math.floor(elapsedTime / 60)} minutes and ${elapsedTime % 60} seconds`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" aria-hidden="true" />
          <span className={`font-medium text-destructive ${isMobile ? 'text-sm' : ''}`}>
            Recording
          </span>
        </div>
        <span 
          className={`font-mono ${isMobile ? 'text-sm' : ''} text-foreground`}
          data-testid="recording-elapsed-time"
        >
          {formatTime(elapsedTime)}
        </span>
      </div>
      
      <div className="flex items-center justify-center space-x-1 h-12 mb-3" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => {
          const height = getRandomHeight(i);
          return (
            <div
              key={i}
              className="bg-destructive rounded-full transition-all duration-75"
              style={{
                width: '4px',
                height: `${height}%`,
                opacity: 0.3 + (volumeLevel / 150)
              }}
            />
          );
        })}
      </div>
      
      <div className="flex justify-center">
        <Button
          type="button"
          variant="destructive"
          size={isMobile ? "lg" : "default"}
          onClick={onStop}
          className={`${isMobile ? 'h-12 px-6 touch-manipulation' : ''}`}
          data-testid="button-stop-recording"
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4 mr-2" />
          Stop Recording
        </Button>
      </div>
    </div>
  );
}

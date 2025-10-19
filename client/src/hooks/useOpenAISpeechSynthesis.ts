import { useState, useRef, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface OpenAISpeechSynthesisOptions {
  lang?: string;
}

interface OpenAISpeechSynthesisHook {
  speak: (text: string, lang?: string) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isSupported: boolean;
  voices: Array<{name: string, lang: string, id: string}>;
  selectedVoice: {name: string, lang: string, id: string} | null;
  setSelectedVoice: (voice: {name: string, lang: string, id: string} | null) => void;
}

// Local cache management
const CACHE_KEY_PREFIX = 'openai_tts_';
const CACHE_EXPIRY_HOURS = 24;
const MAX_CACHE_SIZE = 50; // Maximum number of cached audio files

interface CachedAudio {
  url: string;
  timestamp: number;
  language: string;
  textHash: string;
}

// Simple hash function for text
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Cache management functions
function getCachedAudio(text: string, language: string, voiceName: string): string | null {
  try {
    const textHash = simpleHash(text);
    const cacheKey = `${CACHE_KEY_PREFIX}${language}_${voiceName}_${textHash}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const { url, timestamp }: CachedAudio = JSON.parse(cached);
      const now = Date.now();
      const ageHours = (now - timestamp) / (1000 * 60 * 60);
      
      if (ageHours < CACHE_EXPIRY_HOURS) {
        return url;
      } else {
        // Clean up expired cache
        localStorage.removeItem(cacheKey);
        URL.revokeObjectURL(url);
      }
    }
  } catch (error) {
    console.warn('Error reading from audio cache:', error);
  }
  
  return null;
}

function setCachedAudio(text: string, language: string, voiceName: string, audioUrl: string): void {
  try {
    const textHash = simpleHash(text);
    const cacheKey = `${CACHE_KEY_PREFIX}${language}_${voiceName}_${textHash}`;
    const cacheData: CachedAudio = {
      url: audioUrl,
      timestamp: Date.now(),
      language,
      textHash
    };
    
    // Check cache size and clean up if necessary
    cleanupOldCache();
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error saving to audio cache:', error);
    // If we can't cache, just continue without caching
  }
}

function cleanupOldCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    
    if (keys.length > MAX_CACHE_SIZE) {
      // Sort by timestamp and remove oldest entries
      const entries = keys.map(key => {
        const cached = localStorage.getItem(key);
        return cached ? { key, data: JSON.parse(cached) } : null;
      }).filter(Boolean) as Array<{key: string, data: CachedAudio}>;
      
      entries.sort((a, b) => a.data.timestamp - b.data.timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
      toRemove.forEach(({ key, data }) => {
        localStorage.removeItem(key);
        URL.revokeObjectURL(data.url);
      });
    }
  } catch (error) {
    console.warn('Error during cache cleanup:', error);
  }
}

export function useOpenAISpeechSynthesis(
  options: OpenAISpeechSynthesisOptions = {}
): OpenAISpeechSynthesisHook {
  const { lang = 'en-US' } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentLanguageRef = useRef<string>(lang);
  const cancelledRef = useRef(false);

  // OpenAI TTS is always supported (just needs internet)
  const isSupported = typeof window !== 'undefined';

  // Voice options - with canonical IDs for backend
  const voices = [
    { name: 'Alloy (Versatile)', lang: 'en-US', id: 'alloy' },
    { name: 'Echo (Male)', lang: 'en-US', id: 'echo' },
    { name: 'Fable (British)', lang: 'en-US', id: 'fable' },
    { name: 'Onyx (Deep)', lang: 'en-US', id: 'onyx' },
    { name: 'Nova (Warm)', lang: 'en-US', id: 'nova' },
    { name: 'Shimmer (Soft)', lang: 'en-US', id: 'shimmer' }
  ];

  const [selectedVoice, setSelectedVoice] = useState<{name: string, lang: string, id: string} | null>(
    voices[0] // Default to Alloy (Versatile) - better than Echo
  );
  
  // Use ref to track current voice to avoid closure issues in callbacks
  const selectedVoiceRef = useRef(selectedVoice);
  
  // Update ref whenever selectedVoice changes
  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  // Update current language when prop changes
  useEffect(() => {
    currentLanguageRef.current = lang;
  }, [lang]);

  // Split text into smaller chunks for faster generation and playback
  const splitTextIntoChunks = (text: string, maxChunkLength = 500): string[] => {
    const chunks: string[] = [];
    
    // Split by paragraphs first (double newlines)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChunkLength) {
        chunks.push(paragraph.trim());
      } else {
        // Split long paragraphs by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [];
        
        // If no sentences found (no punctuation), force split by maxChunkLength
        if (sentences.length === 0) {
          let remaining = paragraph;
          while (remaining.length > 0) {
            chunks.push(remaining.substring(0, maxChunkLength).trim());
            remaining = remaining.substring(maxChunkLength);
          }
          continue;
        }
        
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChunkLength) {
            currentChunk += sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            // If a single sentence is too long, force split it
            if (sentence.length > maxChunkLength) {
              let remaining = sentence;
              while (remaining.length > 0) {
                chunks.push(remaining.substring(0, maxChunkLength).trim());
                remaining = remaining.substring(maxChunkLength);
              }
              currentChunk = '';
            } else {
              currentChunk = sentence;
            }
          }
        }
        
        if (currentChunk) chunks.push(currentChunk.trim());
      }
    }
    
    return chunks.filter(c => c.length > 0);
  };

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text: string, targetLang?: string) => {
    if (!isSupported || !text.trim()) return;

    try {
      // Cancel any current playback
      cancel();
      
      // Reset cancellation flag for this new speak call
      cancelledRef.current = false;

      const language = targetLang || currentLanguageRef.current;
      const voiceId = selectedVoiceRef.current?.id || 'alloy';
      
      // Split text into chunks for faster generation
      const chunks = splitTextIntoChunks(text);
      
      if (chunks.length === 0) return;
      
      // Function to generate audio for a chunk (returns URL promise)
      const generateChunkAudio = async (chunkText: string, isFirstChunk: boolean): Promise<string | null> => {
        // Check if cancelled before starting generation
        if (cancelledRef.current) {
          return null;
        }
        
        // Check cache first
        let audioUrl = getCachedAudio(chunkText, language, voiceId);
        
        if (audioUrl) {
          return audioUrl;
        }
        
        // Only show loading indicator for the first chunk
        if (isFirstChunk) {
          setIsLoading(true);
        }
        
        const response = await apiRequest('POST', '/api/audio/speak', {
          text: chunkText.trim(),
          language,
          voice: voiceId
        });

        // Check if cancelled after request
        if (cancelledRef.current) {
          if (isFirstChunk) {
            setIsLoading(false);
          }
          return null;
        }

        if (!response.ok) {
          throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        
        // Cache the audio
        setCachedAudio(chunkText, language, voiceId, audioUrl);
        
        if (isFirstChunk) {
          setIsLoading(false);
        }
        
        return audioUrl;
      };
      
      // Function to play a single audio URL
      const playAudioUrl = (audioUrl: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          // Check if cancelled before playing
          if (cancelledRef.current) {
            resolve();
            return;
          }
          
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          
          // Poll for cancellation during playback
          const cancelCheckInterval = setInterval(() => {
            if (cancelledRef.current) {
              clearInterval(cancelCheckInterval);
              resolve();
            }
          }, 100); // Check every 100ms

          audio.onloadstart = () => setIsSpeaking(true);
          audio.onplay = () => {
            setIsSpeaking(true);
            setIsPaused(false);
          };
          audio.onended = () => {
            clearInterval(cancelCheckInterval);
            resolve();
          };
          audio.onerror = (e) => {
            clearInterval(cancelCheckInterval);
            console.error('Audio playback error:', e);
            reject(e);
          };

          audio.play().catch((e) => {
            clearInterval(cancelCheckInterval);
            reject(e);
          });
        });
      };

      // Pipeline: Generate next chunk while current one plays
      const audioUrlPromises: Promise<string | null>[] = [];
      
      // Start generating all chunks immediately (parallel generation)
      for (let i = 0; i < chunks.length; i++) {
        audioUrlPromises.push(generateChunkAudio(chunks[i], i === 0));
      }
      
      // Play chunks sequentially as they become ready
      for (const urlPromise of audioUrlPromises) {
        // Check if cancelled before waiting for next chunk
        if (cancelledRef.current) {
          break;
        }
        
        const audioUrl = await urlPromise;
        
        // Skip if cancelled or generation returned null
        if (cancelledRef.current || !audioUrl) {
          break;
        }
        
        await playAudioUrl(audioUrl);
      }
      
      // All chunks done (or cancelled)
      if (!cancelledRef.current) {
        setIsSpeaking(false);
        setIsPaused(false);
        audioRef.current = null;
      }

    } catch (error) {
      console.error('Error in text-to-speech:', error);
      setIsSpeaking(false);
      setIsPaused(false);
      setIsLoading(false);
    }
  }, [isSupported, cancel]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
      setIsPaused(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    isLoading,
    isSupported,
    voices,
    selectedVoice,
    setSelectedVoice
  };
}
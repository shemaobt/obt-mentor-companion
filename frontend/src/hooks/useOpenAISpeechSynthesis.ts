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

const CACHE_KEY_PREFIX = 'openai_tts_';
const CACHE_EXPIRY_HOURS = 24;
const MAX_CACHE_SIZE = 50;

interface CachedAudio {
  url: string;
  timestamp: number;
  language: string;
  textHash: string;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

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
    
    cleanupOldCache();
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error saving to audio cache:', error);
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
      const entries = keys.map(key => {
        const cached = localStorage.getItem(key);
        return cached ? { key, data: JSON.parse(cached) } : null;
      }).filter(Boolean) as Array<{key: string, data: CachedAudio}>;
      
      entries.sort((a, b) => a.data.timestamp - b.data.timestamp);
      
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

  const isSupported = typeof window !== 'undefined';

  const voices = [
    { name: 'Alloy (Versatile)', lang: 'en-US', id: 'alloy' },
    { name: 'Echo (Male)', lang: 'en-US', id: 'echo' },
    { name: 'Fable (British)', lang: 'en-US', id: 'fable' },
    { name: 'Onyx (Deep)', lang: 'en-US', id: 'onyx' },
    { name: 'Nova (Warm)', lang: 'en-US', id: 'nova' },
    { name: 'Shimmer (Soft)', lang: 'en-US', id: 'shimmer' }
  ];

  const [selectedVoice, setSelectedVoice] = useState<{name: string, lang: string, id: string} | null>(
    voices[0]
  );
  
  const selectedVoiceRef = useRef(selectedVoice);
  
  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  useEffect(() => {
    currentLanguageRef.current = lang;
  }, [lang]);

  const splitTextIntoChunks = (text: string, maxChunkLength = 150): string[] => {
    const chunks: string[] = [];
    
    const sentenceMatches = text.match(/[^.!?]+[.!?]+/g);
    let sentences: string[] = [];
    
    if (sentenceMatches) {
      sentences = [...sentenceMatches];
      
      const matchedLength = sentenceMatches.reduce((sum, s) => sum + s.length, 0);
      const remainder = text.slice(matchedLength).trim();
      
      if (remainder) {
        sentences.push(remainder);
      }
    } else {
      sentences = [text];
    }
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (!trimmedSentence) continue;
      
      if (trimmedSentence.length <= maxChunkLength) {
        chunks.push(trimmedSentence);
      } else {
        const subParts = trimmedSentence.split(/([,;:])\s+/);
        let currentChunk = '';
        
        for (let i = 0; i < subParts.length; i++) {
          const part = subParts[i];
          
          if (part === ',' || part === ';' || part === ':') {
            currentChunk += part;
            continue;
          }
          
          if ((currentChunk + ' ' + part).trim().length <= maxChunkLength) {
            currentChunk = (currentChunk + ' ' + part).trim();
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            
            if (part.length > maxChunkLength) {
              const words = part.split(/\s+/);
              currentChunk = '';
              
              for (const word of words) {
                if ((currentChunk + ' ' + word).trim().length <= maxChunkLength) {
                  currentChunk = (currentChunk + ' ' + word).trim();
                } else {
                  if (currentChunk) {
                    chunks.push(currentChunk);
                  }
                  currentChunk = word;
                }
              }
            } else {
              currentChunk = part;
            }
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk);
        }
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
      cancel();
      
      cancelledRef.current = false;

      const language = targetLang || currentLanguageRef.current;
      const voiceId = selectedVoiceRef.current?.id || 'alloy';
      
      const chunks = splitTextIntoChunks(text);
      
      if (chunks.length === 0) return;
      
      const generateChunkAudio = async (chunkText: string, isFirstChunk: boolean): Promise<string | null> => {
        if (cancelledRef.current) {
          return null;
        }
        
        if (isFirstChunk) {
          setIsLoading(true);
        }
        
        const response = await apiRequest('POST', '/api/audio/speak', {
          text: chunkText.trim(),
          language,
          voice: voiceId
        });

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
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (isFirstChunk) {
          setIsLoading(false);
        }
        
        return audioUrl;
      };
      
      const playAudioUrl = (audioUrl: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (cancelledRef.current) {
            resolve();
            return;
          }
          
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          
          const cancelCheckInterval = setInterval(() => {
            if (cancelledRef.current) {
              clearInterval(cancelCheckInterval);
              resolve();
            }
          }, 100);

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

      const MAX_PARALLEL_CHUNKS = 2;
      
      let currentIndex = 0;
      const pendingChunks = new Map<number, Promise<string | null>>();
      
      const startChunkGeneration = (index: number) => {
        if (index < chunks.length && !pendingChunks.has(index)) {
          const promise = generateChunkAudio(chunks[index], index === 0);
          pendingChunks.set(index, promise);
        }
      };
      
      for (let i = 0; i < Math.min(MAX_PARALLEL_CHUNKS, chunks.length); i++) {
        startChunkGeneration(i);
      }
      
      while (currentIndex < chunks.length) {
        if (cancelledRef.current) {
          break;
        }
        
        const urlPromise = pendingChunks.get(currentIndex);
        if (!urlPromise) {
          console.error(`No promise for chunk ${currentIndex}`);
          break;
        }
        
        const audioUrl = await urlPromise;
        
        if (cancelledRef.current || !audioUrl) {
          break;
        }
        
        const nextGenIndex = currentIndex + MAX_PARALLEL_CHUNKS;
        startChunkGeneration(nextGenIndex);
        
        await playAudioUrl(audioUrl);
        
        pendingChunks.delete(currentIndex);
        
        currentIndex++;
      }
      
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

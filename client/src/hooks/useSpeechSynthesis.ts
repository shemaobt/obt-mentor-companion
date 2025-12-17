import { useState, useRef, useEffect } from "react";

interface SpeechSynthesisOptions {
  lang?: string;
}

interface SpeechSynthesisHook {
  speak: (text: string, lang?: string) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
}

export function useSpeechSynthesis(options: SpeechSynthesisOptions = {}): SpeechSynthesisHook {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' && 
    'speechSynthesis' in window;

  const selectBestVoice = (targetLang: string, availableVoices: SpeechSynthesisVoice[]) => {
    const langCode = targetLang.split('-')[0];
    
    const languageVoices = availableVoices.filter(voice => 
      voice.lang.startsWith(langCode)
    );
    
    if (languageVoices.length === 0) {
      return availableVoices[0] || null;
    }
    
    const highQualityPatterns = [
      /google.*neural/i,
      /google.*wavenet/i,
      /google.*studio/i,
      /microsoft.*neural/i,
      /microsoft.*natural/i,
      /aria/i,
      /jenny/i,
      /davis/i,
      /jane/i,
      /samantha/i,
      /alex/i,
      /victoria/i,
      /daniel/i,
      /karen/i,
      /moira/i,
      /tessa/i,
      /veena/i,
      /yuri/i,
      /amazon.*neural/i,
      /amazon.*standard/i,
      /neural/i,
      /natural/i,
      /premium/i,
      /enhanced/i,
    ];
    
    const scoredVoices = languageVoices.map(voice => {
      let score = 0;
      const voiceName = voice.name.toLowerCase();
      const voiceUri = voice.voiceURI.toLowerCase();
      
      highQualityPatterns.forEach(pattern => {
        if (pattern.test(voiceName) || pattern.test(voiceUri)) {
          score += 100;
        }
      });
      
      if (voice.localService) {
        score += 50;
      }
      
      if (voice.lang === targetLang) {
        score += 25;
      } else if (voice.lang.startsWith(langCode + '-')) {
        score += 15;
      }
      
      if (voice.default) {
        score += 10;
      }
      
      if (voiceName.includes('premium') || voiceName.includes('plus')) {
        score += 20;
      }
      
      return { voice, score };
    });
    
    scoredVoices.sort((a, b) => b.score - a.score);
    return scoredVoices[0]?.voice || languageVoices[0];
  };

  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      if (availableVoices.length > 0 && !selectedVoice) {
        const bestVoice = selectBestVoice(options.lang || 'en-US', availableVoices);
        setSelectedVoice(bestVoice);
      }
    };

    loadVoices();
    
    const handleVoicesChanged = () => {
      loadVoices();
    };
    
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    }

    return () => {
      if (window.speechSynthesis.removeEventListener) {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported, options.lang]);

  const speak = (text: string, targetLang?: string) => {
    if (!isSupported) {
      console.warn('Speech synthesis is not supported in this browser');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    let voiceToUse = selectedVoice;
    
    if (targetLang && voices.length > 0) {
      voiceToUse = selectBestVoice(targetLang, voices);
    } else if (!voiceToUse && voices.length > 0) {
      voiceToUse = selectBestVoice(options.lang || 'en-US', voices);
    }
    
    if (voiceToUse) {
      utterance.voice = voiceToUse;
      console.log(`Using voice: ${voiceToUse.name} (${voiceToUse.lang}) - Local: ${voiceToUse.localService}`);
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (!isSupported || !isSpeaking) return;
    window.speechSynthesis.pause();
  };

  const resume = () => {
    if (!isSupported || !isPaused) return;
    window.speechSynthesis.resume();
  };

  const cancel = () => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    selectedVoice,
    setSelectedVoice
  };
}

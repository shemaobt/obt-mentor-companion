import type { Message, Chat, AssistantId } from "@shared/schema";
import type { UseMutationResult } from "@tanstack/react-query";

export interface ChatInterfaceProps {
  chatId?: string;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  defaultAssistant?: AssistantId;
  onDefaultAssistantChange?: (assistantId: AssistantId) => void;
}

export interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French (France)', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German (Germany)', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian (Italy)', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'ja-JP', name: 'Japanese (Japan)', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean (Korea)', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'hi-IN', name: 'Hindi (India)', flag: '🇮🇳' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', flag: '🇸🇦' },
  { code: 'ru-RU', name: 'Russian (Russia)', flag: '🇷🇺' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)', flag: '🇳🇱' },
  { code: 'sv-SE', name: 'Swedish (Sweden)', flag: '🇸🇪' },
  { code: 'da-DK', name: 'Danish (Denmark)', flag: '🇩🇰' },
];

export interface SpeechSynthesisHook {
  isSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  error: string | null;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  selectedVoice: { id: string; name: string } | null;
  setSelectedVoice: (voice: { id: string; name: string } | null) => void;
  voices: Array<{ id: string; name: string }>;
}

export interface ChatHeaderProps {
  isMobile: boolean;
  onOpenSidebar?: () => void;
  speechSynthesis: SpeechSynthesisHook;
}

export interface ChatMessageListProps {
  messages: Message[];
  streamingMessage: StreamingMessage | null;
  isTyping: boolean;
  isMobile: boolean;
  speechSynthesis: SpeechSynthesisHook;
  selectedLanguage: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export interface ChatInputFormProps {
  message: string;
  setMessage: (msg: string) => void;
  isTyping: boolean;
  isMobile: boolean;
  selectedFile: File | null;
  uploadProgress: number;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isListening: boolean;
  isSpeechRecognitionSupported: boolean;
  permissionDenied: boolean;
  toggleSpeechRecognition: () => void;
  sendMessageMutationPending: boolean;
  currentAssistantName: string;
}

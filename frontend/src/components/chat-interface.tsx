import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import LogoWithBackground from "./LogoWithBackground";
import ApiQuotaErrorDialog from "./api-quota-error-dialog";
import {
  ChatHeader,
  ChatMessageList,
  ChatInputForm,
  WelcomeScreen,
  VoiceRecordingIndicator,
  LANGUAGE_OPTIONS,
  type StreamingMessage,
  type SpeechSynthesisHook
} from "./chat";
import { useOpenAISpeechRecognition } from "@/hooks/useOpenAISpeechRecognition";
import { useOpenAISpeechSynthesis } from "@/hooks/useOpenAISpeechSynthesis";
import type { Message, Chat, AssistantId } from "@shared/schema";
import { ASSISTANTS } from "@shared/schema";

interface ChatInterfaceProps {
  chatId?: string;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  defaultAssistant?: AssistantId;
  onDefaultAssistantChange?: (assistantId: AssistantId) => void;
}

const ASSISTANT_CONFIG = ASSISTANTS;

export default function ChatInterface({
  chatId,
  isMobile = false,
  onOpenSidebar,
  defaultAssistant = 'obtMentor',
  onDefaultAssistantChange
}: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showQuotaErrorDialog, setShowQuotaErrorDialog] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialMessageSentRef = useRef(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (chatId && !initialMessageSentRef.current) {
      const pendingKey = `pending_message_${chatId}`;
      const pendingData = sessionStorage.getItem(pendingKey);

      if (pendingData) {
        try {
          const { content } = JSON.parse(pendingData);
          initialMessageSentRef.current = true;

          setTimeout(() => {
            sendStreamingMessage(content);
            sessionStorage.removeItem(pendingKey);
          }, 100);
        } catch (error) {
          console.error('Error processing pending message:', error);
          sessionStorage.removeItem(pendingKey);
        }
      }
    }
  }, [chatId]);

  const {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechRecognitionSupported,
    lastError,
    permissionDenied,
    volumeLevel,
    elapsedTime
  } = useOpenAISpeechRecognition({ lang: selectedLanguage });

  const speechSynthesis = useOpenAISpeechSynthesis({ lang: selectedLanguage }) as SpeechSynthesisHook;

  useEffect(() => {
    if (lastError) {
      let errorMessage = 'Speech recognition error occurred';

      if (lastError === 'not-allowed') {
        errorMessage = 'Microphone access denied. Please allow microphone permissions.';
      } else if (lastError === 'no-speech') {
        errorMessage = 'No speech detected. Please try speaking again.';
      } else if (lastError === 'audio-capture') {
        errorMessage = 'Microphone not available. Please check your microphone.';
      } else if (lastError === 'network') {
        errorMessage = 'Network error occurred during speech recognition.';
      }

      toast({
        title: "Voice Input Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [lastError, toast]);

  useEffect(() => {
    if (permissionDenied) {
      toast({
        title: "Microphone Permission Required",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  }, [permissionDenied, toast]);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/chats", chatId, "messages"],
    enabled: !!chatId,
    retry: false,
  });

  const { data: chat } = useQuery<Chat>({
    queryKey: ["/api/chats", chatId],
    enabled: !!chatId,
    retry: false,
  });

  const chatAssistantId = chat?.assistantId as AssistantId | undefined;
  const isValidAssistantId = chatAssistantId && chatAssistantId in ASSISTANT_CONFIG;
  const currentAssistant: AssistantId = (chatId && isValidAssistantId ? chatAssistantId : defaultAssistant) ?? defaultAssistant;

  const switchAssistantMutation = useMutation({
    mutationFn: async (assistantId: AssistantId) => {
      const response = await apiRequest("PATCH", `/api/chats/${chatId}`, { assistantId });
      return { data: await response.json(), assistantId };
    },
    onSuccess: ({ assistantId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Assistant switched",
        description: `Now chatting with ${ASSISTANT_CONFIG[assistantId]?.name || 'OBT Mentor Assistant'}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch assistant",
        variant: "destructive",
      });
    },
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chats", {
        title: "New Chat",
        assistantId: currentAssistant,
      });
      return response.json();
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setLocation(`/chat/${newChat.id}`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create new chat",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/chats/${chatId}/messages`, {
        content,
      });
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setMessage("");
      setIsTyping(false);
    },
    onError: (error) => {
      setIsTyping(false);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const uploadFileAttachment = async (messageId: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(0);
      const response = await fetch(`/api/messages/${messageId}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      setUploadProgress(100);
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  };

  const sendStreamingMessage = async (content: string, file?: File) => {
    if (!chatId) return;

    setIsTyping(true);
    setStreamingMessage(null);

    let userMessageId: string | null = null;

    if (file) {
      try {
        const messageResponse = await apiRequest("POST", `/api/chats/${chatId}/messages/user-only`, {
          content,
        });
        const messageData = await messageResponse.json();
        userMessageId = messageData.id;

        if (userMessageId) {
          await uploadFileAttachment(userMessageId, file);
        }
        setUploadProgress(0);

        queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      } catch (error) {
        console.error('File upload error:', error);
        setIsTyping(false);
        setUploadProgress(0);
        toast({
          title: "Error",
          description: "Failed to upload attachment",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const response = await fetch(`/api/chats/${chatId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          existingMessageId: userMessageId,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setShowQuotaErrorDialog(true);
          setIsTyping(false);
          setStreamingMessage(null);
          return;
        }
        throw new Error('Streaming request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'user_message':
                  queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
                  break;

                case 'assistant_message_start':
                  setIsTyping(false);
                  setStreamingMessage({
                    id: data.data.id,
                    content: '',
                    isComplete: false,
                  });
                  break;

                case 'content':
                  setStreamingMessage(prev => prev ? {
                    ...prev,
                    content: prev.content + data.data,
                  } : null);
                  break;

                case 'done':
                  setIsTyping(false);
                  setStreamingMessage(prev => prev ? {
                    ...prev,
                    isComplete: true,
                  } : null);

                  setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
                    setStreamingMessage(null);
                  }, 100);
                  break;

                case 'error':
                  const errorMessage = data.data.message || '';
                  const isQuotaError = errorMessage.toLowerCase().includes('quota') ||
                    errorMessage.toLowerCase().includes('insufficient_quota') ||
                    errorMessage.includes('429');

                  if (isQuotaError) {
                    setShowQuotaErrorDialog(true);
                    setIsTyping(false);
                    setStreamingMessage(null);
                    return;
                  }

                  throw new Error(errorMessage);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

      setMessage("");
      setIsTyping(false);

    } catch (error: unknown) {
      console.error('Streaming error:', error);
      setIsTyping(false);
      setStreamingMessage(null);

      const errorMessage = error instanceof Error ? error.message : '';
      const isQuotaError = errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('insufficient_quota');

      if (isQuotaError) {
        setShowQuotaErrorDialog(true);
        return;
      }

      toast({
        title: "Streaming failed",
        description: "Falling back to regular messaging",
        variant: "default",
      });

      sendMessageMutation.mutate(content);
    }
  };

  const validateFile = (file: File): boolean => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    const documentTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    const isImage = imageTypes.includes(file.type);
    const isAudio = audioTypes.includes(file.type);
    const isDocument = documentTypes.includes(file.type);

    if (!isImage && !isAudio && !isDocument) {
      toast({
        title: "Invalid file type",
        description: "Please select an image (.jpg, .png, .gif, .webp), audio file (.mp3, .wav, .m4a, .ogg), or document (.pdf, .docx)",
        variant: "destructive",
      });
      return false;
    }

    const maxSize = isImage ? 10 * 1024 * 1024 : isDocument ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `${isImage ? 'Images' : isDocument ? 'Documents' : 'Audio files'} must be under ${isImage || isDocument ? '10MB' : '20MB'}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !selectedFile) || isTyping) return;

    const isDocument = selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const isImage = selectedFile && selectedFile.type.startsWith('image/');
    const shouldSkipPlaceholder = isDocument || isImage;
    const messageContent = message.trim() || (selectedFile && !shouldSkipPlaceholder ? `[Attachment: ${selectedFile.name}]` : '');
    const fileToUpload = selectedFile;

    if (!chatId) {
      if (fileToUpload) {
        toast({
          title: "Attachments not supported yet",
          description: "Please send your first message without an attachment, then you can add files in follow-up messages.",
          variant: "default",
        });
        setSelectedFile(null);
        return;
      }

      try {
        const response = await apiRequest("POST", "/api/chats", {
          title: "New Chat",
          assistantId: currentAssistant,
        });
        const newChat = await response.json();

        sessionStorage.setItem(`pending_message_${newChat.id}`, JSON.stringify({
          content: messageContent
        }));

        queryClient.invalidateQueries({ queryKey: ["/api/chats"] });

        setLocation(`/chat/${newChat.id}`);
        return;

      } catch (error) {
        if (isUnauthorizedError(error as Error)) {
          toast({
            title: "Unauthorized",
            description: "You are logged out. Logging in again...",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/api/login";
          }, 500);
          return;
        }
        toast({
          title: "Error",
          description: "Failed to start new chat",
          variant: "destructive",
        });
        return;
      }
    }

    setSelectedFile(null);
    await sendStreamingMessage(messageContent, fileToUpload || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopListening();
      if (transcript) {
        setMessage(prev => prev + ' ' + transcript);
        resetTranscript();
      }
    } else {
      resetTranscript();
      startListening();
    }
  };

  useEffect(() => {
    if (transcript && !isListening) {
      setMessage(prev => prev + transcript);
      resetTranscript();
    }
  }, [isListening, transcript, resetTranscript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage, isTyping]);

  if (!chatId) {
    return (
      <WelcomeScreen
        isMobile={isMobile}
        onOpenSidebar={onOpenSidebar}
        message={message}
        setMessage={setMessage}
        selectedFile={selectedFile}
        uploadProgress={uploadProgress}
        isTyping={isTyping}
        isListening={isListening}
        isSpeechRecognitionSupported={isSpeechRecognitionSupported}
        permissionDenied={permissionDenied}
        elapsedTime={elapsedTime}
        volumeLevel={volumeLevel}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        toggleSpeechRecognition={toggleSpeechRecognition}
        sendMessagePending={sendMessageMutation.isPending}
        fileInputRef={fileInputRef}
        textareaRef={textareaRef}
        currentAssistantName={ASSISTANT_CONFIG[currentAssistant]?.name || 'OBT Mentor Assistant'}
        currentAssistantDescription={ASSISTANT_CONFIG[currentAssistant]?.description || 'A friendly and supportive assistant guiding Oral Bible Translation (OBT) facilitators.'}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatHeader
        isMobile={isMobile}
        onOpenSidebar={onOpenSidebar}
        speechSynthesis={speechSynthesis}
      />
      
      <ChatMessageList
        messages={messages}
        streamingMessage={streamingMessage}
        isTyping={isTyping}
        isMobile={isMobile}
        speechSynthesis={speechSynthesis}
        selectedLanguage={selectedLanguage}
        messagesEndRef={messagesEndRef}
      />

      {isListening && (
        <div className={`border-t border-border bg-card ${isMobile ? 'p-3' : 'p-4'}`}>
          <VoiceRecordingIndicator
            elapsedTime={elapsedTime}
            volumeLevel={volumeLevel}
            onStop={toggleSpeechRecognition}
            isMobile={isMobile}
          />
        </div>
      )}

      <ChatInputForm
        message={message}
        setMessage={setMessage}
        isTyping={isTyping}
        isMobile={isMobile}
        selectedFile={selectedFile}
        uploadProgress={uploadProgress}
        onFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        isListening={isListening}
        isSpeechRecognitionSupported={isSpeechRecognitionSupported}
        permissionDenied={permissionDenied}
        toggleSpeechRecognition={toggleSpeechRecognition}
        sendMessageMutationPending={sendMessageMutation.isPending}
        currentAssistantName={ASSISTANT_CONFIG[currentAssistant]?.name || 'OBT Mentor Assistant'}
      />

      <ApiQuotaErrorDialog
        open={showQuotaErrorDialog}
        onOpenChange={setShowQuotaErrorDialog}
      />
    </div>
  );
}

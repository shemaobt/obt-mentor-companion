import { useState, useRef, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface OpenAISpeechRecognitionOptions {
  lang?: string;
}

interface OpenAISpeechRecognitionHook {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  lastError: string | null;
  permissionDenied: boolean;
  volumeLevel: number; // 0-100 for waveform visualization
  elapsedTime: number; // seconds elapsed since recording started
}

export function useOpenAISpeechRecognition(
  options: OpenAISpeechRecognitionOptions = {}
): OpenAISpeechRecognitionHook {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if browser supports MediaRecorder (universal support)
  const isSupported = typeof window !== 'undefined' && 
    'MediaRecorder' in window && 
    'navigator' in window && 
    'mediaDevices' in navigator;

  const processAudioChunk = useCallback(async (audioBlob: Blob, mimeType: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // Determine correct file extension based on MIME type for Whisper
      let extension = 'webm';
      if (mimeType.includes('wav')) extension = 'wav';
      else if (mimeType.includes('mp4')) extension = 'mp4';
      else if (mimeType.includes('ogg')) extension = 'ogg';  
      else if (mimeType.includes('webm')) extension = 'webm';


      const formData = new FormData();
      formData.append('audio', audioBlob, `audio.${extension}`);

      const response = await apiRequest('POST', '/api/audio/transcribe', formData);
      const data = await response.json();
      
      if (data.text && data.text.trim()) {
        const newText = data.text.trim();
        setTranscript(prev => {
          const combined = prev ? `${prev} ${newText}` : newText;
          return combined;
        });
      }
      
      setLastError(null);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setLastError('Failed to transcribe audio');
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported || isListening) return;

    try {
      setLastError(null);
      setPermissionDenied(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      // Set up Web Audio API for waveform visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      sourceNode.connect(analyser);
      analyserRef.current = analyser;
      
      // Start elapsed time tracking
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      
      // Update timer every 100ms
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setElapsedTime(Math.floor(elapsed));
      }, 100);
      
      // Visualize audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume (0-255) and normalize to 0-100
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedVolume = Math.min(100, Math.round((average / 255) * 150)); // Amplify for better visualization
        
        setVolumeLevel(normalizedVolume);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      // Determine the best audio format for Whisper compatibility
      const mimeTypes = [
        'audio/wav',
        'audio/mp4', 
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus'
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 64000, // Good quality for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      // Store audio data for processing when recording ends

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
        setInterimTranscript("Listening...");
        
        // Start the waveform animation loop after recording starts
        const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
        
        const updateVolume = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume (0-255) and normalize to 0-100
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedVolume = Math.min(100, Math.round((average / 255) * 150)); // Amplify for better visualization
          
          setVolumeLevel(normalizedVolume);
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        
        updateVolume();
      };

      mediaRecorder.onstop = () => {
        setIsListening(false);
        setInterimTranscript("");
        
        // Wait briefly to ensure final dataavailable event has fired
        // This prevents audio truncation at the end of recordings
        setTimeout(() => {
          // Process the complete recording
          if (chunksRef.current.length > 0) {
            const audioBlob = new Blob(chunksRef.current, { type: selectedMimeType });
            if (audioBlob.size > 1000) {
              processAudioChunk(audioBlob, selectedMimeType);
            }
          }

          // Cleanup
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          
          // Clean up audio visualization
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
          
          setVolumeLevel(0);
          setElapsedTime(0);
        }, 100); // 100ms delay to capture final chunk
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error);
        setLastError(event.error?.message || 'Recording failed');
        setIsListening(false);
      };

      // Start recording with timeslice to capture data incrementally
      // This ensures we don't lose the final chunk and reduces truncation
      mediaRecorder.start(1000); // Capture chunks every 1 second

    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setLastError('Microphone permission denied');
      } else if (error.name === 'NotFoundError') {
        setLastError('No microphone found');
      } else {
        setLastError('Failed to start recording');
      }
    }
  }, [isSupported, isListening, processAudioChunk]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setLastError(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    lastError,
    permissionDenied,
    volumeLevel,
    elapsedTime
  };
}
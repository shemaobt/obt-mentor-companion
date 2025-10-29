import { GoogleGenerativeAI } from "@google/generative-ai";
import { franc } from "franc";

// Lazy initialization of Gemini client to avoid crashes when GOOGLE_API_KEY is missing
let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini audio transcription. Please configure it in your environment.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Language code mapping for franc to standard language codes
 */
const FRANC_TO_LANGUAGE: Record<string, string> = {
  'por': 'pt-BR',  // Portuguese
  'eng': 'en-US',  // English
  'spa': 'es-ES',  // Spanish
  'fra': 'fr-FR',  // French
  'rus': 'ru-RU',  // Russian
  'cmn': 'zh-CN',  // Mandarin Chinese
  'arb': 'ar-SA',  // Arabic
  'ind': 'id-ID',  // Indonesian
  'kor': 'ko-KR',  // Korean
  'deu': 'de-DE',  // German
  'ita': 'it-IT',  // Italian
  'jpn': 'ja-JP',  // Japanese
  'hin': 'hi-IN',  // Hindi
  'nld': 'nl-NL',  // Dutch
  'swe': 'sv-SE',  // Swedish
  'dan': 'da-DK',  // Danish
};

/**
 * Detect language of text using franc library
 */
function detectLanguage(text: string): string {
  try {
    // franc returns ISO 639-3 codes (3-letter codes)
    const detected = franc(text, { minLength: 10 });
    
    if (detected === 'und') {
      // Undetermined - default to English
      console.log('[Language Detection] Could not determine language, defaulting to en-US');
      return 'en-US';
    }
    
    const language = FRANC_TO_LANGUAGE[detected] || 'en-US';
    console.log(`[Language Detection] Detected '${detected}' → ${language}`);
    return language;
  } catch (error) {
    console.error('[Language Detection] Error:', error);
    return 'en-US'; // Default to English on error
  }
}

/**
 * Transcribe audio using Gemini 2.5's native audio understanding
 * Supports up to 9.5 hours of audio with speaker diarization
 */
export async function transcribeAudioWithGemini(audioBuffer: Buffer, filename: string): Promise<string> {
  try {
    console.log(`[Gemini Audio] Transcribing ${filename} (${audioBuffer.length} bytes)`);
    
    // Get Gemini client (lazy initialization with error handling)
    const client = getGeminiClient();
    
    // Use Gemini 2.5 Pro for high-quality transcription
    const model = client.getGenerativeModel({ model: "gemini-2.5-pro" });
    
    // Determine MIME type from filename
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      'mp3': 'audio/mp3',
      'wav': 'audio/wav',
      'm4a': 'audio/m4a',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
    };
    const mimeType = mimeTypeMap[extension || 'mp3'] || 'audio/mp3';
    
    // Convert buffer to base64
    const base64Audio = audioBuffer.toString('base64');
    
    // Create prompt for transcription
    const prompt = `Please transcribe this audio file verbatim. 
    
If there are multiple speakers, use speaker diarization (Speaker A, Speaker B, etc.).
Preserve the original language - do not translate.
Do not include timestamps.`;
    
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: mimeType,
        },
      },
      prompt,
    ]);
    
    const response = result.response;
    const transcription = response.text();
    
    console.log(`[Gemini Audio] Transcription complete (${transcription.length} characters)`);
    return transcription;
  } catch (error) {
    console.error("[Gemini Audio] Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio with Gemini");
  }
}

/**
 * Gemini 2.5 Native TTS - Text-to-Speech with automatic language detection
 * Supports 24+ languages with natural pronunciation
 */

// Voice mapping based on detected language
const GEMINI_VOICE_MAP: Record<string, string> = {
  'pt-BR': 'Kore',    // Portuguese - warm, friendly
  'en-US': 'Puck',    // English - clear, neutral
  'es-ES': 'Kore',    // Spanish
  'fr-FR': 'Puck',    // French
  'de-DE': 'Kore',    // German
  'it-IT': 'Puck',    // Italian
  'ja-JP': 'Kore',    // Japanese
  'ko-KR': 'Puck',    // Korean
  'zh-CN': 'Kore',    // Chinese
  'hi-IN': 'Puck',    // Hindi
  'ar-SA': 'Kore',    // Arabic
  'ru-RU': 'Puck',    // Russian
};

const DEFAULT_VOICE = 'Kore';

/**
 * Convert PCM audio data to WAV format
 * Gemini returns PCM 24kHz mono, we need to add WAV headers
 */
function pcmToWav(pcmData: Buffer): Buffer {
  const channels = 1;  // Mono
  const sampleRate = 24000;  // 24kHz
  const bitsPerSample = 16;  // 16-bit
  
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  
  // WAV header (44 bytes)
  const header = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);  // Sub-chunk size
  header.writeUInt16LE(1, 20);   // Audio format (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  return Buffer.concat([header, pcmData]);
}

/**
 * Generate speech with automatic language detection using Gemini 2.5 TTS
 * Returns both the audio buffer and the detected language/voice for caching
 */
export async function generateSpeechWithAutoLanguage(text: string): Promise<{
  buffer: Buffer;
  language: string;
  voice: string;
}> {
  try {
    // Detect language from text
    const detectedLanguage = detectLanguage(text);
    const voiceName = GEMINI_VOICE_MAP[detectedLanguage] || DEFAULT_VOICE;
    
    console.log(`[Gemini TTS] Generating speech for detected language: ${detectedLanguage}`);
    console.log(`[Gemini TTS] Using voice: ${voiceName}`);
    
    // Get Gemini client
    const client = getGeminiClient();
    
    // Call Gemini TTS API using REST endpoint
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey!,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Say naturally: ${text}`
            }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName
                }
              }
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini TTS API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract audio data from response
    const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioBase64) {
      throw new Error('No audio data in Gemini TTS response');
    }
    
    // Convert base64 PCM to Buffer
    const pcmBuffer = Buffer.from(audioBase64, 'base64');
    
    // Convert PCM to WAV format
    const wavBuffer = pcmToWav(pcmBuffer);
    
    console.log(`[Gemini TTS] Generated ${wavBuffer.length} bytes of audio`);
    
    return {
      buffer: wavBuffer,
      language: detectedLanguage,
      voice: voiceName
    };
  } catch (error) {
    console.error("Error generating speech with Gemini TTS:", error);
    throw new Error("Failed to generate speech with Gemini TTS");
  }
}

/**
 * Generate streaming speech with automatic language detection using Gemini 2.5 TTS
 * Note: Gemini TTS doesn't support true streaming, so we generate the full audio and stream it
 */
export async function generateSpeechStreamWithAutoLanguage(text: string): Promise<ReadableStream> {
  try {
    console.log(`[Gemini TTS Stream] Generating speech...`);
    
    // Generate the full audio using Gemini TTS
    const { buffer } = await generateSpeechWithAutoLanguage(text);
    
    // Create a ReadableStream from the buffer
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      }
    });

    return stream;
  } catch (error) {
    console.error("Error generating speech stream with Gemini TTS:", error);
    throw new Error("Failed to generate speech stream with Gemini TTS");
  }
}

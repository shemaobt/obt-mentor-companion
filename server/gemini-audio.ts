import { GoogleGenerativeAI } from "@google/generative-ai";
import { franc } from "franc";

// Lazy initialization of Gemini client to avoid crashes when GOOGLE_API_KEY is missing
let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required for Gemini audio transcription. Please configure it in your environment.');
    }
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
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
Include timestamps if possible.`;
    
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
 * For TTS, we use OpenAI TTS with automatic language detection for now.
 * OpenAI's TTS models automatically detect the language and speak with
 * native pronunciation for all supported languages.
 * 
 * Note: Migrating to Google Cloud TTS would require service account credentials,
 * which is more complex than simple API key authentication.
 */
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "your_openai_api_key"
});

/**
 * OpenAI TTS automatically detects language from text and speaks with native pronunciation.
 * The voice selection just affects tone/style, not the accent or language.
 * We use 'alloy' as the default voice as it sounds most neutral across all languages.
 */
const DEFAULT_VOICE = 'alloy';

/**
 * Generate speech with automatic language detection
 * OpenAI TTS automatically detects the language and speaks with native pronunciation
 * Returns both the audio buffer and the detected language/voice for caching
 */
export async function generateSpeechWithAutoLanguage(text: string): Promise<{
  buffer: Buffer;
  language: string;
  voice: string;
}> {
  try {
    // Detect language from text (for logging purposes)
    const detectedLanguage = detectLanguage(text);
    
    console.log(`[OpenAI TTS] Generating speech for detected language: ${detectedLanguage}`);
    console.log(`[OpenAI TTS] Note: OpenAI TTS automatically uses native pronunciation for all languages`);
    
    // OpenAI TTS automatically detects language and uses native pronunciation
    // regardless of voice selection. The voice just affects tone/style.
    const speech = await openai.audio.speech.create({
      model: "tts-1-hd",  // Higher quality model
      voice: DEFAULT_VOICE as any,
      input: text,
      speed: 1.0,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    return {
      buffer,
      language: detectedLanguage,
      voice: DEFAULT_VOICE
    };
  } catch (error) {
    console.error("Error generating speech with OpenAI TTS:", error);
    throw new Error("Failed to generate speech");
  }
}

/**
 * Generate streaming speech with automatic language detection
 * OpenAI TTS automatically detects the language and speaks with native pronunciation
 */
export async function generateSpeechStreamWithAutoLanguage(text: string): Promise<ReadableStream> {
  try {
    // Detect language from text (for logging purposes)
    const detectedLanguage = detectLanguage(text);
    
    console.log(`[OpenAI TTS Stream] Generating speech for detected language: ${detectedLanguage}`);
    console.log(`[OpenAI TTS Stream] OpenAI automatically uses native pronunciation`);
    
    // OpenAI TTS automatically detects language and uses native pronunciation
    const speech = await openai.audio.speech.create({
      model: "tts-1-hd",  // Higher quality model
      voice: DEFAULT_VOICE as any,
      input: text,
      response_format: "mp3",
      speed: 1.0
    });

    if (!speech.body) {
      throw new Error("OpenAI returned empty response body");
    }

    return speech.body;
  } catch (error) {
    console.error("Error generating speech stream with OpenAI TTS:", error);
    throw new Error("Failed to generate speech stream");
  }
}

import OpenAI, { toFile } from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "your_openai_api_key"
});

// Audio transcription using Whisper
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, filename),
      model: "whisper-1",
      language: undefined, // Let Whisper auto-detect language
      response_format: "text"
    });
    
    return transcription;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio");
  }
}

// Text-to-speech generation
export async function generateSpeech(text: string, language = 'en-US', voiceId?: string): Promise<Buffer> {
  try {
    // Valid OpenAI voice IDs
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    
    // Use provided voice ID or fall back to language-based mapping
    let voice = 'alloy'; // default
    
    if (voiceId && validVoices.includes(voiceId)) {
      voice = voiceId;
    } else {
      // Fall back to language-based mapping
      const voiceMap: Record<string, string> = {
        'en-US': 'alloy',
        'en-GB': 'alloy', 
        'es-ES': 'nova',
        'es-MX': 'nova',
        'fr-FR': 'shimmer',
        'de-DE': 'echo',
        'it-IT': 'fable',
        'pt-BR': 'onyx',
        'ja-JP': 'alloy',
        'ko-KR': 'alloy',
        'zh-CN': 'alloy',
        'hi-IN': 'alloy',
        'ar-SA': 'alloy',
        'ru-RU': 'echo',
        'nl-NL': 'alloy',
        'sv-SE': 'alloy',
        'da-DK': 'alloy'
      };
      voice = voiceMap[language] || 'alloy';
    }
    
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: text,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("Failed to generate speech");
  }
}

// Streaming text-to-speech generation
export async function generateSpeechStream(text: string, language = 'en-US', voiceId?: string): Promise<ReadableStream> {
  try {
    // Valid OpenAI voice IDs
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    
    // Use provided voice ID or fall back to language-based mapping
    let voice = 'alloy'; // default
    
    if (voiceId && validVoices.includes(voiceId)) {
      voice = voiceId;
    } else {
      // Fall back to language-based mapping
      const voiceMap: Record<string, string> = {
        'en-US': 'alloy',
        'en-GB': 'alloy', 
        'es-ES': 'nova',
        'es-MX': 'nova',
        'fr-FR': 'shimmer',
        'de-DE': 'echo',
        'it-IT': 'fable',
        'pt-BR': 'onyx',
        'ja-JP': 'alloy',
        'ko-KR': 'alloy',
        'zh-CN': 'alloy',
        'hi-IN': 'alloy',
        'ar-SA': 'alloy',
        'ru-RU': 'echo',
        'nl-NL': 'alloy',
        'sv-SE': 'alloy',
        'da-DK': 'alloy'
      };
      voice = voiceMap[language] || 'alloy';
    }
    
    const speech = await openai.audio.speech.create({
      model: "tts-1", // Use standard model for faster generation (HD is slower)
      voice: voice as any,
      input: text,
      response_format: "mp3",
      speed: 1.0 // Normal speed for natural-sounding speech
    });

    // Guard against null body (can happen on some OpenAI error responses)
    if (!speech.body) {
      throw new Error("OpenAI returned empty response body");
    }

    // Return the stream directly instead of buffering
    return speech.body;
  } catch (error) {
    console.error("Error generating speech stream:", error);
    throw new Error("Failed to generate speech stream");
  }
}

// Generate a chat title from the first message
export function generateChatTitle(firstMessage: string): string {
  // Generate a title from the first user message (max 50 chars)
  const title = firstMessage.trim();
  if (title.length <= 50) return title;
  
  const words = title.split(' ');
  let result = '';
  
  for (const word of words) {
    if ((result + ' ' + word).length > 47) break;
    result = result ? result + ' ' + word : word;
  }
  
  return result + '...';
}

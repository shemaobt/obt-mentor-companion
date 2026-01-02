import { GoogleGenerativeAI } from "@google/generative-ai";
import { franc } from "franc";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini audio transcription");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const FRANC_TO_LANGUAGE: Record<string, string> = {
  por: "pt-BR",
  eng: "en-US",
  spa: "es-ES",
  fra: "fr-FR",
  rus: "ru-RU",
  cmn: "zh-CN",
  arb: "ar-SA",
  ind: "id-ID",
  kor: "ko-KR",
  deu: "de-DE",
  ita: "it-IT",
  jpn: "ja-JP",
  hin: "hi-IN",
  nld: "nl-NL",
  swe: "sv-SE",
  dan: "da-DK",
};

function detectLanguage(text: string): string {
  try {
    const detected = franc(text, { minLength: 10 });

    if (detected === "und") {
      console.log("[Language Detection] Could not determine language, defaulting to en-US");
      return "en-US";
    }

    const language = FRANC_TO_LANGUAGE[detected] || "en-US";
    console.log(`[Language Detection] Detected '${detected}' → ${language}`);
    return language;
  } catch (error) {
    console.error("[Language Detection] Error:", error);
    return "en-US";
  }
}

export async function translateWithGemini(
  text: string,
  fromLanguage: string = "auto",
  toLanguage: string = "en-US",
  context?: string
): Promise<string> {
  try {
    console.log(`[Gemini Translation] Translating from ${fromLanguage} to ${toLanguage}`);

    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = context
      ? `Translate the following text from ${fromLanguage} to ${toLanguage}. Context: ${context}\n\nText to translate: ${text}\n\nProvide only the translation without any additional text or explanations.`
      : `Translate the following text from ${fromLanguage} to ${toLanguage}:\n\n${text}\n\nProvide only the translation without any additional text or explanations.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const translatedText = response.text().trim();

    console.log(`[Gemini Translation] Translation completed (${translatedText.length} chars)`);
    return translatedText;
  } catch (error) {
    console.error("[Gemini Translation] Error:", error);
    throw new Error(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function transcribeAudioWithGemini(audioBuffer: Buffer, filename: string): Promise<string> {
  try {
    console.log(`[Gemini Audio] Transcribing ${filename} (${audioBuffer.length} bytes)`);

    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-pro" });

    const extension = filename.split(".").pop()?.toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      mp3: "audio/mp3",
      wav: "audio/wav",
      m4a: "audio/m4a",
      aac: "audio/aac",
      flac: "audio/flac",
      ogg: "audio/ogg",
      webm: "audio/webm",
    };
    const mimeType = mimeTypeMap[extension || "mp3"] || "audio/mp3";

    const base64Audio = audioBuffer.toString("base64");

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
    let transcription = response.text();

    transcription = transcription.replace(/\[\d{2}:\d{2}:\d{2}\]/g, "");
    transcription = transcription.replace(/\s{2,}/g, " ").trim();

    console.log(`[Gemini Audio] Transcription complete (${transcription.length} characters)`);
    return transcription;
  } catch (error) {
    console.error("[Gemini Audio] Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio with Gemini");
  }
}

const GEMINI_VOICE_MAP: Record<string, string> = {
  "pt-BR": "Kore",
  "en-US": "Puck",
  "es-ES": "Kore",
  "fr-FR": "Puck",
  "de-DE": "Kore",
  "it-IT": "Puck",
  "ja-JP": "Kore",
  "ko-KR": "Puck",
  "zh-CN": "Kore",
  "hi-IN": "Puck",
  "ar-SA": "Kore",
  "ru-RU": "Puck",
};

const DEFAULT_VOICE = "Kore";

function pcmToWav(pcmData: Buffer): Buffer {
  const channels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;

  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;

  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

export async function generateSpeechWithAutoLanguage(text: string): Promise<{
  buffer: Buffer;
  language: string;
  voice: string;
}> {
  try {
    const detectedLanguage = detectLanguage(text);
    const voiceName = GEMINI_VOICE_MAP[detectedLanguage] || DEFAULT_VOICE;

    console.log(`[Gemini TTS] Generating speech for detected language: ${detectedLanguage}`);
    console.log(`[Gemini TTS] Using voice: ${voiceName}`);

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey!,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Say naturally: ${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini TTS API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      throw new Error("No audio data in Gemini TTS response");
    }

    const pcmBuffer = Buffer.from(audioBase64, "base64");
    const wavBuffer = pcmToWav(pcmBuffer);

    console.log(`[Gemini TTS] Generated ${wavBuffer.length} bytes of audio`);

    return {
      buffer: wavBuffer,
      language: detectedLanguage,
      voice: voiceName,
    };
  } catch (error) {
    console.error("Error generating speech with Gemini TTS:", error);
    throw new Error("Failed to generate speech with Gemini TTS");
  }
}

export async function generateSpeechStreamWithAutoLanguage(text: string): Promise<ReadableStream> {
  try {
    console.log(`[Gemini TTS Stream] Generating speech...`);

    const { buffer } = await generateSpeechWithAutoLanguage(text);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });

    return stream;
  } catch (error) {
    console.error("Error generating speech stream with Gemini TTS:", error);
    throw new Error("Failed to generate speech stream with Gemini TTS");
  }
}

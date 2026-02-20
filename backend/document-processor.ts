import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import { detectCompetenciesInConversation } from "./competency-mapping.js";
import { config } from "./config/index.js";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.PDFParse || pdfParseModule;

const qdrant = new QdrantClient({
  url: config.qdrant.url,
  apiKey: config.qdrant.apiKey,
});

const genAI = new GoogleGenerativeAI(config.google.apiKey);

const COLLECTION_NAME = "obt_global_memory";
const VECTOR_DIM = 768;

export async function parseDocument(filePath: string, fileType: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return await parseDocumentBuffer(buffer, fileType);
  } catch (error) {
    console.error("Error parsing document:", error);
    throw error;
  }
}

export async function parseDocumentBuffer(buffer: Buffer, fileType: string): Promise<string> {
  try {
    switch (fileType) {
      case "pdf":
        const parser = new pdfParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy();
        return result.text;

      case "docx":
        const docxResult = await mammoth.extractRawText({ buffer: buffer });
        return docxResult.value;

      case "txt":
        return buffer.toString("utf-8");

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error("Error parsing document buffer:", error);
    throw error;
  }
}

export function chunkText(text: string, maxChunkSize: number = 100, overlap: number = 20): string[] {
  const chunks: string[] = [];

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.trim().split(/\s+/);
    const paragraphWordCount = paragraphWords.length;

    if (paragraphWordCount <= maxChunkSize) {
      if (currentWordCount + paragraphWordCount <= maxChunkSize) {
        currentChunk.push(paragraph.trim());
        currentWordCount += paragraphWordCount;
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join("\n\n"));

          const overlapWords = currentChunk.join(" ").split(/\s+/).slice(-overlap);
          currentChunk = overlapWords.length > 0 ? [overlapWords.join(" ")] : [];
          currentWordCount = overlapWords.length;
        }
        currentChunk.push(paragraph.trim());
        currentWordCount = paragraphWordCount;
      }
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
        const overlapWords = currentChunk.join(" ").split(/\s+/).slice(-overlap);
        currentChunk = overlapWords.length > 0 ? [overlapWords.join(" ")] : [];
        currentWordCount = overlapWords.length;
      }

      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/);
        const sentenceWordCount = sentenceWords.length;

        if (currentWordCount + sentenceWordCount <= maxChunkSize) {
          currentChunk.push(sentence.trim());
          currentWordCount += sentenceWordCount;
        } else {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(" "));
            const overlapWords = currentChunk.join(" ").split(/\s+/).slice(-overlap);
            currentChunk = overlapWords.length > 0 ? [overlapWords.join(" ")] : [];
            currentWordCount = overlapWords.length;
          }

          if (sentenceWordCount > maxChunkSize) {
            for (let i = 0; i < sentenceWords.length; i += maxChunkSize - overlap) {
              const subChunk = sentenceWords.slice(i, i + maxChunkSize).join(" ");
              if (subChunk.trim().length > 0) {
                chunks.push(subChunk.trim());
              }
            }
            currentChunk = [];
            currentWordCount = 0;
          } else {
            currentChunk.push(sentence.trim());
            currentWordCount = sentenceWordCount;
          }
        }
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

export function detectChunkCompetencies(chunkText: string): string[] {
  return detectCompetenciesInConversation(chunkText, 5);
}

export function extractSectionHeader(chunkText: string): string | null {
  const lines = chunkText.split("\n");

  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();

    if (!line) continue;

    if (
      line.length < 100 &&
      (/^[A-Z0-9\s\-:]+$/.test(line) ||
        /^(?:[A-Z][a-z]*\s*)+$/.test(line) ||
        (/^(?:\d+\.?\s+)?[A-Z]/.test(line) && !line.endsWith(".")))
    ) {
      return line;
    }
  }

  return null;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

export async function storeDocumentChunks(params: {
  documentId: string;
  filename: string;
  chunks: string[];
  isActive: boolean;
  competencyTags?: string[];
  topicTags?: string[];
  contentType?: string;
}): Promise<number> {
  try {
    const points = [];

    for (let i = 0; i < params.chunks.length; i++) {
      const chunk = params.chunks[i];
      const embedding = await generateEmbedding(chunk);

      const autoDetectedCompetencies = detectChunkCompetencies(chunk);

      const allCompetencies = Array.from(new Set([...(params.competencyTags || []), ...autoDetectedCompetencies]));

      const sectionHeader = extractSectionHeader(chunk);

      const pointId = randomUUID();

      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          type: "document",
          documentId: params.documentId,
          documentName: params.filename,
          chunkText: chunk,
          chunkIndex: i,
          totalChunks: params.chunks.length,
          isActive: params.isActive,
          timestamp: new Date().toISOString(),
          competencyTags: allCompetencies,
          topicTags: params.topicTags || [],
          contentType: params.contentType || null,
          sectionHeader: sectionHeader,
          wordCount: chunk.split(/\s+/).length,
        },
      });
    }

    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });
    }

    console.log(`Stored ${points.length} chunks for document ${params.documentId}`);
    return points.length;
  } catch (error) {
    console.error("Error storing document chunks:", error);
    throw error;
  }
}

export async function searchDocumentChunks(params: {
  query: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<
  Array<{
    documentId: string;
    filename: string;
    content: string;
    chunkIndex: number;
    score: number;
    competencyTags?: string[];
    sectionHeader?: string | null;
    wordCount?: number;
  }>
> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 5;
    const scoreThreshold = params.scoreThreshold || 0.5;

    const filter = {
      must: [
        { key: "type", match: { value: "document" } },
        { key: "isActive", match: { value: true } },
      ],
    };

    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      filter,
      with_payload: true,
      score_threshold: scoreThreshold,
    });

    return searchResults.map((result) => ({
      documentId: result.payload?.documentId as string,
      filename: (result.payload?.documentName || result.payload?.filename) as string,
      content: (result.payload?.chunkText || result.payload?.content) as string,
      chunkIndex: result.payload?.chunkIndex as number,
      score: result.score,
      competencyTags: result.payload?.competencyTags as string[] | undefined,
      sectionHeader: result.payload?.sectionHeader as string | null | undefined,
      wordCount: result.payload?.wordCount as number | undefined,
    }));
  } catch (error) {
    console.error("Error searching document chunks:", error);
    return [];
  }
}

export async function updateDocumentChunksStatus(documentId: string, isActive: boolean): Promise<void> {
  try {
    const allPoints = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: "type", match: { value: "document" } },
          { key: "documentId", match: { value: documentId } },
        ],
      },
      with_payload: true,
      with_vector: false,
      limit: 1000,
    });

    if (allPoints.points.length > 0) {
      for (const point of allPoints.points) {
        await qdrant.setPayload(COLLECTION_NAME, {
          wait: true,
          points: [point.id as string],
          payload: {
            ...point.payload,
            isActive,
          },
        });
      }

      console.log(`Updated ${allPoints.points.length} chunks for document ${documentId} to isActive=${isActive}`);
    }
  } catch (error) {
    console.error("Error updating document chunks status:", error);
    throw error;
  }
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  try {
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          { key: "type", match: { value: "document" } },
          { key: "documentId", match: { value: documentId } },
        ],
      },
    });

    console.log(`Deleted all chunks for document ${documentId}`);
  } catch (error) {
    console.error("Error deleting document chunks:", error);
    throw error;
  }
}

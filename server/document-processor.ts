import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR,
});

// Collection name (same as conversation memory)
const COLLECTION_NAME = 'obt_global_memory';

// Vector dimension for OpenAI text-embedding-3-small
const VECTOR_DIM = 1536;

/**
 * Parse text from different file types
 */
export async function parseDocument(filePath: string, fileType: string): Promise<string> {
  try {
    switch (fileType) {
      case 'pdf':
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;

      case 'docx':
        const docxBuffer = await fs.readFile(filePath);
        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
        return docxResult.value;

      case 'txt':
        return await fs.readFile(filePath, 'utf-8');

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    throw error;
  }
}

/**
 * Chunk text into smaller pieces for embedding
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
}

/**
 * Generate embedding for a text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Process and store document chunks in Qdrant
 */
export async function storeDocumentChunks(params: {
  documentId: string;
  filename: string;
  chunks: string[];
  isActive: boolean;
}): Promise<number> {
  try {
    const points = [];

    for (let i = 0; i < params.chunks.length; i++) {
      const chunk = params.chunks[i];
      const embedding = await generateEmbedding(chunk);
      
      // Create a unique point ID for each chunk
      const pointId = randomUUID();

      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          type: 'document',
          documentId: params.documentId,
          filename: params.filename,
          chunkIndex: i,
          totalChunks: params.chunks.length,
          content: chunk,
          isActive: params.isActive,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Store all chunks in Qdrant
    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });
    }

    console.log(`Stored ${points.length} chunks for document ${params.documentId}`);
    return points.length;
  } catch (error) {
    console.error('Error storing document chunks:', error);
    throw error;
  }
}

/**
 * Search for relevant document chunks
 */
export async function searchDocumentChunks(params: {
  query: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<Array<{
  documentId: string;
  filename: string;
  content: string;
  chunkIndex: number;
  score: number;
}>> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 5;
    const scoreThreshold = params.scoreThreshold || 0.5;

    // Filter for active documents only
    const filter = {
      must: [
        { key: 'type', match: { value: 'document' } },
        { key: 'isActive', match: { value: true } },
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
      filename: result.payload?.filename as string,
      content: result.payload?.content as string,
      chunkIndex: result.payload?.chunkIndex as number,
      score: result.score,
    }));
  } catch (error) {
    console.error('Error searching document chunks:', error);
    return [];
  }
}

/**
 * Update isActive status for all chunks of a document
 */
export async function updateDocumentChunksStatus(documentId: string, isActive: boolean): Promise<void> {
  try {
    // Qdrant doesn't support bulk payload updates, so we need to:
    // 1. Search for all points with this documentId
    // 2. Update each point's payload

    const allPoints = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'type', match: { value: 'document' } },
          { key: 'documentId', match: { value: documentId } },
        ],
      },
      with_payload: true,
      with_vector: false,
      limit: 1000, // Adjust if documents have more chunks
    });

    if (allPoints.points.length > 0) {
      // Update payload for each point
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
    console.error('Error updating document chunks status:', error);
    throw error;
  }
}

/**
 * Delete all chunks of a document from Qdrant
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  try {
    // Delete points by filter
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          { key: 'type', match: { value: 'document' } },
          { key: 'documentId', match: { value: documentId } },
        ],
      },
    });

    console.log(`Deleted all chunks for document ${documentId}`);
  } catch (error) {
    console.error('Error deleting document chunks:', error);
    throw error;
  }
}

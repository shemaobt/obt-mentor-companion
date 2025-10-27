import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { detectCompetenciesInConversation } from './competency-mapping.js';

// Import pdf-parse using require (CommonJS module)
const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.PDFParse || pdfParseModule;

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Initialize Google AI client for embeddings
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '');

// Collection name (same as conversation memory)
const COLLECTION_NAME = 'obt_global_memory';

// Vector dimension for Google text-embedding-004 (768 dimensions)
const VECTOR_DIM = 768;

/**
 * Parse text from different file types
 */
export async function parseDocument(filePath: string, fileType: string): Promise<string> {
  try {
    switch (fileType) {
      case 'pdf':
        const pdfBuffer = await fs.readFile(filePath);
        // PDFParse constructor accepts { data: buffer } for local files
        const parser = new pdfParse({ data: pdfBuffer });
        const result = await parser.getText();
        await parser.destroy();
        return result.text;

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
 * Enhanced semantic chunking with smaller, more precise chunks
 * - Respects paragraph boundaries (double newlines)
 * - Smaller chunks (~100 words) for better retrieval precision
 * - Falls back to sentence splitting if paragraphs are too large
 * - Maintains overlap for context continuity
 */
export function chunkText(text: string, maxChunkSize: number = 100, overlap: number = 20): string[] {
  const chunks: string[] = [];
  
  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk: string[] = [];
  let currentWordCount = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.trim().split(/\s+/);
    const paragraphWordCount = paragraphWords.length;
    
    // If paragraph itself is small enough, try to combine with previous
    if (paragraphWordCount <= maxChunkSize) {
      // Check if adding this paragraph would exceed max size
      if (currentWordCount + paragraphWordCount <= maxChunkSize) {
        currentChunk.push(paragraph.trim());
        currentWordCount += paragraphWordCount;
      } else {
        // Save current chunk and start new one
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n\n'));
          
          // Add overlap from end of previous chunk
          const overlapWords = currentChunk.join(' ').split(/\s+/).slice(-overlap);
          currentChunk = overlapWords.length > 0 ? [overlapWords.join(' ')] : [];
          currentWordCount = overlapWords.length;
        }
        currentChunk.push(paragraph.trim());
        currentWordCount = paragraphWordCount;
      }
    } else {
      // Paragraph is too large, split by sentences
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        const overlapWords = currentChunk.join(' ').split(/\s+/).slice(-overlap);
        currentChunk = overlapWords.length > 0 ? [overlapWords.join(' ')] : [];
        currentWordCount = overlapWords.length;
      }
      
      // Split paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/);
        const sentenceWordCount = sentenceWords.length;
        
        if (currentWordCount + sentenceWordCount <= maxChunkSize) {
          currentChunk.push(sentence.trim());
          currentWordCount += sentenceWordCount;
        } else {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
            const overlapWords = currentChunk.join(' ').split(/\s+/).slice(-overlap);
            currentChunk = overlapWords.length > 0 ? [overlapWords.join(' ')] : [];
            currentWordCount = overlapWords.length;
          }
          
          // If single sentence is still too large, force split
          if (sentenceWordCount > maxChunkSize) {
            for (let i = 0; i < sentenceWords.length; i += maxChunkSize - overlap) {
              const subChunk = sentenceWords.slice(i, i + maxChunkSize).join(' ');
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
  
  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Automatically detect competency tags for a chunk based on content
 * Returns array of competency IDs that are relevant to this chunk
 */
export function detectChunkCompetencies(chunkText: string): string[] {
  // Use the same detection function as conversation analysis
  // Get up to 5 competencies per chunk (more comprehensive tagging)
  return detectCompetenciesInConversation(chunkText, 5);
}

/**
 * Extract section header from chunk text if present
 * Looks for lines that might be headers (short lines, capitalized, etc.)
 */
export function extractSectionHeader(chunkText: string): string | null {
  const lines = chunkText.split('\n');
  
  // Check first few lines for potential headers
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Potential header: short (< 100 chars), no ending punctuation, or all caps
    if (line.length < 100 && (
      /^[A-Z0-9\s\-:]+$/.test(line) || // All caps
      /^(?:[A-Z][a-z]*\s*)+$/.test(line) || // Title case
      /^(?:\d+\.?\s+)?[A-Z]/.test(line) && !line.endsWith('.') // Starts with number or capital, no period
    )) {
      return line;
    }
  }
  
  return null;
}

/**
 * Generate embedding for a text using Google text-embedding-004
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Process and store document chunks in Qdrant with automatic competency tagging
 */
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
      
      // Automatically detect competencies in this chunk
      const autoDetectedCompetencies = detectChunkCompetencies(chunk);
      
      // Combine manual tags with auto-detected competencies (deduplicate)
      const allCompetencies = Array.from(new Set([
        ...(params.competencyTags || []),
        ...autoDetectedCompetencies
      ]));
      
      // Extract section header if present
      const sectionHeader = extractSectionHeader(chunk);
      
      // Create a unique point ID for each chunk
      const pointId = randomUUID();

      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          type: 'document',
          documentId: params.documentId,
          documentName: params.filename,
          chunkText: chunk,
          chunkIndex: i,
          totalChunks: params.chunks.length,
          isActive: params.isActive,
          timestamp: new Date().toISOString(),
          // Enhanced metadata for better retrieval
          competencyTags: allCompetencies,
          topicTags: params.topicTags || [],
          contentType: params.contentType || null,
          sectionHeader: sectionHeader,
          wordCount: chunk.split(/\s+/).length,
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

    console.log(`Stored ${points.length} chunks for document ${params.documentId} with automatic competency tagging`);
    return points.length;
  } catch (error) {
    console.error('Error storing document chunks:', error);
    throw error;
  }
}

/**
 * Search for relevant document chunks with enhanced metadata
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
  competencyTags?: string[];
  sectionHeader?: string | null;
  wordCount?: number;
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
      // Backward compatible: try new field name, fallback to old
      filename: (result.payload?.documentName || result.payload?.filename) as string,
      content: (result.payload?.chunkText || result.payload?.content) as string,
      chunkIndex: result.payload?.chunkIndex as number,
      score: result.score,
      // Enhanced metadata (only present in new chunks)
      competencyTags: result.payload?.competencyTags as string[] | undefined,
      sectionHeader: result.payload?.sectionHeader as string | null | undefined,
      wordCount: result.payload?.wordCount as number | undefined,
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

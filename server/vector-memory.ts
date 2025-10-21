import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { storage } from './storage';
import type { Message } from '@shared/schema';

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR,
});

// Collection name for OBT conversations
const COLLECTION_NAME = 'obt_global_memory';

// Vector dimension for OpenAI text-embedding-3-small
const VECTOR_DIM = 1536;

/**
 * Initialize Qdrant collection if it doesn't exist
 */
export async function initializeQdrantCollection() {
  try {
    // Check if collection exists
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(
      (col) => col.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      console.log(`Creating Qdrant collection: ${COLLECTION_NAME}`);
      
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_DIM,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });

      // Create payload indexes for efficient filtering
      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'userId',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'facilitatorId',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'chatId',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'type',
        field_schema: 'keyword',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'isActive',
        field_schema: 'bool',
      });

      await qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'documentId',
        field_schema: 'keyword',
      });

      console.log(`Qdrant collection ${COLLECTION_NAME} created successfully`);
    } else {
      console.log(`Qdrant collection ${COLLECTION_NAME} already exists`);
      
      // Ensure critical indexes exist (safe to call even if they already exist)
      try {
        await qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'type',
          field_schema: 'keyword',
        });
        console.log('Created/verified index for type field');
      } catch (e) {
        // Index might already exist, which is fine
      }

      try {
        await qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'isActive',
          field_schema: 'bool',
        });
        console.log('Created/verified index for isActive field');
      } catch (e) {
        // Index might already exist, which is fine
      }

      try {
        await qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'documentId',
          field_schema: 'keyword',
        });
        console.log('Created/verified index for documentId field');
      } catch (e) {
        // Index might already exist, which is fine
      }
    }
  } catch (error) {
    console.error('Error initializing Qdrant collection:', error);
    throw error;
  }
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
 * Store a message in Qdrant with its embedding
 */
export async function storeMessageEmbedding(params: {
  messageId: string;
  chatId: string;
  userId: string;
  facilitatorId?: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  competencyTags?: string[];
}) {
  try {
    const embedding = await generateEmbedding(params.content);

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: params.messageId,
          vector: embedding,
          payload: {
            messageId: params.messageId,
            chatId: params.chatId,
            userId: params.userId,
            facilitatorId: params.facilitatorId || null,
            content: params.content,
            role: params.role,
            timestamp: params.timestamp.toISOString(),
            competencyTags: params.competencyTags || [],
          },
        },
      ],
    });

    console.log(`Stored embedding for message ${params.messageId}`);
  } catch (error) {
    console.error('Error storing message embedding:', error);
    // Don't throw - we don't want embedding failures to break the chat flow
  }
}

/**
 * Search for relevant messages using semantic search
 */
export async function searchRelevantMessages(params: {
  query: string;
  facilitatorId?: string;
  userId?: string;
  excludeChatId?: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<Array<{
  messageId: string;
  chatId: string;
  content: string;
  role: string;
  timestamp: string;
  score: number;
}>> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 5;
    const scoreThreshold = params.scoreThreshold || 0.5;

    // Build filter for facilitator-specific or user-specific search
    const filter: any = {};
    
    if (params.facilitatorId) {
      filter.must = [
        {
          key: 'facilitatorId',
          match: { value: params.facilitatorId },
        },
      ];
    } else if (params.userId) {
      filter.must = [
        {
          key: 'userId',
          match: { value: params.userId },
        },
      ];
    }

    // Exclude current chat to avoid finding the message we just sent
    if (params.excludeChatId) {
      filter.must_not = [
        {
          key: 'chatId',
          match: { value: params.excludeChatId },
        },
      ];
    }

    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      with_payload: true,
      score_threshold: scoreThreshold,
    });

    return searchResults.map((result) => ({
      messageId: result.payload?.messageId as string,
      chatId: result.payload?.chatId as string,
      content: result.payload?.content as string,
      role: result.payload?.role as string,
      timestamp: result.payload?.timestamp as string,
      score: result.score,
    }));
  } catch (error) {
    console.error('Error searching relevant messages:', error);
    return [];
  }
}

/**
 * Search globally across all facilitators (for cross-learning)
 */
export async function searchGlobalMemory(params: {
  query: string;
  excludeChatId?: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<Array<{
  messageId: string;
  chatId: string;
  content: string;
  role: string;
  timestamp: string;
  score: number;
}>> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 10;
    const scoreThreshold = params.scoreThreshold || 0.6;

    // Exclude current chat to avoid finding the message we just sent
    const filter: any = {};
    if (params.excludeChatId) {
      filter.must_not = [
        {
          key: 'chatId',
          match: { value: params.excludeChatId },
        },
      ];
    }

    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      with_payload: true,
      score_threshold: scoreThreshold,
    });

    return searchResults.map((result) => ({
      messageId: result.payload?.messageId as string,
      chatId: result.payload?.chatId as string,
      content: result.payload?.content as string,
      role: result.payload?.role as string,
      timestamp: result.payload?.timestamp as string,
      score: result.score,
    }));
  } catch (error) {
    console.error('Error searching global memory:', error);
    return [];
  }
}

/**
 * Get context summary from relevant messages
 */
export async function getContextForQuery(params: {
  query: string;
  chatId?: string;
  facilitatorId?: string;
  userId?: string;
  includeGlobal?: boolean;
}): Promise<string> {
  try {
    console.log('[Vector Memory] Searching for context with params:', {
      chatId: params.chatId,
      facilitatorId: params.facilitatorId,
      userId: params.userId,
      includeGlobal: params.includeGlobal,
      queryPreview: params.query.substring(0, 50) + '...'
    });

    // First, search facilitator/user-specific messages (excluding current chat)
    const relevantMessages = await searchRelevantMessages({
      query: params.query,
      facilitatorId: params.facilitatorId,
      userId: params.userId,
      excludeChatId: params.chatId,
      limit: 3,
    });

    console.log(`[Vector Memory] Found ${relevantMessages.length} relevant user messages`);

    // Optionally add global context for cross-learning (excluding current chat)
    let globalMessages: any[] = [];
    if (params.includeGlobal) {
      globalMessages = await searchGlobalMemory({
        query: params.query,
        excludeChatId: params.chatId,
        limit: 2,
        scoreThreshold: 0.6,
      });
      console.log(`[Vector Memory] Found ${globalMessages.length} global messages`);
    }

    // Format context for the AI
    let context = '';

    if (relevantMessages.length > 0) {
      context += '## Relevant Past Conversations:\n\n';
      relevantMessages.forEach((msg, idx) => {
        context += `${idx + 1}. [${msg.role}]: ${msg.content}\n`;
      });
      context += '\n';
    }

    if (globalMessages.length > 0) {
      context += '## Related Experiences from Other Facilitators:\n\n';
      globalMessages.forEach((msg, idx) => {
        context += `${idx + 1}. ${msg.content}\n`;
      });
      context += '\n';
    }

    console.log(`[Vector Memory] Generated context length: ${context.length} characters`);
    if (context.length > 0) {
      console.log('[Vector Memory] Context preview:', context.substring(0, 200) + '...');
    }

    return context;
  } catch (error) {
    console.error('Error getting context for query:', error);
    return '';
  }
}

/**
 * Get comprehensive context including portfolio data, recent messages, and vector search
 */
export async function getComprehensiveContext(params: {
  query: string;
  chatId?: string;
  facilitatorId?: string;
  userId: string;
  includeGlobal?: boolean;
}): Promise<string> {
  try {
    console.log('[Comprehensive Context] Building full context for user:', params.userId);
    
    let context = '';

    // 0. Active Document Chunks (RAG context) - Search first as authoritative reference
    try {
      const documentChunks = await searchActiveDocuments({
        query: params.query,
        limit: 5, // Increased from 3 to provide more comprehensive coverage
        scoreThreshold: 0.3, // Lowered from 0.5 to retrieve more potentially relevant content
      });
      
      if (documentChunks && documentChunks.length > 0) {
        context += '## Reference Materials:\n';
        context += 'The following information is from uploaded training documents and should be used as authoritative reference:\n\n';
        documentChunks.forEach((chunk, idx) => {
          context += `**From "${chunk.documentName}" (Section ${chunk.chunkIndex + 1}):**\n`;
          context += `${chunk.chunkText}\n\n`;
        });
        console.log(`[Comprehensive Context] Added ${documentChunks.length} document chunks from PDFs`);
      } else {
        console.log('[Comprehensive Context] No relevant document chunks found for this query');
      }
    } catch (error) {
      console.error('[Comprehensive Context] Error fetching documents:', error);
    }

    // 1. Portfolio Data - Always include current facilitator profile
    if (params.facilitatorId) {
      try {
        const facilitator = await storage.getFacilitatorByUserId(params.userId);
        
        if (facilitator) {
          const [competencies, qualifications, activities] = await Promise.all([
            storage.getFacilitatorCompetencies(facilitator.id),
            storage.getFacilitatorQualifications(facilitator.id),
            storage.getFacilitatorActivities(facilitator.id),
          ]);

          context += '## Current Portfolio Information:\n\n';
          
          context += `**Profile:**\n`;
          if (facilitator.region) context += `- Region: ${facilitator.region}\n`;
          if (facilitator.mentorSupervisor) context += `- Supervisor: ${facilitator.mentorSupervisor}\n`;
          context += `- Total Languages Mentored: ${facilitator.totalLanguagesMentored}\n`;
          context += `- Total Chapters Mentored: ${facilitator.totalChaptersMentored}\n\n`;

          if (competencies && competencies.length > 0) {
            context += `**Competencies:**\n`;
            competencies.forEach((comp: any) => {
              context += `- ${comp.competencyId}: ${comp.status}`;
              if (comp.notes) context += ` (${comp.notes})`;
              context += '\n';
            });
            context += '\n';
          }

          if (qualifications && qualifications.length > 0) {
            context += `**Qualifications (Education Pillar):**\n`;
            qualifications.forEach((qual: any, idx: number) => {
              context += `${idx + 1}. ${qual.courseTitle}`;
              if (qual.institution) context += ` - ${qual.institution}`;
              if (qual.courseLevel) context += ` [${qual.courseLevel} level]`;
              if (qual.completionDate) {
                const date = new Date(qual.completionDate);
                context += ` (${date.getFullYear()})`;
              }
              context += '\n';
            });
            context += '\n';
          } else {
            context += `**Qualifications (Education Pillar):** NONE - This is a critical gap!\n\n`;
          }

          if (activities && activities.length > 0) {
            context += `**Activities (Experience Pillar):**\n`;
            activities.slice(-10).forEach((act: any, idx: number) => {
              if (act.languageName) {
                context += `${idx + 1}. ${act.languageName}: ${act.chaptersCount} chapters`;
              } else if (act.title) {
                context += `${idx + 1}. ${act.title} (${act.activityType})`;
                if (act.yearsOfExperience) context += ` - ${act.yearsOfExperience} years`;
              }
              if (act.notes) context += ` - ${act.notes}`;
              context += '\n';
            });
            context += '\n';
          } else {
            context += `**Activities (Experience Pillar):** NONE - This is a critical gap!\n\n`;
          }
          
          // Two-Pillar Gap Analysis Summary
          const hasEducation = qualifications && qualifications.length > 0;
          const hasExperience = activities && activities.length > 0;
          
          context += `**TWO-PILLAR GAP ANALYSIS:**\n`;
          if (!hasEducation && !hasExperience) {
            context += `⚠️ CRITICAL: Both pillars are empty! This facilitator needs BOTH formal training (courses, certificates) AND practical experience (translation work, facilitation).\n`;
          } else if (!hasEducation) {
            context += `⚠️ EDUCATION GAP: The facilitator has practical experience but NO formal qualifications. Recommend relevant courses or training programs.\n`;
          } else if (!hasExperience) {
            context += `⚠️ EXPERIENCE GAP: The facilitator has education but NO documented practical experience. Recommend field work, mentorship opportunities, or translation activities.\n`;
          } else {
            context += `✓ Both pillars present: Continue developing balance between education and experience.\n`;
          }
          context += '\n';

          console.log('[Comprehensive Context] Added portfolio data with two-pillar analysis');
        }
      } catch (error) {
        console.error('[Comprehensive Context] Error fetching portfolio:', error);
      }
    }

    // 2. Recent Messages from ALL User Chats (efficiently via SQL)
    try {
      // Get last 20 messages across all user's chats in one efficient SQL query
      const recentMessages = await storage.getRecentUserMessages(params.userId, 20);

      if (recentMessages.length > 0) {
        context += '## Recent Conversation History:\n\n';
        // Reverse to show oldest first
        recentMessages.reverse().forEach((msg) => {
          const truncated = msg.content.length > 150 
            ? msg.content.substring(0, 150) + '...' 
            : msg.content;
          context += `[${msg.role}]: ${truncated}\n`;
        });
        context += '\n';
        console.log(`[Comprehensive Context] Added ${recentMessages.length} recent messages`);
      }
    } catch (error) {
      console.error('[Comprehensive Context] Error fetching recent messages:', error);
    }

    // 3. Reference Materials from Uploaded Documents (HIGHEST PRIORITY)
    try {
      const documentChunks = await searchActiveDocuments({
        query: params.query,
        limit: 3,
        scoreThreshold: 0.6,
      });

      if (documentChunks && documentChunks.length > 0) {
        context += '\n\n## Reference Materials:\n';
        context += 'The following excerpts are from official OBT training documents. Use ONLY this information to answer questions about OBT methodology, competencies, and best practices.\n\n';
        
        documentChunks.forEach((chunk, idx) => {
          context += `\n### Document: ${chunk.documentName} (Chunk ${chunk.chunkIndex + 1})\n`;
          context += `${chunk.chunkText}\n`;
          context += `(Relevance score: ${(chunk.score * 100).toFixed(1)}%)\n`;
        });
        
        console.log(`[Comprehensive Context] Added ${documentChunks.length} document chunks from PDFs`);
      } else {
        console.log('[Comprehensive Context] No relevant document chunks found');
      }
    } catch (error) {
      console.error('[Comprehensive Context] Error searching documents:', error);
    }

    // 4. Vector Search Results (semantic search across past conversations)
    const vectorContext = await getContextForQuery({
      query: params.query,
      chatId: params.chatId,
      facilitatorId: params.facilitatorId,
      userId: params.userId,
      includeGlobal: params.includeGlobal,
    });

    if (vectorContext) {
      context += vectorContext;
    }

    console.log(`[Comprehensive Context] Total context length: ${context.length} characters`);
    
    return context;
  } catch (error) {
    console.error('[Comprehensive Context] Error building comprehensive context:', error);
    return '';
  }
}

/**
 * Delete all embeddings for a specific chat
 */
export async function deleteChatEmbeddings(chatId: string): Promise<void> {
  try {
    // Delete all points with this chatId
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'chatId',
            match: { value: chatId },
          },
        ],
      },
    });

    console.log(`[Qdrant] Deleted all embeddings for chat ${chatId}`);
  } catch (error) {
    console.error(`[Qdrant] Error deleting embeddings for chat ${chatId}:`, error);
    // Don't throw - we don't want embedding deletion failures to break chat deletion
  }
}

/**
 * Delete all embeddings for a specific document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  try {
    // Delete all points with this documentId
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'documentId',
            match: { value: documentId },
          },
        ],
      },
    });

    console.log(`[Qdrant] Deleted all chunks for document ${documentId}`);
  } catch (error) {
    console.error(`[Qdrant] Error deleting chunks for document ${documentId}:`, error);
    // Don't throw - we don't want embedding deletion failures to break document deletion
  }
}

/**
 * Search for relevant active document chunks
 */
export async function searchActiveDocuments(params: {
  query: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<Array<{
  documentId: string;
  documentName: string;
  chunkText: string;
  chunkIndex: number;
  score: number;
}>> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 5;
    const scoreThreshold = params.scoreThreshold || 0.5;

    console.log(`[Document Search] Searching for: "${params.query}" (threshold: ${scoreThreshold}, limit: ${limit})`);

    // Build filter to only search active documents
    const filter: any = {
      must: [
        {
          key: 'type',
          match: { value: 'document' },
        },
        {
          key: 'isActive',
          match: { value: true },
        },
      ],
    };

    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      filter,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    console.log(`[Document Search] Found ${searchResults.length} chunks from Qdrant`);
    
    if (searchResults.length > 0) {
      searchResults.forEach((result, idx) => {
        console.log(`  ${idx + 1}. ${result.payload?.documentName} (score: ${(result.score * 100).toFixed(1)}%)`);
      });
    }

    const documentResults = searchResults
      .filter((result) => result.payload?.type === 'document')
      .map((result) => ({
        documentId: result.payload?.documentId as string,
        documentName: result.payload?.documentName as string,
        chunkText: result.payload?.chunkText as string,
        chunkIndex: result.payload?.chunkIndex as number,
        score: result.score,
      }));

    console.log(`[Document Search] Returning ${documentResults.length} document chunks`);
    
    return documentResults;
  } catch (error) {
    console.error('[Document Search] Error searching active documents:', error);
    return [];
  }
}

import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "./storage";
import type { Message } from "@shared/schema";

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

const COLLECTION_NAME = "obt_global_memory";
const VECTOR_DIM = 768;

export async function initializeQdrantCollection() {
  try {
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some((col) => col.name === COLLECTION_NAME);

    if (collectionExists) {
      try {
        const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
        const currentDim =
          typeof collectionInfo.config.params.vectors === "object" && "size" in collectionInfo.config.params.vectors
            ? collectionInfo.config.params.vectors.size
            : 0;

        if (currentDim !== VECTOR_DIM) {
          console.log(`[Qdrant Migration] Collection dimension mismatch: ${currentDim} -> ${VECTOR_DIM}`);
          await qdrant.deleteCollection(COLLECTION_NAME);
          await createCollection();
          return;
        }
      } catch (error) {
        console.error("[Qdrant] Error checking collection dimension:", error);
      }
    }

    if (!collectionExists) {
      console.log(`Creating Qdrant collection: ${COLLECTION_NAME}`);
      await createCollection();
    } else {
      console.log(`Qdrant collection ${COLLECTION_NAME} already exists`);
      await ensureIndexes();
    }
  } catch (error) {
    console.error("Error initializing Qdrant collection:", error);
    throw error;
  }
}

async function createCollection() {
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: VECTOR_DIM,
      distance: "Cosine",
    },
    optimizers_config: {
      default_segment_number: 2,
    },
    replication_factor: 1,
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "userId",
    field_schema: "keyword",
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "facilitatorId",
    field_schema: "keyword",
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "chatId",
    field_schema: "keyword",
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "type",
    field_schema: "keyword",
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "isActive",
    field_schema: "bool",
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "documentId",
    field_schema: "keyword",
  });

  console.log(`Qdrant collection ${COLLECTION_NAME} created successfully with ${VECTOR_DIM} dimensions`);
}

async function ensureIndexes() {
  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "type",
      field_schema: "keyword",
    });
  } catch (e) {}

  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "isActive",
      field_schema: "bool",
    });
  } catch (e) {}

  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "documentId",
      field_schema: "keyword",
    });
  } catch (e) {}
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding || !embedding.values) {
      throw new Error("No embedding values returned from Google API");
    }

    return embedding.values;
  } catch (error) {
    console.error("Error generating embedding with Google:", error);
    throw error;
  }
}

export async function storeMessageEmbedding(params: {
  messageId: string;
  chatId: string;
  userId: string;
  facilitatorId?: string;
  content: string;
  role: "user" | "assistant";
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
    console.error("Error storing message embedding:", error);
  }
}

export async function searchRelevantMessages(params: {
  query: string;
  facilitatorId?: string;
  userId?: string;
  excludeChatId?: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<
  Array<{
    messageId: string;
    chatId: string;
    content: string;
    role: string;
    timestamp: string;
    score: number;
  }>
> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 5;
    const scoreThreshold = params.scoreThreshold || 0.5;

    const filter: any = {};

    if (params.facilitatorId) {
      filter.must = [
        {
          key: "facilitatorId",
          match: { value: params.facilitatorId },
        },
      ];
    } else if (params.userId) {
      filter.must = [
        {
          key: "userId",
          match: { value: params.userId },
        },
      ];
    }

    if (params.excludeChatId) {
      filter.must_not = [
        {
          key: "chatId",
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
    console.error("Error searching relevant messages:", error);
    return [];
  }
}

export async function searchGlobalMemory(params: {
  query: string;
  excludeChatId?: string;
  limit?: number;
  scoreThreshold?: number;
}): Promise<
  Array<{
    messageId: string;
    chatId: string;
    content: string;
    role: string;
    timestamp: string;
    score: number;
  }>
> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 10;
    const scoreThreshold = params.scoreThreshold || 0.6;

    const filter: any = {};
    if (params.excludeChatId) {
      filter.must_not = [
        {
          key: "chatId",
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
    console.error("Error searching global memory:", error);
    return [];
  }
}

export async function getContextForQuery(params: {
  query: string;
  chatId?: string;
  facilitatorId?: string;
  userId?: string;
  includeGlobal?: boolean;
}): Promise<string> {
  try {
    console.log("[Vector Memory] Searching for context with params:", {
      chatId: params.chatId,
      facilitatorId: params.facilitatorId,
      userId: params.userId,
      includeGlobal: params.includeGlobal,
      queryPreview: params.query.substring(0, 50) + "...",
    });

    const relevantMessages = await searchRelevantMessages({
      query: params.query,
      facilitatorId: params.facilitatorId,
      userId: params.userId,
      excludeChatId: params.chatId,
      limit: 3,
    });

    console.log(`[Vector Memory] Found ${relevantMessages.length} relevant user messages`);

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

    let context = "";

    if (relevantMessages.length > 0) {
      context += "## Relevant Past Conversations:\n\n";
      relevantMessages.forEach((msg, idx) => {
        context += `${idx + 1}. [${msg.role}]: ${msg.content}\n`;
      });
      context += "\n";
    }

    if (globalMessages.length > 0) {
      context += "## Related Experiences from Other Facilitators:\n\n";
      globalMessages.forEach((msg, idx) => {
        context += `${idx + 1}. ${msg.content}\n`;
      });
      context += "\n";
    }

    console.log(`[Vector Memory] Generated context length: ${context.length} characters`);

    return context;
  } catch (error) {
    console.error("Error getting context for query:", error);
    return "";
  }
}

export async function getComprehensiveContext(params: {
  query: string;
  chatId?: string;
  facilitatorId?: string;
  userId: string;
  includeGlobal?: boolean;
}): Promise<string> {
  try {
    console.log("[Comprehensive Context] Building full context for user:", params.userId);

    let context = "";

    try {
      const { detectCompetenciesInConversation } = await import("./competency-mapping.js");

      const detectedCompetencies = detectCompetenciesInConversation(params.query, 3);

      if (detectedCompetencies.length > 0) {
        console.log(`[Comprehensive Context] Detected competencies: ${detectedCompetencies.join(", ")}`);
      }

      let documentChunks = await searchActiveDocuments({
        query: params.query,
        limit: 5,
        scoreThreshold: 0.3,
        competencyFilter: detectedCompetencies.length > 0 ? detectedCompetencies : undefined,
      });

      if ((!documentChunks || documentChunks.length === 0) && detectedCompetencies.length > 0) {
        console.log("[Comprehensive Context] No results with competency filter, retrying without filter");
        documentChunks = await searchActiveDocuments({
          query: params.query,
          limit: 5,
          scoreThreshold: 0.3,
        });
      }

      if (documentChunks && documentChunks.length > 0) {
        console.log(`[RAG] Found ${documentChunks.length} relevant document chunks from Qdrant`);

        context += "## Reference Materials:\n";
        documentChunks.forEach((chunk, idx) => {
          const competencyNote =
            chunk.competencyTags && chunk.competencyTags.length > 0
              ? ` [Relevant to: ${chunk.competencyTags.join(", ")}]`
              : "";
          const documentNameWithoutExt = chunk.documentName.replace(/\.(pdf|docx|txt)$/i, "");
          context += `**From "${documentNameWithoutExt}" (Section ${chunk.chunkIndex + 1})${competencyNote}:**\n`;
          context += `${chunk.chunkText}\n\n`;
        });
      }
    } catch (error) {
      console.error("[Comprehensive Context] Error fetching documents:", error);
    }

    if (params.facilitatorId) {
      try {
        const facilitator = await storage.getFacilitatorByUserId(params.userId);

        if (facilitator) {
          const [competencies, qualifications, activities] = await Promise.all([
            storage.getFacilitatorCompetencies(facilitator.id),
            storage.getFacilitatorQualifications(facilitator.id),
            storage.getFacilitatorActivities(facilitator.id),
          ]);

          context += "## Current Portfolio Information:\n\n";

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
              context += "\n";
            });
            context += "\n";
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
              context += ` [ID: ${qual.id}]`;
              context += "\n";
            });
            context += "\n";
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
              context += "\n";
            });
            context += "\n";
          } else {
            context += `**Activities (Experience Pillar):** NONE - This is a critical gap!\n\n`;
          }

          const hasEducation = qualifications && qualifications.length > 0;
          const hasExperience = activities && activities.length > 0;

          context += `**TWO-PILLAR GAP ANALYSIS:**\n`;
          if (!hasEducation && !hasExperience) {
            context += `CRITICAL: Both pillars are empty! This facilitator needs BOTH formal training AND practical experience.\n`;
          } else if (!hasEducation) {
            context += `EDUCATION GAP: The facilitator has practical experience but NO formal qualifications.\n`;
          } else if (!hasExperience) {
            context += `EXPERIENCE GAP: The facilitator has education but NO documented practical experience.\n`;
          } else {
            context += `Both pillars present: Continue developing balance between education and experience.\n`;
          }
          context += "\n";

          console.log("[Comprehensive Context] Added portfolio data with two-pillar analysis");
        }
      } catch (error) {
        console.error("[Comprehensive Context] Error fetching portfolio:", error);
      }
    }

    try {
      const recentMessages = await storage.getRecentUserMessages(params.userId, 20);

      if (recentMessages.length > 0) {
        context += "## Recent Conversation History:\n\n";
        recentMessages.reverse().forEach((msg) => {
          const truncated = msg.content.length > 150 ? msg.content.substring(0, 150) + "..." : msg.content;
          context += `[${msg.role}]: ${truncated}\n`;
        });
        context += "\n";
        console.log(`[Comprehensive Context] Added ${recentMessages.length} recent messages`);
      }
    } catch (error) {
      console.error("[Comprehensive Context] Error fetching recent messages:", error);
    }

    try {
      const documentChunks = await searchActiveDocuments({
        query: params.query,
        limit: 3,
        scoreThreshold: 0.6,
      });

      if (documentChunks && documentChunks.length > 0) {
        context += "\n\n## Reference Materials:\n";
        context +=
          "The following excerpts are from official OBT training documents. Use ONLY this information to answer questions about OBT methodology, competencies, and best practices.\n\n";

        documentChunks.forEach((chunk, idx) => {
          context += `\n### Document: ${chunk.documentName} (Chunk ${chunk.chunkIndex + 1})\n`;
          context += `${chunk.chunkText}\n`;
          context += `(Relevance score: ${(chunk.score * 100).toFixed(1)}%)\n`;
        });

        console.log(`[Comprehensive Context] Added ${documentChunks.length} document chunks from PDFs`);
      }
    } catch (error) {
      console.error("[Comprehensive Context] Error searching documents:", error);
    }

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
    console.error("[Comprehensive Context] Error building comprehensive context:", error);
    return "";
  }
}

export async function deleteChatEmbeddings(chatId: string): Promise<void> {
  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "chatId",
            match: { value: chatId },
          },
        ],
      },
    });

    console.log(`[Qdrant] Deleted all embeddings for chat ${chatId}`);
  } catch (error) {
    console.error(`[Qdrant] Error deleting embeddings for chat ${chatId}:`, error);
  }
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "documentId",
            match: { value: documentId },
          },
        ],
      },
    });

    console.log(`[Qdrant] Deleted all chunks for document ${documentId}`);
  } catch (error) {
    console.error(`[Qdrant] Error deleting chunks for document ${documentId}:`, error);
  }
}

export async function searchActiveDocuments(params: {
  query: string;
  limit?: number;
  scoreThreshold?: number;
  competencyFilter?: string[];
}): Promise<
  Array<{
    documentId: string;
    documentName: string;
    chunkText: string;
    chunkIndex: number;
    score: number;
    competencyTags?: string[];
  }>
> {
  try {
    const queryEmbedding = await generateEmbedding(params.query);
    const limit = params.limit || 5;
    const scoreThreshold = params.scoreThreshold || 0.5;

    console.log(`[Document Search] Searching for: "${params.query.substring(0, 50)}..." (threshold: ${scoreThreshold})`);

    const filter: any = {
      must: [
        {
          key: "type",
          match: { value: "document" },
        },
        {
          key: "isActive",
          match: { value: true },
        },
      ],
    };

    if (params.competencyFilter && params.competencyFilter.length > 0) {
      filter.should = params.competencyFilter.map((competency) => ({
        key: "competencyTags",
        match: { any: [competency] },
      }));
    }

    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      filter,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    console.log(`[Document Search] Found ${searchResults.length} chunks from Qdrant`);

    const documentResults = searchResults
      .filter((result) => result.payload?.type === "document")
      .map((result) => ({
        documentId: result.payload?.documentId as string,
        documentName: result.payload?.documentName as string,
        chunkText: result.payload?.chunkText as string,
        chunkIndex: result.payload?.chunkIndex as number,
        score: result.score,
        competencyTags: (result.payload?.competencyTags as string[]) || [],
      }));

    return documentResults;
  } catch (error) {
    console.error("[Document Search] Error searching active documents:", error);
    return [];
  }
}

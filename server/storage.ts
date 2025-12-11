import {
  users,
  chats,
  chatChains,
  messages,
  messageAttachments,
  apiKeys,
  apiUsage,
  feedback,
  facilitators,
  facilitatorCompetencies,
  facilitatorQualifications,
  qualificationAttachments,
  mentorshipActivities,
  quarterlyReports,
  competencyEvidence,
  competencyChangeHistory,
  systemSettings,
  documents,
  type User,
  type UpsertUser,
  type InsertUser,
  type Chat,
  type InsertChat,
  type ChatChain,
  type InsertChatChain,
  type Message,
  type InsertMessage,
  type MessageAttachment,
  type InsertMessageAttachment,
  type ApiKey,
  type InsertApiKey,
  type ApiUsage,
  type InsertApiUsage,
  type Feedback,
  type InsertFeedback,
  type Facilitator,
  type InsertFacilitator,
  type FacilitatorCompetency,
  type InsertFacilitatorCompetency,
  type FacilitatorQualification,
  type InsertFacilitatorQualification,
  type QualificationAttachment,
  type InsertQualificationAttachment,
  type MentorshipActivity,
  type InsertMentorshipActivity,
  type QuarterlyReport,
  type InsertQuarterlyReport,
  type CompetencyEvidence,
  type InsertCompetencyEvidence,
  type CompetencyChangeHistory,
  type InsertCompetencyChangeHistory,
  type Document,
  type InsertDocument,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, count, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFacilitatorId(facilitatorId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Activity tracking operations
  incrementUserChatCount(userId: string): Promise<void>;
  incrementUserMessageCount(userId: string): Promise<void>;
  incrementUserApiUsage(userId: string): Promise<void>;
  updateUserLastLogin(userId: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void>;
  
  // Chat chain operations
  getUserChatChains(userId: string): Promise<ChatChain[]>;
  getChatChain(chainId: string, userId: string): Promise<ChatChain | undefined>;
  createChatChain(chain: InsertChatChain): Promise<ChatChain>;
  updateChatChain(chainId: string, updates: Partial<InsertChatChain>, userId: string): Promise<ChatChain>;
  deleteChatChain(chainId: string, userId: string): Promise<void>;
  getChainChats(chainId: string, userId: string): Promise<Chat[]>;
  addChatToChain(chatId: string, chainId: string, userId: string): Promise<Chat>;
  removeChatFromChain(chatId: string, userId: string): Promise<Chat>;
  
  // Chat operations
  getUserChats(userId: string): Promise<Chat[]>;
  getChat(chatId: string, userId: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChatTitle(chatId: string, title: string, userId: string): Promise<void>;
  updateChat(chatId: string, updates: Partial<Pick<InsertChat, 'assistantId' | 'title'>>, userId: string): Promise<Chat>;
  updateChatThreadId(chatId: string, threadId: string, userId: string): Promise<void>;
  getChatThreadId(chatId: string, userId: string): Promise<string | null>;
  getUserThreadId(userId: string): Promise<string | null>;
  updateUserThreadId(userId: string, threadId: string): Promise<void>;
  deleteChat(chatId: string, userId: string): Promise<void>;
  
  // Message operations
  getChatMessages(chatId: string, userId: string): Promise<Message[]>;
  getMessage(messageId: string): Promise<Message | undefined>;
  getRecentUserMessages(userId: string, limit: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(messageId: string, updates: Partial<Pick<InsertMessage, 'content'>>): Promise<Message>;
  
  // Message attachment operations
  getMessageAttachments(messageId: string): Promise<MessageAttachment[]>;
  createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment>;
  
  // API Key operations
  getUserApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getApiKeysByPrefix(prefix: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey & { key: string }): Promise<ApiKey>;
  deleteApiKey(keyId: string, userId: string): Promise<void>;
  updateApiKeyLastUsed(keyId: string): Promise<void>;
  
  // Usage operations
  recordApiUsage(usage: InsertApiUsage): Promise<void>;
  getUserStats(userId: string): Promise<{
    totalMessages: number;
    totalApiCalls: number;
    activeApiKeys: number;
  }>;
  
  // Feedback operations
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  getFeedback(feedbackId: string): Promise<Feedback | undefined>;
  updateFeedbackStatus(feedbackId: string, status: 'new' | 'read' | 'resolved'): Promise<Feedback | null>;
  deleteFeedback(feedbackId: string): Promise<boolean>;
  getUnreadFeedbackCount(): Promise<number>;
  
  // Admin user management operations
  getAllUsersWithStats(): Promise<(User & {
    stats: {
      totalChats: number;
      totalMessages: number;
      totalApiKeys: number;
      totalApiCalls: number;
    }
  })[]>;
  toggleUserAdminStatus(userId: string): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  resetUserPassword(userId: string, newPassword: string): Promise<User>;
  
  // User approval management operations
  getPendingUsers(): Promise<User[]>;
  getPendingUsersCount(): Promise<number>;
  approveUser(userId: string, approvedById: string): Promise<User>;
  rejectUser(userId: string, approvedById: string): Promise<User>;
  
  // Supervisor operations
  getSupervisedUsers(supervisorId: string): Promise<(User & {
    stats: {
      totalChats: number;
      totalMessages: number;
      totalApiKeys: number;
      totalApiCalls: number;
    }
  })[]>;
  getAllSupervisors(): Promise<User[]>;
  toggleUserSupervisorStatus(userId: string): Promise<User>;
  updateUserSupervisor(userId: string, supervisorId: string | null): Promise<User>;
  getSupervisedUsersCount(supervisorId: string): Promise<number>;
  getPendingUsersForSupervisor(supervisorId: string): Promise<User[]>;
  
  // System settings operations
  getSystemSetting(key: string): Promise<string | null>;
  setSystemSetting(key: string, value: string, updatedBy?: string): Promise<void>;
  
  // Facilitator operations
  getFacilitatorByUserId(userId: string): Promise<Facilitator | undefined>;
  getAllFacilitators(): Promise<Facilitator[]>;
  createFacilitator(facilitator: InsertFacilitator): Promise<Facilitator>;
  updateFacilitator(facilitatorId: string, updates: Partial<InsertFacilitator>): Promise<Facilitator>;
  
  // Competency operations
  getFacilitatorCompetencies(facilitatorId: string): Promise<FacilitatorCompetency[]>;
  upsertCompetency(competency: InsertFacilitatorCompetency): Promise<FacilitatorCompetency>;
  updateCompetencyStatus(competencyId: string, status: string, notes?: string, changedBy?: string, changedByUserId?: string, statusSource?: 'auto' | 'manual' | 'evidence' | 'conversation'): Promise<FacilitatorCompetency>;
  recalculateCompetencies(facilitatorId: string): Promise<{ preventedDowngrades: string[] }>;
  recalculateAllCompetencies(): Promise<{total: number, processed: number, errors: string[]}>;
  getCompetencyChangeHistory(competencyRecordId: string): Promise<CompetencyChangeHistory[]>;
  
  // Qualification operations
  getFacilitatorQualifications(facilitatorId: string): Promise<FacilitatorQualification[]>;
  createQualification(qualification: InsertFacilitatorQualification): Promise<FacilitatorQualification>;
  updateQualification(qualificationId: string, updates: Partial<Omit<InsertFacilitatorQualification, 'facilitatorId'>>): Promise<FacilitatorQualification>;
  deleteQualification(qualificationId: string): Promise<void>;
  
  // Qualification attachment operations
  getQualificationAttachments(qualificationId: string): Promise<QualificationAttachment[]>;
  createQualificationAttachment(attachment: InsertQualificationAttachment): Promise<QualificationAttachment>;
  deleteQualificationAttachment(attachmentId: string): Promise<void>;
  
  // Mentorship activity operations
  getFacilitatorActivities(facilitatorId: string): Promise<MentorshipActivity[]>;
  createActivity(activity: InsertMentorshipActivity): Promise<MentorshipActivity>;
  updateActivity(activityId: string, updates: Partial<Omit<InsertMentorshipActivity, 'facilitatorId'>>): Promise<MentorshipActivity>;
  deleteActivity(activityId: string): Promise<void>;
  updateFacilitatorTotals(facilitatorId: string): Promise<void>;
  
  // Quarterly report operations
  getFacilitatorReports(facilitatorId: string): Promise<QuarterlyReport[]>;
  createQuarterlyReport(report: InsertQuarterlyReport): Promise<QuarterlyReport>;
  getLatestReport(facilitatorId: string): Promise<QuarterlyReport | undefined>;
  getQuarterlyReport(reportId: string): Promise<QuarterlyReport | undefined>;
  deleteQuarterlyReport(reportId: string): Promise<void>;
  
  // Competency evidence operations
  getFacilitatorEvidence(facilitatorId: string): Promise<CompetencyEvidence[]>;
  getCompetencyEvidence(facilitatorId: string, competencyId: string): Promise<CompetencyEvidence[]>;
  createCompetencyEvidence(evidence: InsertCompetencyEvidence): Promise<CompetencyEvidence>;
  getRecentEvidence(facilitatorId: string, limit: number): Promise<CompetencyEvidence[]>;
  markEvidenceApplied(evidenceIds: string[]): Promise<void>;
  
  // Document operations
  getAllDocuments(): Promise<Document[]>;
  getDocument(documentId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentActive(documentId: string, isActive: boolean): Promise<Document>;
  updateDocumentMetadata(documentId: string, metadata: {
    competencyTags?: string[];
    topicTags?: string[];
    contentType?: "best_practices" | "methodology" | "training_material" | "case_study" | "general";
    description?: string;
  }): Promise<Document>;
  deleteDocument(documentId: string): Promise<void>;
  getActiveDocuments(): Promise<Document[]>;
  getDocumentsByCompetency(competencyId: string): Promise<Document[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByFacilitatorId(facilitatorId: string): Promise<User | undefined> {
    const [result] = await db
      .select({ user: users })
      .from(facilitators)
      .innerJoin(users, eq(facilitators.userId, users.id))
      .where(eq(facilitators.id, facilitatorId));
    return result?.user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Activity tracking operations
  async incrementUserChatCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        chatCount: sql`chat_count + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async incrementUserMessageCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        messageCount: sql`message_count + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async incrementUserApiUsage(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        apiUsageCount: sql`api_usage_count + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        profileImageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Chat chain operations
  async getUserChatChains(userId: string): Promise<ChatChain[]> {
    return await db
      .select()
      .from(chatChains)
      .where(eq(chatChains.userId, userId))
      .orderBy(desc(chatChains.updatedAt));
  }

  async getChatChain(chainId: string, userId: string): Promise<ChatChain | undefined> {
    const [chain] = await db
      .select()
      .from(chatChains)
      .where(and(eq(chatChains.id, chainId), eq(chatChains.userId, userId)));
    return chain;
  }

  async createChatChain(chain: InsertChatChain): Promise<ChatChain> {
    const [newChain] = await db.insert(chatChains).values(chain).returning();
    return newChain;
  }

  async updateChatChain(chainId: string, updates: Partial<InsertChatChain>, userId: string): Promise<ChatChain> {
    const [updatedChain] = await db
      .update(chatChains)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(chatChains.id, chainId), eq(chatChains.userId, userId)))
      .returning();
    return updatedChain;
  }

  async deleteChatChain(chainId: string, userId: string): Promise<void> {
    // First, remove all chats from this chain
    await db
      .update(chats)
      .set({ chainId: null, sequenceIndex: null })
      .where(eq(chats.chainId, chainId));
    
    // Then delete the chain
    await db
      .delete(chatChains)
      .where(and(eq(chatChains.id, chainId), eq(chatChains.userId, userId)));
  }

  async getChainChats(chainId: string, userId: string): Promise<Chat[]> {
    return await db
      .select()
      .from(chats)
      .where(and(eq(chats.chainId, chainId), eq(chats.userId, userId)))
      .orderBy(chats.sequenceIndex);
  }

  async addChatToChain(chatId: string, chainId: string, userId: string): Promise<Chat> {
    // Get the max sequence index for this chain
    const chainChats = await this.getChainChats(chainId, userId);
    const nextIndex = chainChats.length;
    
    const [updatedChat] = await db
      .update(chats)
      .set({ 
        chainId, 
        sequenceIndex: nextIndex,
        updatedAt: new Date()
      })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning();
    
    // Update chain's updatedAt
    await db
      .update(chatChains)
      .set({ updatedAt: new Date() })
      .where(eq(chatChains.id, chainId));
    
    return updatedChat;
  }

  async removeChatFromChain(chatId: string, userId: string): Promise<Chat> {
    const [updatedChat] = await db
      .update(chats)
      .set({ 
        chainId: null, 
        sequenceIndex: null,
        updatedAt: new Date()
      })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning();
    
    return updatedChat;
  }

  // Chat operations
  async getUserChats(userId: string): Promise<Chat[]> {
    return await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.updatedAt));
  }

  async getChat(chatId: string, userId: string): Promise<Chat | undefined> {
    const [chat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
    return chat;
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db.insert(chats).values(chat).returning();
    return newChat;
  }

  async updateChatTitle(chatId: string, title: string, userId: string): Promise<void> {
    await db
      .update(chats)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  }

  async updateChat(chatId: string, updates: Partial<Pick<InsertChat, 'assistantId' | 'title'>>, userId: string): Promise<Chat> {
    const [updatedChat] = await db
      .update(chats)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning();
    return updatedChat;
  }

  async updateChatThreadId(chatId: string, threadId: string, userId: string): Promise<void> {
    await db
      .update(chats)
      .set({ threadId, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  }

  async getChatThreadId(chatId: string, userId: string): Promise<string | null> {
    const [chat] = await db
      .select({ threadId: chats.threadId })
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
    return chat?.threadId || null;
  }

  async getUserThreadId(userId: string): Promise<string | null> {
    const [user] = await db
      .select({ userThreadId: users.userThreadId })
      .from(users)
      .where(eq(users.id, userId));
    return user?.userThreadId || null;
  }

  async updateUserThreadId(userId: string, threadId: string): Promise<void> {
    await db
      .update(users)
      .set({ userThreadId: threadId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  }

  // Message operations
  async getChatMessages(chatId: string, userId: string): Promise<Message[]> {
    // Verify chat belongs to user first
    const chat = await this.getChat(chatId, userId);
    if (!chat) return [];

    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    
    return result[0];
  }

  async getRecentUserMessages(userId: string, limit: number): Promise<Message[]> {
    // Get recent messages from all user's chats efficiently with SQL
    const userChatIds = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.userId, userId));
    
    const chatIds = userChatIds.map(chat => chat.id);
    
    if (chatIds.length === 0) return [];
    
    return await db
      .select()
      .from(messages)
      .where(inArray(messages.chatId, chatIds))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async updateMessage(messageId: string, updates: Partial<Pick<InsertMessage, 'content'>>): Promise<Message> {
    const [updatedMessage] = await db
      .update(messages)
      .set(updates)
      .where(eq(messages.id, messageId))
      .returning();
    return updatedMessage;
  }

  async getMessageAttachments(messageId: string): Promise<MessageAttachment[]> {
    return await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
  }

  async createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment> {
    const [created] = await db
      .insert(messageAttachments)
      .values(attachment)
      .returning();
    return created;
  }

  // API Key operations
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)));
    return apiKey;
  }

  async getApiKeysByPrefix(prefix: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.prefix, prefix), eq(apiKeys.isActive, true)));
  }

  async createApiKey(data: InsertApiKey & { key: string }): Promise<ApiKey> {
    const keyHash = await bcrypt.hash(data.key, 10);
    const prefix = data.key.substring(0, 8);
    
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        ...data,
        keyHash,
        prefix,
      })
      .returning();
    return apiKey;
  }

  async deleteApiKey(keyId: string, userId: string): Promise<void> {
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyId));
  }

  // Usage operations
  async recordApiUsage(usage: InsertApiUsage): Promise<void> {
    await db.insert(apiUsage).values(usage);
  }

  async getUserStats(userId: string): Promise<{
    totalMessages: number;
    totalApiCalls: number;
    activeApiKeys: number;
  }> {
    // Get total messages from user's chats
    const [messageCount] = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(chats, eq(messages.chatId, chats.id))
      .where(eq(chats.userId, userId));

    // Get total API calls from user's API keys
    const [apiCallCount] = await db
      .select({ count: count() })
      .from(apiUsage)
      .innerJoin(apiKeys, eq(apiUsage.apiKeyId, apiKeys.id))
      .where(eq(apiKeys.userId, userId));

    // Get active API keys count
    const [activeKeyCount] = await db
      .select({ count: count() })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));

    return {
      totalMessages: messageCount.count || 0,
      totalApiCalls: apiCallCount.count || 0,
      activeApiKeys: activeKeyCount.count || 0,
    };
  }

  // Feedback operations
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values(feedbackData)
      .returning();
    return newFeedback;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return await db
      .select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt));
  }

  async getFeedback(feedbackId: string): Promise<Feedback | undefined> {
    const [feedbackItem] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId));
    return feedbackItem;
  }

  async updateFeedbackStatus(feedbackId: string, status: 'new' | 'read' | 'resolved'): Promise<Feedback | null> {
    const [updatedFeedback] = await db
      .update(feedback)
      .set({ status, updatedAt: new Date() })
      .where(eq(feedback.id, feedbackId))
      .returning();
    return updatedFeedback || null;
  }

  async deleteFeedback(feedbackId: string): Promise<boolean> {
    const result = await db
      .delete(feedback)
      .where(eq(feedback.id, feedbackId));
    return (result.rowCount ?? 0) > 0;
  }

  async getUnreadFeedbackCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(feedback)
      .where(eq(feedback.status, 'new'));
    return result.count || 0;
  }

  // Admin user management operations
  async getAllUsersWithStats(): Promise<(User & {
    stats: {
      totalChats: number;
      totalMessages: number;
      totalApiKeys: number;
      totalApiCalls: number;
    }
  })[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    
    const usersWithStats = await Promise.all(
      allUsers.map(async (user) => {
        // Get total chats for user
        const [chatCount] = await db
          .select({ count: count() })
          .from(chats)
          .where(eq(chats.userId, user.id));

        // Get total messages from user's chats
        const [messageCount] = await db
          .select({ count: count() })
          .from(messages)
          .innerJoin(chats, eq(messages.chatId, chats.id))
          .where(eq(chats.userId, user.id));

        // Get total API keys for user
        const [apiKeyCount] = await db
          .select({ count: count() })
          .from(apiKeys)
          .where(eq(apiKeys.userId, user.id));

        // Get total API calls from user's API keys
        const [apiCallCount] = await db
          .select({ count: count() })
          .from(apiUsage)
          .innerJoin(apiKeys, eq(apiUsage.apiKeyId, apiKeys.id))
          .where(eq(apiKeys.userId, user.id));

        return {
          ...user,
          stats: {
            totalChats: chatCount.count || 0,
            totalMessages: messageCount.count || 0,
            totalApiKeys: apiKeyCount.count || 0,
            totalApiCalls: apiCallCount.count || 0,
          }
        };
      })
    );

    return usersWithStats;
  }

  async toggleUserAdminStatus(userId: string): Promise<User> {
    // First get the current user to know their current admin status
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Toggle the admin status
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isAdmin: !currentUser.isAdmin,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('Failed to update user admin status');
    }

    return updatedUser;
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      // Delete in the correct order to handle foreign key constraints
      
      // 1. Delete API usage records for user's API keys
      await db
        .delete(apiUsage)
        .where(sql`api_key_id IN (SELECT id FROM ${apiKeys} WHERE user_id = ${userId})`);
      
      // 2. Delete user's API keys
      await db.delete(apiKeys).where(eq(apiKeys.userId, userId));
      
      // 3. Delete messages from user's chats
      await db
        .delete(messages)
        .where(sql`chat_id IN (SELECT id FROM ${chats} WHERE user_id = ${userId})`);
      
      // 4. Delete user's chats
      await db.delete(chats).where(eq(chats.userId, userId));
      
      // 5. Delete user's feedback submissions (if userId is linked to feedback)
      await db.delete(feedback).where(eq(feedback.userId, userId));
      
      // 6. Finally delete the user
      const result = await db.delete(users).where(eq(users.id, userId));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<User> {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user's password
    const [updatedUser] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found or failed to reset password');
    }

    return updatedUser;
  }

  // User approval management operations
  async getPendingUsers(): Promise<User[]> {
    const pendingUsers = await db
      .select()
      .from(users)
      .where(eq(users.approvalStatus, 'pending'))
      .orderBy(desc(users.createdAt));
    
    return pendingUsers;
  }

  async getPendingUsersCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.approvalStatus, 'pending'));
    return result.count || 0;
  }

  async approveUser(userId: string, approvedById: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: approvedById,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found or failed to approve user');
    }

    return updatedUser;
  }

  async rejectUser(userId: string, approvedById: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        approvalStatus: 'rejected',
        approvedAt: new Date(),
        approvedBy: approvedById,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found or failed to reject user');
    }

    return updatedUser;
  }

  // Supervisor operations
  async getSupervisedUsers(supervisorId: string): Promise<(User & {
    stats: {
      totalChats: number;
      totalMessages: number;
      totalApiKeys: number;
      totalApiCalls: number;
    }
  })[]> {
    const supervisedUsers = await db
      .select()
      .from(users)
      .where(eq(users.supervisorId, supervisorId))
      .orderBy(desc(users.createdAt));
    
    // Get stats for each supervised user (same as getAllUsersWithStats)
    const usersWithStats = await Promise.all(
      supervisedUsers.map(async (user) => {
        // Get total chats for user
        const [chatCount] = await db
          .select({ count: count() })
          .from(chats)
          .where(eq(chats.userId, user.id));

        // Get total messages from user's chats
        const [messageCount] = await db
          .select({ count: count() })
          .from(messages)
          .innerJoin(chats, eq(messages.chatId, chats.id))
          .where(eq(chats.userId, user.id));

        // Get total API keys for user
        const [apiKeyCount] = await db
          .select({ count: count() })
          .from(apiKeys)
          .where(eq(apiKeys.userId, user.id));

        // Get total API calls from user's API keys
        const [apiCallCount] = await db
          .select({ count: count() })
          .from(apiUsage)
          .innerJoin(apiKeys, eq(apiUsage.apiKeyId, apiKeys.id))
          .where(eq(apiKeys.userId, user.id));

        return {
          ...user,
          stats: {
            totalChats: chatCount.count || 0,
            totalMessages: messageCount.count || 0,
            totalApiKeys: apiKeyCount.count || 0,
            totalApiCalls: apiCallCount.count || 0,
          }
        };
      })
    );
    
    return usersWithStats;
  }

  async getAllSupervisors(): Promise<User[]> {
    const supervisors = await db
      .select()
      .from(users)
      .where(eq(users.isSupervisor, true))
      .orderBy(users.firstName, users.lastName);
    
    return supervisors;
  }

  async toggleUserSupervisorStatus(userId: string): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const [updatedUser] = await db
      .update(users)
      .set({ 
        isSupervisor: !user.isSupervisor,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('Failed to toggle supervisor status');
    }

    return updatedUser;
  }

  async updateUserSupervisor(userId: string, supervisorId: string | null): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        supervisorId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found or failed to update supervisor');
    }

    return updatedUser;
  }

  async getSupervisedUsersCount(supervisorId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.supervisorId, supervisorId));
    
    return result.count || 0;
  }

  async getPendingUsersForSupervisor(supervisorId: string): Promise<User[]> {
    const pendingUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.supervisorId, supervisorId),
          eq(users.approvalStatus, 'pending')
        )
      )
      .orderBy(desc(users.createdAt));
    
    return pendingUsers;
  }

  // System settings operations
  async getSystemSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting?.value || null;
  }

  async setSystemSetting(key: string, value: string, updatedBy?: string): Promise<void> {
    await db
      .insert(systemSettings)
      .values({
        key,
        value,
        updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value,
          updatedBy,
          updatedAt: new Date(),
        },
      });
  }

  // Facilitator operations
  async getFacilitatorByUserId(userId: string): Promise<Facilitator | undefined> {
    const [facilitator] = await db
      .select()
      .from(facilitators)
      .where(eq(facilitators.userId, userId));
    return facilitator;
  }

  async createFacilitator(facilitatorData: InsertFacilitator): Promise<Facilitator> {
    const [facilitator] = await db
      .insert(facilitators)
      .values(facilitatorData)
      .returning();
    return facilitator;
  }

  async updateFacilitator(facilitatorId: string, updates: Partial<InsertFacilitator>): Promise<Facilitator> {
    const [updated] = await db
      .update(facilitators)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(facilitators.id, facilitatorId))
      .returning();
    
    if (!updated) {
      throw new Error('Facilitator not found');
    }
    
    return updated;
  }

  async getAllFacilitators(): Promise<Facilitator[]> {
    return await db
      .select()
      .from(facilitators)
      .orderBy(facilitators.createdAt);
  }

  // Competency operations
  async getFacilitatorCompetencies(facilitatorId: string): Promise<FacilitatorCompetency[]> {
    return await db
      .select()
      .from(facilitatorCompetencies)
      .where(eq(facilitatorCompetencies.facilitatorId, facilitatorId))
      .orderBy(facilitatorCompetencies.competencyId);
  }

  async upsertCompetency(competency: InsertFacilitatorCompetency): Promise<FacilitatorCompetency> {
    const [result] = await db
      .insert(facilitatorCompetencies)
      .values(competency)
      .onConflictDoUpdate({
        target: [facilitatorCompetencies.facilitatorId, facilitatorCompetencies.competencyId],
        set: {
          status: competency.status,
          notes: competency.notes,
          statusSource: competency.statusSource || 'auto',
          lastUpdated: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateCompetencyStatus(competencyId: string, status: string, notes?: string, changedBy?: string, changedByUserId?: string, statusSource?: 'auto' | 'manual' | 'evidence' | 'conversation'): Promise<FacilitatorCompetency> {
    // First, fetch the current competency to get the old status
    const [current] = await db
      .select()
      .from(facilitatorCompetencies)
      .where(eq(facilitatorCompetencies.id, competencyId))
      .limit(1);
    
    if (!current) {
      throw new Error('Competency not found');
    }
    
    // Record change history if status changed AND we have changedBy info (indicating manual supervisor change)
    if (current.status !== status && changedBy) {
      await db.insert(competencyChangeHistory).values({
        competencyRecordId: competencyId,
        facilitatorId: current.facilitatorId,
        competencyId: current.competencyId,
        oldStatus: current.status as any,
        newStatus: status as any,
        notes: notes || '',
        changedBy,
        changedByUserId: changedByUserId || null,
      });
    }
    
    // Update the competency
    const updateData: any = { 
      status: status as any,
      notes,
      lastUpdated: new Date(),
    };
    
    // Only set statusSource if provided (for evidence-based and manual updates)
    if (statusSource) {
      updateData.statusSource = statusSource;
    }
    
    const [updated] = await db
      .update(facilitatorCompetencies)
      .set(updateData)
      .where(eq(facilitatorCompetencies.id, competencyId))
      .returning();
    
    if (!updated) {
      throw new Error('Competency not found');
    }
    
    return updated;
  }

  async getCompetencyChangeHistory(competencyRecordId: string): Promise<CompetencyChangeHistory[]> {
    const history = await db
      .select()
      .from(competencyChangeHistory)
      .where(eq(competencyChangeHistory.competencyRecordId, competencyRecordId))
      .orderBy(desc(competencyChangeHistory.changedAt));
    
    return history;
  }

  async recalculateCompetencies(facilitatorId: string): Promise<{ preventedDowngrades: string[] }> {
    // Import here to avoid circular dependencies
    const { calculateCompetencyScores, scoreToStatus, statusToMinScore } = await import('./competency-mapping');
    const { CORE_COMPETENCIES } = await import('@shared/schema');
    
    // Get all qualifications for this facilitator
    const qualifications = await this.getFacilitatorQualifications(facilitatorId);
    
    // Get all activities for this facilitator
    const activities = await this.getFacilitatorActivities(facilitatorId);
    
    // Calculate scores from both qualifications and activities
    const scores = calculateCompetencyScores(qualifications, activities);
    
    // Get existing competencies
    const existingCompetencies = await this.getFacilitatorCompetencies(facilitatorId);
    const competencyMap = new Map(
      existingCompetencies.map(c => [c.competencyId, c])
    );
    
    // Get all competency IDs from the schema
    const allCompetencyIds = Object.keys(CORE_COMPETENCIES);
    
    // Track prevented downgrades to inform the user
    const preventedDowngrades: string[] = [];
    
    // Process ALL competencies (not just those with scores)
    for (const competencyId of allCompetencyIds) {
      const totalScore = scores.total.get(competencyId) || 0;
      const educationScore = scores.education.get(competencyId) || 0;
      const experienceScore = scores.experience.get(competencyId) || 0;
      
      const suggestedStatus = scoreToStatus(totalScore);
      const existing = competencyMap.get(competencyId);
      
      const notes = `Auto-calculated: Education=${educationScore.toFixed(1)}, Experience=${experienceScore.toFixed(1)}, Total=${totalScore.toFixed(1)}`;
      
      if (existing) {
        // Check if competency is manually set, evidence-based, or conversation-based
        const isManual = existing.statusSource === 'manual';
        const isEvidence = existing.statusSource === 'evidence';
        const isConversation = existing.statusSource === 'conversation';
        
        if (isManual || isEvidence || isConversation) {
          // For manual, evidence-based, or conversation-based competencies, update only autoScore and suggestedStatus
          // Preserve the user-set, evidence-based, or AI-suggested status and notes
          await db
            .update(facilitatorCompetencies)
            .set({
              autoScore: Math.round(totalScore),
              suggestedStatus: suggestedStatus as any,
              lastUpdated: new Date(),
            })
            .where(eq(facilitatorCompetencies.id, existing.id));
        } else {
          // For auto competencies, only update if new score is >= existing score (never downgrade)
          const newAutoScore = Math.round(totalScore);
          
          // Get existing score - handle legacy competencies without autoScore by deriving from status
          const existingAutoScore = existing.autoScore ?? statusToMinScore(existing.status);
          
          if (newAutoScore >= existingAutoScore) {
            // Safe to update - score is improving or staying same
            await db
              .update(facilitatorCompetencies)
              .set({
                status: suggestedStatus as any,
                autoScore: newAutoScore,
                statusSource: 'auto',
                suggestedStatus: suggestedStatus as any,
                notes,
                lastUpdated: new Date(),
              })
              .where(eq(facilitatorCompetencies.id, existing.id));
          } else {
            // Don't downgrade - preserve ALL fields (status, autoScore, suggestedStatus)
            const competencyName = CORE_COMPETENCIES[competencyId]?.name || competencyId;
            console.log(`[Competency Protection] ⚠️ DOWNGRADE PREVENTED for ${competencyName}: ${existing.status} (score ${existingAutoScore}) would drop to ${suggestedStatus} (score ${newAutoScore})`);
            
            // Track this for user feedback
            preventedDowngrades.push(competencyName);
            
            // Keep existing status and autoScore, just update notes and timestamp
            await db
              .update(facilitatorCompetencies)
              .set({
                notes: `Auto-calculated would suggest ${suggestedStatus} (score ${newAutoScore}), but preserving ${existing.status} (score ${existingAutoScore}) to prevent downgrade. Education=${educationScore.toFixed(1)}, Experience=${experienceScore.toFixed(1)}`,
                lastUpdated: new Date(),
              })
              .where(eq(facilitatorCompetencies.id, existing.id));
          }
        }
      } else {
        // Create new competency in auto mode - but verify we're not recreating a deleted manual/evidence competency at a lower level
        // This protects against regressions when records are missing due to bugs or data issues
        const newAutoScore = Math.round(totalScore);
        
        // Double-check: re-fetch to ensure no race condition created a record
        const doubleCheck = await db
          .select()
          .from(facilitatorCompetencies)
          .where(
            sql`${facilitatorCompetencies.facilitatorId} = ${facilitatorId} AND ${facilitatorCompetencies.competencyId} = ${competencyId}`
          )
          .limit(1);
        
        if (doubleCheck.length > 0) {
          // A record appeared - treat it as existing and apply update logic
          const existing = doubleCheck[0];
          const existingAutoScore = existing.autoScore ?? statusToMinScore(existing.status);
          
          if (newAutoScore >= existingAutoScore && existing.statusSource !== 'manual' && existing.statusSource !== 'evidence' && existing.statusSource !== 'conversation') {
            await db
              .update(facilitatorCompetencies)
              .set({
                status: suggestedStatus as any,
                autoScore: newAutoScore,
                statusSource: 'auto',
                suggestedStatus: suggestedStatus as any,
                notes,
                lastUpdated: new Date(),
              })
              .where(eq(facilitatorCompetencies.id, existing.id));
          }
        } else {
          // Safe to create - no existing record found
          await db
            .insert(facilitatorCompetencies)
            .values({
              facilitatorId,
              competencyId,
              status: suggestedStatus as any,
              autoScore: newAutoScore,
              statusSource: 'auto',
              suggestedStatus: suggestedStatus as any,
              notes,
            });
        }
      }
    }
    
    return { preventedDowngrades };
  }

  async recalculateAllCompetencies(): Promise<{total: number, processed: number, errors: string[]}> {
    const facilitators = await this.getAllFacilitators();
    const total = facilitators.length;
    let processed = 0;
    const errors: string[] = [];

    console.log(`[Bulk Recalculation] Starting recalculation for ${total} facilitators`);

    for (const facilitator of facilitators) {
      try {
        await this.recalculateCompetencies(facilitator.id);
        processed++;
        if (processed % 10 === 0) {
          console.log(`[Bulk Recalculation] Progress: ${processed}/${total}`);
        }
      } catch (error: any) {
        const errorMsg = `Facilitator ${facilitator.fullName} (${facilitator.id}): ${error.message}`;
        console.error(`[Bulk Recalculation] Error: ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[Bulk Recalculation] Complete: ${processed}/${total} successful, ${errors.length} errors`);
    return { total, processed, errors };
  }

  // Qualification operations
  async getFacilitatorQualifications(facilitatorId: string): Promise<FacilitatorQualification[]> {
    return await db
      .select()
      .from(facilitatorQualifications)
      .where(eq(facilitatorQualifications.facilitatorId, facilitatorId))
      .orderBy(desc(facilitatorQualifications.completionDate));
  }

  async createQualification(qualification: InsertFacilitatorQualification): Promise<FacilitatorQualification> {
    const [created] = await db
      .insert(facilitatorQualifications)
      .values(qualification)
      .returning();
    return created;
  }

  async updateQualification(qualificationId: string, updates: Partial<Omit<InsertFacilitatorQualification, 'facilitatorId'>>): Promise<FacilitatorQualification> {
    const [updated] = await db
      .update(facilitatorQualifications)
      .set(updates)
      .where(eq(facilitatorQualifications.id, qualificationId))
      .returning();
    return updated;
  }

  async deleteQualification(qualificationId: string): Promise<void> {
    await db
      .delete(facilitatorQualifications)
      .where(eq(facilitatorQualifications.id, qualificationId));
  }

  // Qualification attachment operations
  async getQualificationAttachments(qualificationId: string): Promise<QualificationAttachment[]> {
    return await db
      .select()
      .from(qualificationAttachments)
      .where(eq(qualificationAttachments.qualificationId, qualificationId));
  }

  async createQualificationAttachment(attachment: InsertQualificationAttachment): Promise<QualificationAttachment> {
    const [created] = await db
      .insert(qualificationAttachments)
      .values(attachment)
      .returning();
    return created;
  }

  async deleteQualificationAttachment(attachmentId: string): Promise<void> {
    await db
      .delete(qualificationAttachments)
      .where(eq(qualificationAttachments.id, attachmentId));
  }

  async attachCertificateFromMessageAttachment(messageAttachmentId: string, qualificationId: string, facilitatorId: string): Promise<QualificationAttachment> {
    // Get the original message attachment with chat ownership info
    // Note: chats table has userId, not facilitatorId directly
    // We need to join through facilitators table to get the facilitator
    const [sourceAttachmentRow] = await db
      .select({
        attachment: messageAttachments,
        message: messages,
        chat: chats,
        facilitator: facilitators,
      })
      .from(messageAttachments)
      .innerJoin(messages, eq(messageAttachments.messageId, messages.id))
      .innerJoin(chats, eq(messages.chatId, chats.id))
      .innerJoin(facilitators, eq(chats.userId, facilitators.userId))
      .where(eq(messageAttachments.id, messageAttachmentId));
    
    if (!sourceAttachmentRow) {
      throw new Error("Message attachment not found");
    }
    
    const sourceAttachment = sourceAttachmentRow.attachment;
    // Get facilitatorId from the facilitator record (via chat.userId -> facilitators.userId)
    const attachmentOwnerFacilitatorId = sourceAttachmentRow.facilitator?.id;
    
    // #region agent log
    console.log(`[DEBUG-CERT] Attachment owner facilitatorId: ${attachmentOwnerFacilitatorId}`);
    console.log(`[DEBUG-CERT] Authenticated facilitatorId: ${facilitatorId}`);
    console.log(`[DEBUG-CERT] Chat ID: ${sourceAttachmentRow.chat.id}`);
    console.log(`[DEBUG-CERT] Chat userId: ${sourceAttachmentRow.chat.userId}`);
    console.log(`[DEBUG-CERT] Facilitator userId: ${sourceAttachmentRow.facilitator?.userId}`);
    // #endregion
    
    // Verify qualification exists and get its facilitator ID
    const [qualification] = await db
      .select()
      .from(facilitatorQualifications)
      .where(eq(facilitatorQualifications.id, qualificationId));
    
    if (!qualification) {
      throw new Error("Qualification not found");
    }
    
    // CRITICAL AUTHORIZATION: Verify both attachment and qualification belong to the authenticated facilitator
    if (attachmentOwnerFacilitatorId !== facilitatorId) {
      throw new Error("Unauthorized: Cannot attach files from other users' messages");
    }
    
    if (qualification.facilitatorId !== facilitatorId) {
      throw new Error("Unauthorized: Cannot modify other users' qualifications");
    }
    
    // Check if this attachment is already linked to this qualification (prevent duplicates)
    const existing = await db
      .select()
      .from(qualificationAttachments)
      .where(
        and(
          eq(qualificationAttachments.qualificationId, qualificationId),
          eq(qualificationAttachments.originalName, sourceAttachment.originalName)
        )
      );
    
    if (existing.length > 0) {
      return existing[0]; // Return existing attachment idempotently
    }
    
    // Copy file to certificates directory
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const sourceFilePath = sourceAttachment.storagePath;
    const fileExtension = path.extname(sourceAttachment.originalName);
    const newFilename = `cert_${Date.now()}${fileExtension}`;
    const certificatesDir = 'uploads/certificates';
    
    // Ensure certificates directory exists
    await fs.mkdir(certificatesDir, { recursive: true });
    
    const targetPath = path.join(certificatesDir, newFilename);
    
    try {
      // Copy the file
      await fs.copyFile(sourceFilePath, targetPath);
      
      // Create qualification attachment record
      const [newAttachment] = await db
        .insert(qualificationAttachments)
        .values({
          qualificationId,
          filename: newFilename,
          originalName: sourceAttachment.originalName,
          mimeType: sourceAttachment.mimeType,
          fileSize: sourceAttachment.fileSize,
          storagePath: targetPath,
        })
        .returning();
      
      return newAttachment;
    } catch (error) {
      console.error("Error copying certificate file:", error);
      throw new Error("Failed to copy certificate file");
    }
  }

  // Mentorship activity operations
  async getFacilitatorActivities(facilitatorId: string): Promise<MentorshipActivity[]> {
    return await db
      .select()
      .from(mentorshipActivities)
      .where(eq(mentorshipActivities.facilitatorId, facilitatorId))
      .orderBy(desc(mentorshipActivities.activityDate));
  }

  async createActivity(activity: InsertMentorshipActivity): Promise<MentorshipActivity> {
    const [created] = await db
      .insert(mentorshipActivities)
      .values(activity)
      .returning();
    
    // Update facilitator totals after creating activity
    if (created.facilitatorId) {
      await this.updateFacilitatorTotals(created.facilitatorId);
    }
    
    return created;
  }

  async updateActivity(activityId: string, updates: Partial<Omit<InsertMentorshipActivity, 'facilitatorId'>>): Promise<MentorshipActivity> {
    const [updated] = await db
      .update(mentorshipActivities)
      .set(updates)
      .where(eq(mentorshipActivities.id, activityId))
      .returning();
    return updated;
  }

  async deleteActivity(activityId: string): Promise<void> {
    await db
      .delete(mentorshipActivities)
      .where(eq(mentorshipActivities.id, activityId));
  }

  async updateFacilitatorTotals(facilitatorId: string): Promise<void> {
    // Get all activities for this facilitator
    const activities = await db
      .select()
      .from(mentorshipActivities)
      .where(eq(mentorshipActivities.facilitatorId, facilitatorId));
    
    // Count unique languages
    const uniqueLanguages = new Set(activities.map(a => a.languageName));
    const totalLanguages = uniqueLanguages.size;
    
    // Sum all chapters
    const totalChapters = activities.reduce((sum, a) => sum + (a.chaptersCount || 0), 0);
    
    // Update facilitator record
    await db
      .update(facilitators)
      .set({
        totalLanguagesMentored: totalLanguages,
        totalChaptersMentored: totalChapters,
        updatedAt: new Date(),
      })
      .where(eq(facilitators.id, facilitatorId));
  }

  // Quarterly report operations
  async getFacilitatorReports(facilitatorId: string): Promise<QuarterlyReport[]> {
    return await db
      .select()
      .from(quarterlyReports)
      .where(eq(quarterlyReports.facilitatorId, facilitatorId))
      .orderBy(desc(quarterlyReports.periodEnd));
  }

  async createQuarterlyReport(report: InsertQuarterlyReport): Promise<QuarterlyReport> {
    const [created] = await db
      .insert(quarterlyReports)
      .values(report)
      .returning();
    return created;
  }

  async getLatestReport(facilitatorId: string): Promise<QuarterlyReport | undefined> {
    const [report] = await db
      .select()
      .from(quarterlyReports)
      .where(eq(quarterlyReports.facilitatorId, facilitatorId))
      .orderBy(desc(quarterlyReports.periodEnd))
      .limit(1);
    return report;
  }

  async getQuarterlyReport(reportId: string): Promise<QuarterlyReport | undefined> {
    const [report] = await db
      .select()
      .from(quarterlyReports)
      .where(eq(quarterlyReports.id, reportId));
    return report;
  }

  async deleteQuarterlyReport(reportId: string): Promise<void> {
    await db
      .delete(quarterlyReports)
      .where(eq(quarterlyReports.id, reportId));
  }

  // Competency evidence operations
  async getFacilitatorEvidence(facilitatorId: string): Promise<CompetencyEvidence[]> {
    return await db
      .select()
      .from(competencyEvidence)
      .where(eq(competencyEvidence.facilitatorId, facilitatorId))
      .orderBy(desc(competencyEvidence.createdAt));
  }

  async getCompetencyEvidence(facilitatorId: string, competencyId: string): Promise<CompetencyEvidence[]> {
    return await db
      .select()
      .from(competencyEvidence)
      .where(
        and(
          eq(competencyEvidence.facilitatorId, facilitatorId),
          eq(competencyEvidence.competencyId, competencyId)
        )
      )
      .orderBy(desc(competencyEvidence.createdAt));
  }

  async createCompetencyEvidence(evidence: InsertCompetencyEvidence): Promise<CompetencyEvidence> {
    const [created] = await db
      .insert(competencyEvidence)
      .values(evidence)
      .returning();
    return created;
  }

  async getRecentEvidence(facilitatorId: string, limit: number): Promise<CompetencyEvidence[]> {
    return await db
      .select()
      .from(competencyEvidence)
      .where(eq(competencyEvidence.facilitatorId, facilitatorId))
      .orderBy(desc(competencyEvidence.createdAt))
      .limit(limit);
  }

  async markEvidenceApplied(evidenceIds: string[]): Promise<void> {
    if (evidenceIds.length === 0) return;
    
    await db
      .update(competencyEvidence)
      .set({ isAppliedToLevel: true })
      .where(inArray(competencyEvidence.id, evidenceIds));
  }

  // Document operations
  async getAllDocuments(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .orderBy(desc(documents.uploadedAt));
  }

  async getDocument(documentId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.documentId, documentId));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [created] = await db
      .insert(documents)
      .values(document)
      .returning();
    return created;
  }

  async updateDocumentActive(documentId: string, isActive: boolean): Promise<Document> {
    const [updated] = await db
      .update(documents)
      .set({ isActive })
      .where(eq(documents.documentId, documentId))
      .returning();
    return updated;
  }

  async updateDocumentMetadata(documentId: string, metadata: {
    competencyTags?: string[];
    topicTags?: string[];
    contentType?: "best_practices" | "methodology" | "training_material" | "case_study" | "general";
    description?: string;
  }): Promise<Document> {
    const [updated] = await db
      .update(documents)
      .set(metadata)
      .where(eq(documents.documentId, documentId))
      .returning();
    return updated;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await db
      .delete(documents)
      .where(eq(documents.documentId, documentId));
  }

  async getActiveDocuments(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.isActive, true))
      .orderBy(desc(documents.uploadedAt));
  }

  async getDocumentsByCompetency(competencyId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.isActive, true),
          sql`${documents.competencyTags} @> ARRAY[${competencyId}]::text[]`
        )
      )
      .orderBy(desc(documents.uploadedAt));
  }
}

export const storage = new DatabaseStorage();

import type { Express, Request, Response, NextFunction } from "express";
import type { SessionRequest, SessionCallback } from "./types/express";
import express from "express";
import { createServer, type Server } from "http";
import { config } from "./config";
import { storage } from "./storage";
import { generateChatTitle } from "./utils";
import { transcribeAudioWithGemini, generateSpeechWithAutoLanguage, generateSpeechStreamWithAutoLanguage, translateWithGemini } from "./gemini-audio";
import { storeMessageEmbedding, getContextForQuery, getComprehensiveContext, deleteChatEmbeddings } from "./vector-memory";
import { applyPendingEvidence } from "./langchain-agents";
import { insertChatSchema, insertMessageSchema, insertApiKeySchema, insertUserSchema, insertFeedbackSchema, CORE_COMPETENCIES, type User, type ApiKey, type Message, type MessageAttachment, type InsertFacilitatorQualification, type InsertMentorshipActivity, type QualificationAttachment } from "@shared/schema";
import bcrypt from "bcryptjs";
import { generateQuarterlyReport } from "./report-generator";
import { Packer } from 'docx';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import rateLimit from "express-rate-limit";
import { z } from "zod";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import {
  createChatChainSchema,
  updateChatChainSchema,
  setChatChainSchema,
  createMessageSchema,
  streamMessageSchema,
} from "./schemas/chat";
import {
  formatSupervisorList,
  maskApiKey,
  generateApiKey,
  streamTextWithChunks,
} from "./services/chat-service";

interface AuthenticatedRequest extends Request {
  userId: string;
  user: User;
}

type QualificationUpdate = Partial<Omit<InsertFacilitatorQualification, 'facilitatorId'>>;
type ActivityUpdate = Partial<Omit<InsertMentorshipActivity, 'facilitatorId'>>;

import { processMessageWithLangChain, generateReportNarrative } from "./langchain-agents";
import { parseDocument, parseDocumentBuffer, chunkText, storeDocumentChunks, updateDocumentChunksStatus, deleteDocumentChunks, searchDocumentChunks } from "./document-processor";
import { randomUUID } from "crypto";
import { registerDbSyncRoutes } from "./routes-db-sync";
import { uploadToGCS, deleteFromGCS } from "./gcs-storage";
import { getCachedAudio, setCachedAudio, getAudioETag } from "./utils/audio-cache";
async function extractCertificateText(storagePath: string, mimeType: string): Promise<string | null> {
  try {
    let fileType: string | null = null;
    if (mimeType === 'application/pdf') {
      fileType = 'pdf';
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'docx';
    }
    if (!fileType) {
      return null;
    }
    const text = await parseDocument(storagePath, fileType);
    return text.slice(0, 2000);
  } catch (error) {
    console.error('[Certificate Text Extraction] Error:', error);
    return null;
  }
}
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const fileUpload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm', 'video/webm'];
    const allowedDocTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedImageTypes.includes(file.mimetype) || allowedAudioTypes.includes(file.mimetype) || allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image, audio, and document files (PDF, DOCX) are allowed'));
    }
  }
});
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedDocTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
    }
  }
});
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, PNG, and DOCX files are allowed for certificates'));
    }
  }
});
const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and GIF images are allowed for profile pictures'));
    }
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = req.session as Express.Session & { userId?: string };
  if (!session?.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const user = await storage.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    const approvalStatus = user.approvalStatus ?? 'approved';
    const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
    if (effectiveApproval === 'pending') {
      console.warn(`[Auth] Blocking pending user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      res.status(403).json({ 
        message: "Your account is awaiting admin approval.",
        approvalStatus: "pending"
      });
      return;
    }
    if (effectiveApproval === 'rejected') {
      res.status(403).json({ 
        message: "Your account has been rejected. Please contact support.",
        approvalStatus: "rejected"
      });
      return;
    }
    if (effectiveApproval !== 'approved') {
      console.warn(`[Auth] Blocking unapproved user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      res.status(403).json({ 
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval
      });
      return;
    }
    (req as AuthenticatedRequest).userId = session.userId;
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Authentication check failed" });
  }
}
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = req.session as Express.Session & { userId?: string };
  if (!session?.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const user = await storage.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    const approvalStatus = user.approvalStatus ?? 'approved';
    const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
    if (effectiveApproval === 'pending') {
      console.warn(`[Admin] Blocking pending user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      res.status(403).json({ 
        message: "Your account is awaiting admin approval.",
        approvalStatus: "pending"
      });
      return;
    }
    if (effectiveApproval === 'rejected') {
      res.status(403).json({ 
        message: "Your account has been rejected. Please contact support.",
        approvalStatus: "rejected"
      });
      return;
    }
    if (effectiveApproval !== 'approved') {
      console.warn(`[Admin] Blocking unapproved user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      res.status(403).json({ 
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval
      });
      return;
    }
    if (!user.isAdmin) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }
    (req as AuthenticatedRequest).userId = user.id;
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    res.status(500).json({ message: "Authorization check failed" });
  }
}
async function requireSupervisor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = req.session as Express.Session & { userId?: string };
  if (!session?.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const user = await storage.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    const approvalStatus = user.approvalStatus ?? 'approved';
    const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
    if (effectiveApproval !== 'approved') {
      res.status(403).json({ 
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval
      });
      return;
    }
    if (!user.isAdmin && !user.isSupervisor) {
      res.status(403).json({ message: "Supervisor access required" });
      return;
    }
    (req as AuthenticatedRequest).userId = user.id;
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    console.error("Supervisor authorization error:", error);
    res.status(500).json({ message: "Authorization check failed" });
  }
}
function requireCSRFHeader(req: Request, res: Response, next: NextFunction): void {
  const customHeader = req.get('X-Requested-With');
  if (customHeader !== 'XMLHttpRequest') {
    res.status(403).json({ message: "Missing required security header" });
    return;
  }
  next();
}
const signupValidationSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  region: z.string().optional(),
  mentorSupervisor: z.string().optional(),
  supervisorId: z.string().uuid().optional(),
});
const loginValidationSchema = z.object({
  email: z.string().email().toLowerCase(), 
  password: z.string().min(1, "Password is required"),
});
const changePasswordValidationSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const aiApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many AI requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many password change attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/auth/signup', authLimiter, async (req: SessionRequest, res: Response) => {
    try {
      const userData = signupValidationSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const { region, mentorSupervisor, supervisorId, ...userDataOnly } = userData;
      const requireApproval = await storage.getSystemSetting('requireApproval');
      const approvalStatus = requireApproval === 'true' ? 'pending' : 'approved';
      const user = await storage.createUser({
        ...userDataOnly,
        password: hashedPassword,
        approvalStatus,
        supervisorId: supervisorId || null,
      });
      try {
        await storage.createFacilitator({
          userId: user.id,
          region: region || null,
          mentorSupervisor: mentorSupervisor || null,
        });
      } catch (facilitatorError) {
        console.error('Failed to create facilitator profile:', facilitatorError);
      }
      if (user.approvalStatus === 'pending') {
        return res.json({
          message: "Account created successfully. Awaiting admin approval.",
          approvalStatus: "pending"
        });
      }
      req.session.regenerate((err: Error | null) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        req.session.userId = user.id;
        req.session.save((saveErr: Error | null) => {
          if (saveErr) {
            console.error('Session save failed:', saveErr);
            return res.status(500).json({ message: "Failed to save session" });
          }
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin: user.isAdmin,
          });
        });
      });
    } catch (error: unknown) {
      console.error("Signup error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      if (error.code === '23505' || error.constraint?.includes('email')) {
        return res.status(400).json({ message: "User already exists" });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });
  app.post('/api/auth/login', authLimiter, async (req: SessionRequest, res: Response) => {
    try {
      const { email, password } = loginValidationSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const approvalStatus = user.approvalStatus ?? 'approved';
      const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
      if (effectiveApproval === 'pending') {
        console.warn(`[Login] Blocking pending user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
        return res.status(403).json({ 
          message: "Your account is awaiting admin approval. Please wait for approval before logging in.",
          approvalStatus: "pending"
        });
      }
      if (effectiveApproval === 'rejected') {
        return res.status(403).json({ 
          message: "Your account has been rejected. Please contact support for assistance.",
          approvalStatus: "rejected"
        });
      }
      if (effectiveApproval !== 'approved') {
        console.warn(`[Login] Blocking unapproved user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
        return res.status(403).json({ 
          message: "Account access denied. Please contact support.",
          approvalStatus: effectiveApproval
        });
      }
      req.session.regenerate((err: Error | null) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        req.session.userId = user.id;
        req.session.save(async (saveErr: Error | null) => {
          if (saveErr) {
            console.error('Session save failed:', saveErr);
            return res.status(500).json({ message: "Failed to save session" });
          }
          try {
            await storage.updateUserLastLogin(user.id);
          } catch (loginTrackErr) {
            console.error('Failed to track login:', loginTrackErr);
          }
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin: user.isAdmin,
          });
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  app.post('/api/auth/logout', (req: SessionRequest, res: Response) => {
    req.session.destroy((err: Error | null) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie(config.session.cookieName);
      res.json({ message: "Logged out successfully" });
    });
  });
  app.post('/api/auth/change-password', requireAuth, passwordChangeLimiter, async (req: SessionRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = changePasswordValidationSchema.parse(req.body);
      const user = await storage.getUserById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(req.userId, hashedPassword);
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  app.get('/api/auth/user', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`[Auth] User ${user.email} - isAdmin: ${user.isAdmin}, isSupervisor: ${user.isSupervisor}, userId: ${user.id}`);
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
        isSupervisor: user.isSupervisor,
        supervisorId: user.supervisorId,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });
  app.post('/api/user/profile-image', requireAuth, profileImageUpload.single('image'), async (req: SessionRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }
      const user = await storage.getUserById(req.userId);
      if (user?.profileImageUrl && user.profileImageUrl.includes('storage.googleapis.com')) {
        await deleteFromGCS(user.profileImageUrl);
      }
      const profileImageUrl = await uploadToGCS(
        file.buffer,
        file.originalname,
        'profile-images',
        file.mimetype
      );
      await storage.updateUserProfileImage(req.userId, profileImageUrl);
      res.json({ 
        message: "Profile image updated successfully",
        profileImageUrl
      });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ message: "Failed to upload profile image" });
    }
  });
  app.get('/api/supervisors', publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const supervisors = await storage.getAllSupervisors();
      res.json(formatSupervisorList(supervisors));
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      res.status(500).json({ message: "Failed to fetch supervisors" });
    }
  });
  app.get('/api/chat-chains', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const chains = await storage.getUserChatChains(userId);
      res.json(chains);
    } catch (error) {
      console.error("Error fetching chat chains:", error);
      res.status(500).json({ message: "Failed to fetch chat chains" });
    }
  });
  app.post('/api/chat-chains', requireAuth, requireCSRFHeader, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = createChatChainSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
        return;
      }
      const { title, summary } = parsed.data;
      const chain = await storage.createChatChain({
        userId: authReq.userId,
        title,
        summary: summary || null,
        activeChatId: null,
      });
      res.json(chain);
    } catch (error) {
      console.error("Error creating chat chain:", error);
      res.status(500).json({ message: "Failed to create chat chain" });
    }
  });
  app.get('/api/chat-chains/:chainId', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chainId } = req.params;
      const chain = await storage.getChatChain(chainId, userId);
      if (!chain) {
        return res.status(404).json({ message: "Chat chain not found" });
      }
      res.json(chain);
    } catch (error) {
      console.error("Error fetching chat chain:", error);
      res.status(500).json({ message: "Failed to fetch chat chain" });
    }
  });
  app.patch('/api/chat-chains/:chainId', requireAuth, requireCSRFHeader, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { chainId } = req.params;
      const parsed = updateChatChainSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
        return;
      }
      const existingChain = await storage.getChatChain(chainId, authReq.userId);
      if (!existingChain) {
        res.status(404).json({ message: "Chat chain not found" });
        return;
      }
      const { title, summary, activeChatId } = parsed.data;
      const updates: { title?: string; summary?: string; activeChatId?: string | null } = {};
      if (title !== undefined) updates.title = title;
      if (summary !== undefined) updates.summary = summary;
      if (activeChatId !== undefined) {
        if (activeChatId !== null) {
          const chat = await storage.getChat(activeChatId, authReq.userId);
          if (!chat) {
            res.status(403).json({ message: "Chat not found or unauthorized" });
            return;
          }
          if (chat.chainId !== chainId) {
            res.status(400).json({ message: "Chat is not part of this chain" });
            return;
          }
        }
        updates.activeChatId = activeChatId;
      }
      const chain = await storage.updateChatChain(chainId, updates, authReq.userId);
      res.json(chain);
    } catch (error) {
      console.error("Error updating chat chain:", error);
      res.status(500).json({ message: "Failed to update chat chain" });
    }
  });
  app.delete('/api/chat-chains/:chainId', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chainId } = req.params;
      const existingChain = await storage.getChatChain(chainId, userId);
      if (!existingChain) {
        return res.status(404).json({ message: "Chat chain not found" });
      }
      await storage.deleteChatChain(chainId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat chain:", error);
      res.status(500).json({ message: "Failed to delete chat chain" });
    }
  });
  app.get('/api/chat-chains/:chainId/chats', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chainId } = req.params;
      const chats = await storage.getChainChats(chainId, userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chain chats:", error);
      res.status(500).json({ message: "Failed to fetch chain chats" });
    }
  });
  app.post('/api/chats/:chatId/chain', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { chainId } = req.body;
      if (chainId) {
        const chat = await storage.addChatToChain(chatId, chainId, userId);
        res.json(chat);
      } else {
        const chat = await storage.removeChatFromChain(chatId, userId);
        res.json(chat);
      }
    } catch (error) {
      console.error("Error updating chat chain membership:", error);
      res.status(500).json({ message: "Failed to update chat chain membership" });
    }
  });
  app.get('/api/chats', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const chats = await storage.getUserChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });
  app.post('/api/chats', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const chatData = insertChatSchema.parse({ ...req.body, userId });
      const chat = await storage.createChat(chatData);
      await storage.incrementUserChatCount(userId);
      res.json(chat);
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(500).json({ message: "Failed to create chat" });
    }
  });
  app.get('/api/chats/:chatId', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      console.error("Error fetching chat:", error);
      res.status(500).json({ message: "Failed to fetch chat" });
    }
  });
  app.get('/api/chats/:chatId/messages', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const messages = await storage.getChatMessages(chatId, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  app.post('/api/messages/:messageId/attachments', requireAuth, fileUpload.single('file'), async (req: SessionRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      let fileType: 'image' | 'audio' | 'document';
      if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (file.mimetype.startsWith('audio/')) {
        fileType = 'audio';
      } else if (file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        fileType = 'document';
      } else {
        fileType = 'document';
      }
      let transcription: string | undefined;
      if (fileType === 'audio') {
        try {
          const audioBuffer = await fs.readFile(file.path);
          transcription = await transcribeAudioWithGemini(audioBuffer, file.originalname);
        } catch (error) {
          console.error('Error transcribing audio:', error);
        }
      }
      const attachment = await storage.createMessageAttachment({
        messageId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileType,
        storagePath: `uploads/${file.filename}`,
        transcription,
      });
      res.json(attachment);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
  app.get('/api/messages/:messageId/attachments', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const attachments = await storage.getMessageAttachments(messageId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });
  app.post('/api/chats/:chatId/messages', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { content } = req.body;
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const facilitatorId = facilitator?.id;
      const userMessage = await storage.createMessage({
        chatId,
        role: "user",
        content,
      });
      storeMessageEmbedding({
        messageId: userMessage.id,
        chatId,
        userId,
        facilitatorId,
        content,
        role: 'user',
        timestamp: new Date(),
      }).catch(err => console.error('Error storing user message embedding:', err));
      const existingMessages = await storage.getChatMessages(chatId, userId);
      if (existingMessages.length === 1) {
        const title = await generateChatTitle(content);
        await storage.updateChatTitle(chatId, title, userId);
      }
      if (facilitatorId) {
        console.log(`[Auto Evidence] Calling applyPendingEvidence for facilitator ${facilitatorId}`);
        await applyPendingEvidence(storage, facilitatorId).catch(err => {
          console.error('[Auto Evidence] Error applying pending evidence:', err);
          return { updatedCompetencies: [], totalEvidence: 0 };
        });
      } else {
        console.log('[Auto Evidence] No facilitatorId found, skipping evidence application');
      }
      const relevantContext = await getComprehensiveContext({
        query: content,
        chatId,
        facilitatorId,
        userId,
        includeGlobal: true,
      });
      let attachments = await storage.getMessageAttachments(userMessage.id);
      if (attachments.length === 0 && content.trim() === '') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attachments = await storage.getMessageAttachments(userMessage.id);
        if (attachments.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attachments = await storage.getMessageAttachments(userMessage.id);
        }
      } else if (attachments.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attachments = await storage.getMessageAttachments(userMessage.id);
      }
      const imageAttachments = attachments.filter(att => att.fileType === 'image');
      const imageFilePaths = imageAttachments.map(att => att.storagePath);
      let attachmentContext = "";
      if (attachments.length > 0) {
        const attachmentDetails = await Promise.all(attachments.map(async (att) => {
          let details = `- ${att.originalName} (ID: ${att.id}, Type: ${att.mimeType}, Size: ${(att.fileSize / 1024).toFixed(1)}KB)`;
          const extractedText = await extractCertificateText(att.storagePath, att.mimeType);
          if (extractedText) {
            details += `\n  Content Preview: ${extractedText}`;
          }
          return details;
        }));
        attachmentContext = "\n\n[ATTACHMENTS IN THIS MESSAGE]:\n" + attachmentDetails.join("\n") + "\n";
        console.log('[Attachment Context] Processed', attachments.length, 'attachments with text extraction');
      }
      const fullContext = relevantContext + attachmentContext;
      if (!facilitatorId) {
        return res.status(400).json({ 
          message: "Facilitator profile required. Please complete your profile first." 
        });
      }
      console.log('[LangChain] Processing message with multi-agent system');
      const chatHistory = await storage.getChatMessages(chatId, userId);
      const langchainResponse = await processMessageWithLangChain(
        storage,
        userId,
        facilitatorId,
        content,
        chatHistory,
        fullContext,
        imageFilePaths.length > 0 ? imageFilePaths : undefined,
        chatId
      );
      const aiResponse = {
        content: langchainResponse,
        threadId: null,
      };
      const assistantMessage = await storage.createMessage({
        chatId,
        role: "assistant",
        content: aiResponse.content,
      });
      storeMessageEmbedding({
        messageId: assistantMessage.id,
        chatId,
        userId,
        facilitatorId,
        content: aiResponse.content,
        role: 'assistant',
        timestamp: new Date(),
      }).catch(err => console.error('Error storing assistant message embedding:', err));
      await Promise.all([
        storage.incrementUserMessageCount(userId),
        storage.incrementUserApiUsage(userId)
      ]);
      res.json({ 
        userMessage, 
        assistantMessage
      });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });
  app.post('/api/chats/:chatId/messages/user-only', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { content = '' } = req.body;
      if (typeof content !== 'string') {
        return res.status(400).json({ message: "Content must be a string" });
      }
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const facilitatorId = facilitator?.id;
      const userMessage = await storage.createMessage({
        chatId,
        role: "user",
        content,
      });
      storeMessageEmbedding({
        messageId: userMessage.id,
        chatId,
        userId,
        facilitatorId,
        content,
        role: 'user',
        timestamp: new Date(),
      }).catch(err => console.error('Error storing user message embedding:', err));
      res.json(userMessage);
    } catch (error) {
      console.error("Error creating user message:", error);
      res.status(500).json({ message: "Failed to create user message" });
    }
  });
  app.post('/api/chats/:chatId/messages/stream', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { content, existingMessageId } = req.body;
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const facilitatorId = facilitator?.id;
      let userMessage;
      if (existingMessageId) {
        const existing = await storage.getMessage(existingMessageId);
        if (!existing || existing.chatId !== chatId) {
          return res.status(404).json({ message: "Message not found" });
        }
        userMessage = existing;
      } else {
        userMessage = await storage.createMessage({
          chatId,
          role: "user",
          content,
        });
        storeMessageEmbedding({
          messageId: userMessage.id,
          chatId,
          userId,
          facilitatorId,
          content,
          role: 'user',
          timestamp: new Date(),
        }).catch(err => console.error('Error storing user message embedding:', err));
      }
      if (!existingMessageId) {
        const existingMessages = await storage.getChatMessages(chatId, userId);
        if (existingMessages.length === 1) {
          const title = await generateChatTitle(content);
          await storage.updateChatTitle(chatId, title, userId);
        }
      }
      const attachments = await storage.getMessageAttachments(userMessage.id);
      const imageAttachments = attachments.filter(att => att.fileType === 'image');
      const imageFilePaths = imageAttachments.map(att => att.storagePath);
      if (imageFilePaths.length > 0) {
        console.log('[Image File Paths]', imageFilePaths);
      }
      let attachmentContext = "";
      if (attachments.length > 0) {
        const attachmentDetails = await Promise.all(attachments.map(async (att) => {
          let details = `- ${att.originalName} (ID: ${att.id}, Type: ${att.mimeType}, Size: ${(att.fileSize / 1024).toFixed(1)}KB)`;
          const extractedText = await extractCertificateText(att.storagePath, att.mimeType);
          if (extractedText) {
            details += `\n  Content Preview: ${extractedText}`;
          }
          return details;
        }));
        attachmentContext = "\n\n[ATTACHMENTS IN THIS MESSAGE]:\n" + attachmentDetails.join("\n") + "\n";
        console.log('[Attachment Context] Processed', attachments.length, 'attachments with text extraction');
      }
      if (facilitatorId) {
        console.log(`[Auto Evidence] Calling applyPendingEvidence for facilitator ${facilitatorId}`);
        await applyPendingEvidence(storage, facilitatorId).catch(err => {
          console.error('[Auto Evidence] Error applying pending evidence:', err);
          return { updatedCompetencies: [], totalEvidence: 0 };
        });
      } else {
        console.log('[Auto Evidence] No facilitatorId found, skipping evidence application');
      }
      const relevantContext = await getComprehensiveContext({
        query: content,
        chatId,
        facilitatorId,
        userId,
        includeGlobal: true,
      });
      const fullContext = relevantContext + attachmentContext;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ 
        type: 'user_message', 
        data: userMessage 
      })}\n\n`);
      try {
        if (!facilitatorId) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            data: { message: "Facilitator profile required. Please complete your profile first." }
          })}\n\n`);
          res.end();
          return;
        }
        console.log('[LangChain Streaming] Processing message with streaming-optimized LangChain agent');
        let assistantMessageId: string | null = null;
        let fullContent = "";
        const chatHistory = await storage.getChatMessages(chatId, userId);
        const assistantMessage = await storage.createMessage({
          chatId,
          role: "assistant",
          content: "",
        });
        assistantMessageId = assistantMessage.id;
        res.write(`data: ${JSON.stringify({ 
          type: 'assistant_message_start',
          data: assistantMessage
        })}\n\n`);
        const langchainResponse = await processMessageWithLangChain(
          storage,
          userId,
          facilitatorId,
          content,
          chatHistory,
          fullContext,
          imageFilePaths.length > 0 ? imageFilePaths : undefined,
          chatId
        );
        const chunkSize = 15;
        for (let i = 0; i < langchainResponse.length; i += chunkSize) {
          const chunk = langchainResponse.slice(i, i + chunkSize);
          fullContent += chunk;
          res.write(`data: ${JSON.stringify({ 
            type: 'content', 
            data: chunk 
          })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        await storage.updateMessage(assistantMessageId, { content: fullContent });
        storeMessageEmbedding({
          messageId: assistantMessageId,
          chatId,
          userId,
          facilitatorId,
          content: fullContent,
          role: 'assistant',
          timestamp: new Date(),
        }).catch(err => console.error('Error storing assistant message embedding:', err));
        await Promise.all([
          storage.incrementUserMessageCount(userId),
          storage.incrementUserApiUsage(userId)
        ]);
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          data: { content: fullContent, threadId: null }
        })}\n\n`);
      } catch (streamError) {
        console.error("Error in streaming response:", streamError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          data: { message: "Failed to generate streaming response" }
        })}\n\n`);
      }
      res.end();
    } catch (error) {
      console.error("Error in streaming endpoint:", error);
      res.status(500).json({ message: "Failed to create streaming message" });
    }
  });
  app.delete('/api/chats/:chatId', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      await storage.deleteChat(chatId, userId);
      await deleteChatEmbeddings(chatId);
      res.json({ message: "Chat deleted successfully" });
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });
  app.patch('/api/chats/:chatId', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const updateChatSchema = insertChatSchema.pick({ assistantId: true, title: true }).partial();
      const updates = updateChatSchema.parse(req.body);
      const existingChat = await storage.getChat(chatId, userId);
      if (!existingChat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      const updatedChat = await storage.updateChat(chatId, updates, userId);
      res.json(updatedChat);
    } catch (error) {
      console.error("Error updating chat:", error);
      res.status(500).json({ message: "Failed to update chat" });
    }
  });
  app.get('/api/api-keys', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const apiKeys = await storage.getUserApiKeys(userId);
      const safeApiKeys = apiKeys.map(key => ({
        ...key,
        keyHash: undefined,
        maskedKey: `ak_${key.prefix}...***`,
      }));
      res.json(safeApiKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });
  app.post('/api/api-keys', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { name } = insertApiKeySchema.parse({ ...req.body, userId });
      const key = `ak_${randomBytes(16).toString('hex')}`;
      const apiKey = await storage.createApiKey({
        userId,
        name,
        key,
        isActive: true,
      });
      res.json({
        ...apiKey,
        key,
        keyHash: undefined,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });
  app.delete('/api/api-keys/:keyId', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { keyId } = req.params;
      await storage.deleteApiKey(keyId, userId);
      res.json({ message: "API key deleted successfully" });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });
  app.get('/api/stats', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const userId = req.userId;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "API key required" });
      }
      const apiKey = authHeader.substring(7);
      if (apiKey.length < 8) {
        return res.status(401).json({ message: "Invalid API key format" });
      }
      const prefix = apiKey.substring(0, 8);
      const candidateKeys = await storage.getApiKeysByPrefix(prefix);
      if (candidateKeys.length === 0) {
        return res.status(401).json({ message: "Invalid API key" });
      }
      let matchedKey: ApiKey | null = null;
      for (const candidateKey of candidateKeys) {
        const isValid = await bcrypt.compare(apiKey, candidateKey.keyHash);
        if (isValid) {
          matchedKey = candidateKey;
          break;
        }
      }
      if (!matchedKey) {
        return res.status(401).json({ message: "Invalid API key" });
      }
      const keyOwner = await storage.getUserById(matchedKey.userId);
      if (!keyOwner) {
        return res.status(401).json({ message: "API key owner not found" });
      }
      const approvalStatus = keyOwner.approvalStatus ?? 'approved';
      const effectiveApproval = (approvalStatus === 'pending' && keyOwner.lastLoginAt) ? 'approved' : approvalStatus;
      if (effectiveApproval === 'pending') {
        console.warn(`[API] Blocking pending user: approval=${keyOwner.approvalStatus} lastLoginAt=${keyOwner.lastLoginAt} email=${keyOwner.email}`);
        return res.status(403).json({ 
          message: "API access denied. Your account is awaiting admin approval.",
          approvalStatus: "pending"
        });
      }
      if (effectiveApproval === 'rejected') {
        return res.status(403).json({ 
          message: "API access denied. Your account has been rejected.",
          approvalStatus: "rejected"
        });
      }
      if (effectiveApproval !== 'approved') {
        console.warn(`[API] Blocking unapproved user: approval=${keyOwner.approvalStatus} lastLoginAt=${keyOwner.lastLoginAt} email=${keyOwner.email}`);
        return res.status(403).json({ 
          message: "API access denied. Please contact support.",
          approvalStatus: effectiveApproval
        });
      }
      await storage.updateApiKeyLastUsed(matchedKey.id);
      req.apiKey = matchedKey;
      req.userId = keyOwner.id;
      req.user = keyOwner;
      next();
    } catch (error) {
      console.error("Error authenticating API key:", error);
      res.status(401).json({ message: "Invalid API key" });
    }
  };
  app.post('/api/v1/chat/completions', authenticateApiKey, async (req: SessionRequest, res: Response) => {
    try {
      const { messages, temperature, max_tokens } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Messages array is required" });
      }
      const tempChatId = `api_${randomBytes(8).toString('hex')}`;
      const lastUserMessage = messages[messages.length - 1];
      if (!lastUserMessage || lastUserMessage.role !== 'user') {
        return res.status(400).json({ message: "Last message must be from user" });
      }
      const response = await generateChatCompletion({
        chatId: tempChatId,
        messages: messages,
        assistantId: 'obtMentor',
      }, 'api-user');
      await storage.recordApiUsage({
        apiKeyId: req.apiKey.id,
        tokens: response.tokens,
      });
      res.json({
        id: `chatcmpl-${randomBytes(8).toString('hex')}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gpt-5",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: response.content,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          total_tokens: response.tokens,
        },
      });
    } catch (error) {
      console.error("Error in API chat completion:", error);
      res.status(500).json({ message: "Failed to generate completion" });
    }
  });
  app.post('/api/audio/transcribe', requireAuth, upload.single('audio'), async (req: SessionRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      const transcription = await transcribeAudioWithGemini(req.file.buffer, req.file.originalname);
      await storage.incrementUserApiUsage(req.userId);
      res.json({ text: transcription });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });
  app.post('/api/audio/speak', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }
      if (text.length > 4096) {
        return res.status(400).json({ message: "Text too long (max 4096 characters)" });
      }
      const etag = getAudioETag(text, 'auto', 'auto');
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      let cached = getCachedAudio(text, 'auto', 'auto');
      if (cached) {
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
        });
        return res.send(cached.buffer);
      }
      await storage.incrementUserApiUsage(req.userId);
      let webStream: ReadableStream;
      try {
        webStream = await generateSpeechStreamWithAutoLanguage(text);
      } catch (streamError) {
        console.error("Error getting speech stream:", streamError);
        return res.status(502).json({ message: "Failed to get audio from service" });
      }
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Transfer-Encoding': 'chunked',
      });
      const chunks: Buffer[] = [];
      const reader = webStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
          chunks.push(Buffer.from(value));
        }
        const completeBuffer = Buffer.concat(chunks);
        setCachedAudio(text, 'auto', completeBuffer, 'auto');
      } catch (streamError) {
        console.error("Error streaming audio chunks:", streamError);
      } finally {
        res.end();
      }
    } catch (error) {
      console.error("Error generating speech:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate speech" });
      }
    }
  });
  app.post('/api/public/translate', aiApiLimiter, async (req: SessionRequest, res: Response) => {
    try {
      const { text, fromLanguage = 'auto', toLanguage = 'en-US', context = '' } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }
      if (text.length > 2048) {
        return res.status(400).json({ error: "Text too long (max 2048 characters)" });
      }
      const response = await translateWithGemini(text, fromLanguage, toLanguage, context);
      res.json({
        translatedText: response,
        fromLanguage,
        toLanguage,
        originalText: text
      });
    } catch (error) {
      console.error("Error in public translation:", error);
      res.status(500).json({ error: "Translation failed" });
    }
  });
  app.post('/api/public/transcribe', aiApiLimiter, upload.single('audio'), async (req: SessionRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
      }
      const filename = req.file.originalname || 'audio.webm';
      const transcribedText = await transcribeAudioWithGemini(req.file.buffer, filename);
      res.json({
        text: transcribedText,
        language: req.body.language || 'auto'
      });
    } catch (error) {
      console.error("Error in public transcription:", error);
      res.status(500).json({ error: "Transcription failed" });
    }
  });
  app.post('/api/public/speak', aiApiLimiter, async (req: SessionRequest, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }
      if (text.length > 1024) {
        return res.status(400).json({ error: "Text too long (max 1024 characters for public API)" });
      }
      let cached = getCachedAudio(text, 'auto', 'auto');
      let audioBuffer: Buffer;
      let detectedLanguage: string;
      let detectedVoice: string;
      if (cached) {
        audioBuffer = cached.buffer;
        detectedLanguage = 'cached';
        detectedVoice = 'cached';
      } else {
        const result = await generateSpeechWithAutoLanguage(text);
        audioBuffer = result.buffer;
        detectedLanguage = result.language;
        detectedVoice = result.voice;
        cached = setCachedAudio(text, 'auto', audioBuffer, 'auto');
      }
      const etag = getAudioETag(text, 'auto', 'auto');
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      });
      res.send(audioBuffer);
    } catch (error) {
      console.error("Error in public speech generation:", error);
      res.status(500).json({ error: "Speech generation failed" });
    }
  });
  app.get('/api/public/info', publicApiLimiter, (req: SessionRequest, res: Response) => {
    res.json({
      name: "OBT Mentor Companion Public API",
      version: "1.0.0",
      endpoints: {
        translate: {
          method: "POST",
          path: "/api/public/translate",
          description: "Translate text between languages",
          parameters: {
            text: "string (required, max 2048 chars)",
            fromLanguage: "string (optional, default: 'auto')",
            toLanguage: "string (optional, default: 'en-US')",
            context: "string (optional)"
          }
        },
        transcribe: {
          method: "POST",
          path: "/api/public/transcribe",
          description: "Convert speech to text",
          parameters: {
            audio: "file (required, audio format)",
            language: "string (optional, default: 'auto')"
          }
        },
        speak: {
          method: "POST",
          path: "/api/public/speak",
          description: "Convert text to speech",
          parameters: {
            text: "string (required, max 1024 chars)",
            language: "string (optional, default: 'en-US')",
            voice: "string (optional, default: 'alloy')"
          }
        }
      },
      voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
      rateLimit: {
        window: "15 minutes",
        maxRequests: 50
      }
    });
  });
  app.post('/api/feedback', publicApiLimiter, async (req: SessionRequest, res: Response) => {
    try {
      const feedbackSchema = insertFeedbackSchema.extend({
        message: z.string().min(1, "Feedback message is required").max(5000, "Message too long"),
        userEmail: z.string().email().optional().or(z.literal("")),
        userName: z.string().optional().or(z.literal("")),
        category: z.enum(["bug", "feature", "general", "other"]).optional(),
      });
      const feedbackData = feedbackSchema.parse(req.body);
      const userId = req.session?.userId || null;
      const feedback = await storage.createFeedback({
        ...feedbackData,
        userId,
        userEmail: feedbackData.userEmail || undefined,
        userName: feedbackData.userName || undefined,
        status: 'new',
      });
      res.json({
        id: feedback.id,
        message: "Feedback submitted successfully",
        createdAt: feedback.createdAt,
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid feedback data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });
  app.get('/api/admin/feedback', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const feedback = await storage.getAllFeedback();
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });
  app.get('/api/admin/feedback/unread-count', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const unreadCount = await storage.getUnreadFeedbackCount();
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Error fetching unread feedback count:", error);
      res.status(500).json({ message: "Failed to fetch unread feedback count" });
    }
  });
  app.get('/api/admin/feedback/:id', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const feedback = await storage.getFeedback(id);
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });
  app.patch('/api/admin/feedback/:id', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const statusSchema = z.enum(["new", "read", "resolved"]);
      const validatedStatus = statusSchema.parse(status);
      const updatedFeedback = await storage.updateFeedbackStatus(id, validatedStatus);
      if (!updatedFeedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      res.json(updatedFeedback);
    } catch (error) {
      console.error("Error updating feedback:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update feedback" });
    }
  });
  app.delete('/api/admin/feedback/:id', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFeedback(id);
      if (!deleted) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      res.json({ message: "Feedback deleted successfully" });
    } catch (error) {
      console.error("Error deleting feedback:", error);
      res.status(500).json({ message: "Failed to delete feedback" });
    }
  });
  app.get('/api/admin/users', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const users = await storage.getAllUsersWithStats();
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isSupervisor: user.isSupervisor,
        supervisorId: user.supervisorId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        approvalStatus: user.approvalStatus,
        approvedAt: user.approvedAt,
        approvedBy: user.approvedBy,
        stats: user.stats
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app.patch('/api/admin/users/:userId/admin', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      if (validatedUserId === req.userId) {
        return res.status(400).json({ message: "Cannot modify your own admin status" });
      }
      const updatedUser = await storage.toggleUserAdminStatus(validatedUserId);
      const sanitizedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isAdmin: updatedUser.isAdmin,
        updatedAt: updatedUser.updatedAt
      };
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error toggling user admin status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to update user admin status" });
    }
  });
  app.patch('/api/admin/users/:userId/supervisor', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      const updatedUser = await storage.toggleUserSupervisorStatus(validatedUserId);
      const sanitizedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isSupervisor: updatedUser.isSupervisor,
        updatedAt: updatedUser.updatedAt
      };
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error toggling user supervisor status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to update user supervisor status" });
    }
  });
  app.patch('/api/admin/users/:userId/assign-supervisor', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { supervisorId } = req.body;
      const userIdSchema = z.string().uuid();
      const supervisorIdSchema = z.string().uuid().nullable();
      const validatedUserId = userIdSchema.parse(userId);
      const validatedSupervisorId = supervisorIdSchema.parse(supervisorId);
      const updatedUser = await storage.updateUserSupervisor(validatedUserId, validatedSupervisorId);
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        supervisorId: updatedUser.supervisorId,
        updatedAt: updatedUser.updatedAt
      });
    } catch (error) {
      console.error("Error assigning supervisor:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input format", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to assign supervisor" });
    }
  });
  app.get('/api/admin/supervisors', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const supervisors = await storage.getAllSupervisors();
      res.json(supervisors);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      res.status(500).json({ message: "Failed to fetch supervisors" });
    }
  });
  app.delete('/api/admin/users/:userId', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      if (validatedUserId === req.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      const deleted = await storage.deleteUser(validatedUserId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app.post('/api/admin/users/:userId/reset-password', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      const tempPassword = randomBytes(12).toString('base64').replace(/[+/]/g, 'A').substring(0, 12);
      const updatedUser = await storage.resetUserPassword(validatedUserId, tempPassword);
      const sanitizedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        updatedAt: updatedUser.updatedAt,
        temporaryPassword: tempPassword
      };
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error resetting user password:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      if (error instanceof Error && error.message === 'User not found or failed to reset password') {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to reset user password" });
    }
  });
  app.get('/api/admin/users/pending', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const pendingUsers = await storage.getPendingUsers();
      const sanitizedUsers = pendingUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        approvalStatus: user.approvalStatus
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      res.status(500).json({ message: "Failed to fetch pending users" });
    }
  });
  app.get('/api/admin/users/pending-count', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const pendingCount = await storage.getPendingUsersCount();
      res.json({ count: pendingCount });
    } catch (error) {
      console.error("Error fetching pending users count:", error);
      res.status(500).json({ message: "Failed to fetch pending users count" });
    }
  });
  app.post('/api/admin/users/:userId/approve', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      const approvedUser = await storage.approveUser(validatedUserId, req.userId);
      const sanitizedUser = {
        id: approvedUser.id,
        email: approvedUser.email,
        firstName: approvedUser.firstName,
        lastName: approvedUser.lastName,
        approvalStatus: approvedUser.approvalStatus,
        approvedAt: approvedUser.approvedAt,
        approvedBy: approvedUser.approvedBy,
        updatedAt: approvedUser.updatedAt
      };
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error approving user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      if (error instanceof Error && error.message === 'User not found or failed to approve user') {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to approve user" });
    }
  });
  app.post('/api/admin/users/:userId/reject', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      const rejectedUser = await storage.rejectUser(validatedUserId, req.userId);
      const sanitizedUser = {
        id: rejectedUser.id,
        email: rejectedUser.email,
        firstName: rejectedUser.firstName,
        lastName: rejectedUser.lastName,
        approvalStatus: rejectedUser.approvalStatus,
        approvedAt: rejectedUser.approvedAt,
        approvedBy: rejectedUser.approvedBy,
        updatedAt: rejectedUser.updatedAt
      };
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error rejecting user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      if (error instanceof Error && error.message === 'User not found or failed to reject user') {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to reject user" });
    }
  });
  app.get('/api/admin/settings/require-approval', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const requireApproval = await storage.getSystemSetting('requireApproval');
      res.json({ requireApproval: requireApproval === 'true' });
    } catch (error) {
      console.error("Error fetching approval setting:", error);
      res.status(500).json({ message: "Failed to fetch approval setting" });
    }
  });
  app.post('/api/admin/settings/require-approval', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { requireApproval } = req.body;
      if (typeof requireApproval !== 'boolean') {
        return res.status(400).json({ message: "requireApproval must be a boolean" });
      }
      await storage.setSystemSetting('requireApproval', requireApproval.toString(), req.userId);
      res.json({ requireApproval });
    } catch (error) {
      console.error("Error updating approval setting:", error);
      res.status(500).json({ message: "Failed to update approval setting" });
    }
  });
  app.post('/api/admin/backfill-course-levels', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      console.log('[Admin] Starting course_level backfill...');
      const result = await db
        .update(facilitatorQualifications)
        .set({ courseLevel: 'certificate' })
        .where(sql`${facilitatorQualifications.courseLevel} IS NULL`)
        .returning({ id: facilitatorQualifications.id });
      console.log(`[Admin] Backfilled ${result.length} qualification records`);
      res.json({ 
        success: true, 
        updatedCount: result.length,
        message: `Successfully backfilled ${result.length} qualification records with course_level='certificate'`
      });
    } catch (error) {
      console.error("Error during course_level backfill:", error);
      res.status(500).json({ message: "Failed to backfill course_level values" });
    }
  });
  app.post('/api/admin/users/:userId/generate-report', requireSupervisor, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { periodStart, periodEnd } = req.body;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only generate reports for users you supervise" });
        }
      }
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "Period start and end dates are required" });
      }
      const facilitator = await storage.getFacilitatorByUserId(validatedUserId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found for this user" });
      }
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const periodActivities = activities.filter(activity => {
        if (!activity.activityDate) return false;
        const activityDate = new Date(activity.activityDate);
        return activityDate >= startDate && activityDate <= endDate;
      });
      const reportData = {
        facilitator: {
          region: facilitator.region,
          mentorSupervisor: facilitator.mentorSupervisor,
          totalLanguagesMentored: facilitator.totalLanguagesMentored,
          totalChaptersMentored: facilitator.totalChaptersMentored
        },
        period: {
          start: periodStart,
          end: periodEnd
        },
        competencies: competencies.map(c => ({
          competencyId: c.competencyId,
          status: c.status,
          notes: c.notes,
          lastUpdated: c.lastUpdated
        })),
        qualifications: qualifications.map(q => ({
          courseTitle: q.courseTitle,
          institution: q.institution,
          completionDate: q.completionDate,
          credential: q.credential,
          description: q.description
        })),
        activities: periodActivities.map(a => ({
          language: a.languageName,
          chaptersMentored: a.chaptersCount,
          activityDate: a.activityDate,
          notes: a.notes
        })),
        summary: {
          totalCompetenciesProficient: competencies.filter(c => c.status === 'proficient' || c.status === 'advanced').length,
          totalQualifications: qualifications.length,
          periodLanguages: new Set(periodActivities.map(a => a.languageName)).size,
          periodChapters: periodActivities.reduce((sum, a) => sum + (a.chaptersCount || 0), 0)
        }
      };
      const report = await storage.createQuarterlyReport({
        facilitatorId: facilitator.id,
        periodStart: startDate,
        periodEnd: endDate,
        reportData
      });
      res.json(report);
    } catch (error) {
      console.error("Error generating report for user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user ID format", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate report" });
    }
  });
  app.get('/api/admin/users/:userId/profile', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only view portfolios of users you supervise" });
        }
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.json({ region: null, mentorSupervisor: null, totalLanguagesMentored: 0, totalChaptersMentored: 0 });
      }
      res.json(facilitator);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });
  app.get('/api/admin/users/:userId/competencies', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only view competencies of users you supervise" });
        }
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.json([]);
      }
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      res.json(competencies);
    } catch (error) {
      console.error("Error fetching user competencies:", error);
      res.status(500).json({ message: "Failed to fetch user competencies" });
    }
  });
  app.post('/api/admin/users/:userId/competencies', requireSupervisor, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const updateCompetencySchema = z.object({
        competencyId: z.enum(Object.keys(CORE_COMPETENCIES) as [string, ...string[]]),
        status: z.enum(["not_started", "emerging", "growing", "proficient", "advanced"]),
        notes: z.string().optional(),
      });
      const { competencyId, status, notes } = updateCompetencySchema.parse(req.body);
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found for this user" });
      }
      const competency = await storage.upsertCompetency({
        facilitatorId: facilitator.id,
        competencyId,
        status,
        notes,
        statusSource: 'manual',
      });
      const changedBy = req.user.firstName && req.user.lastName 
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email;
      const updated = await storage.updateCompetencyStatus(
        competency.id, 
        status, 
        notes, 
        changedBy,
        req.userId
      );
      res.json(updated);
    } catch (error) {
      console.error("Error updating user competency:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid competency data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user competency" });
    }
  });
  app.get('/api/admin/users/:userId/competencies/:competencyRecordId/history', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId, competencyRecordId } = req.params;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only view history of users you supervise" });
        }
      }
      const history = await storage.getCompetencyChangeHistory(competencyRecordId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching competency change history:", error);
      res.status(500).json({ message: "Failed to fetch change history" });
    }
  });
  app.get('/api/admin/users/:userId/qualifications', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only view qualifications of users you supervise" });
        }
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.json([]);
      }
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      res.json(qualifications);
    } catch (error) {
      console.error("Error fetching user qualifications:", error);
      res.status(500).json({ message: "Failed to fetch user qualifications" });
    }
  });
  app.get('/api/admin/users/:userId/activities', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only view activities of users you supervise" });
        }
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.json([]);
      }
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching user activities:", error);
      res.status(500).json({ message: "Failed to fetch user activities" });
    }
  });
  app.get('/api/admin/users/:userId/reports', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only view reports of users you supervise" });
        }
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.json([]);
      }
      const reports = await storage.getFacilitatorReports(facilitator.id);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching user reports:", error);
      res.status(500).json({ message: "Failed to fetch user reports" });
    }
  });
  app.post('/api/admin/documents/upload', requireAdmin, requireCSRFHeader, documentUpload.single('document'), async (req: SessionRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No document file provided" });
      }
      const file = req.file;
      const documentId = randomUUID();
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType: 'pdf' | 'docx' | 'txt';
      if (ext === '.pdf') fileType = 'pdf';
      else if (ext === '.docx') fileType = 'docx';
      else if (ext === '.txt') fileType = 'txt';
      else return res.status(400).json({ message: "Unsupported file type" });
      const text = await parseDocumentBuffer(file.buffer, fileType);
      const chunks = chunkText(text);
      const chunkCount = await storeDocumentChunks({
        documentId,
        filename: file.originalname,
        chunks,
        isActive: true,
      });
      const document = await storage.createDocument({
        documentId,
        filename: file.originalname,
        uploadedBy: req.userId,
        fileType,
        chunkCount,
        isActive: true,
      });
      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });
  app.get('/api/admin/documents', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });
  app.patch('/api/admin/documents/:documentId/toggle', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { documentId } = req.params;
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const newActiveStatus = !document.isActive;
      await updateDocumentChunksStatus(documentId, newActiveStatus);
      const updated = await storage.updateDocumentActive(documentId, newActiveStatus);
      res.json(updated);
    } catch (error) {
      console.error("Error toggling document status:", error);
      res.status(500).json({ message: "Failed to toggle document status" });
    }
  });
  app.delete('/api/admin/documents/:documentId', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { documentId } = req.params;
      await deleteDocumentChunks(documentId);
      await storage.deleteDocument(documentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });
  app.post('/api/admin/recalculate-all-competencies', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      console.log('[Admin] Starting bulk competency recalculation');
      const result = await storage.recalculateAllCompetencies();
      res.json({
        success: true,
        total: result.total,
        processed: result.processed,
        failed: result.errors.length,
        errors: result.errors,
        message: `Recalculated competencies for ${result.processed}/${result.total} facilitators. ${result.errors.length} errors.`
      });
    } catch (error) {
      console.error("Error during bulk recalculation:", error);
      res.status(500).json({ message: "Failed to recalculate competencies" });
    }
  });
  app.get('/api/admin/system-prompt', requireAdmin, async (req: SessionRequest, res: Response) => {
    try {
      const promptPath = path.join(process.cwd(), 'server', 'system-prompt.txt');
      if (fsSync.existsSync(promptPath)) {
        const customPrompt = await fs.readFile(promptPath, 'utf-8');
        res.json({ prompt: customPrompt, isCustom: true });
      } else {
        const { OBT_MENTOR_INSTRUCTIONS } = await import('./langchain-agents');
        res.json({ prompt: OBT_MENTOR_INSTRUCTIONS, isCustom: false });
      }
    } catch (error) {
      console.error("Error getting system prompt:", error);
      res.status(500).json({ message: "Failed to get system prompt" });
    }
  });
  app.post('/api/admin/system-prompt', requireAdmin, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }
      const promptPath = path.join(process.cwd(), 'server', 'system-prompt.txt');
      await fs.writeFile(promptPath, prompt, 'utf-8');
      res.json({ success: true, message: "System prompt updated successfully" });
    } catch (error) {
      console.error("Error saving system prompt:", error);
      res.status(500).json({ message: "Failed to save system prompt" });
    }
  });
  app.get('/api/supervisor/supervised-users', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const supervisedUsers = await storage.getSupervisedUsers(req.userId);
      res.json(supervisedUsers);
    } catch (error) {
      console.error("Error fetching supervised users:", error);
      res.status(500).json({ message: "Failed to fetch supervised users" });
    }
  });
  app.get('/api/supervisor/pending-users', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const pendingUsers = await storage.getPendingUsersForSupervisor(req.userId);
      res.json(pendingUsers);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      res.status(500).json({ message: "Failed to fetch pending users" });
    }
  });
  app.get('/api/supervisor/pending-users/count', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const pendingUsers = await storage.getPendingUsersForSupervisor(req.userId);
      res.json({ count: pendingUsers.length });
    } catch (error) {
      console.error("Error fetching pending users count:", error);
      res.status(500).json({ message: "Failed to fetch pending users count" });
    }
  });
  app.patch('/api/supervisor/users/:userId/approve', requireSupervisor, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userToApprove = await storage.getUserById(userId);
      if (!userToApprove) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!req.user.isAdmin && userToApprove.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only approve users you supervise" });
      }
      const approvedUser = await storage.approveUser(userId, req.userId);
      res.json(approvedUser);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: "Failed to approve user" });
    }
  });
  app.patch('/api/supervisor/users/:userId/reject', requireSupervisor, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const userToReject = await storage.getUserById(userId);
      if (!userToReject) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!req.user.isAdmin && userToReject.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only reject users you supervise" });
      }
      const rejectedUser = await storage.rejectUser(userId, req.userId);
      res.json(rejectedUser);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ message: "Failed to reject user" });
    }
  });
  app.get('/api/supervisor/users/:userId/facilitator', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const supervisedUser = await storage.getUserById(userId);
      if (!supervisedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!req.user.isAdmin && supervisedUser.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only view users you supervise" });
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      res.json({
        facilitator,
        competencies,
        qualifications,
        activities,
      });
    } catch (error) {
      console.error("Error fetching facilitator profile:", error);
      res.status(500).json({ message: "Failed to fetch facilitator profile" });
    }
  });
  app.patch('/api/supervisor/users/:userId/competencies/:competencyId', requireSupervisor, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { userId, competencyId } = req.params;
      const { status, notes } = req.body;
      const supervisedUser = await storage.getUserById(userId);
      if (!supervisedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!req.user.isAdmin && supervisedUser.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only update users you supervise" });
      }
      const updatedCompetency = await storage.updateCompetencyStatus(competencyId, status, notes);
      res.json(updatedCompetency);
    } catch (error) {
      console.error("Error updating competency:", error);
      res.status(500).json({ message: "Failed to update competency" });
    }
  });
  app.get('/api/supervisor/users/:userId/reports/:reportId', requireSupervisor, async (req: SessionRequest, res: Response) => {
    try {
      const { userId, reportId } = req.params;
      const supervisedUser = await storage.getUserById(userId);
      if (!supervisedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!req.user.isAdmin && supervisedUser.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only view reports of users you supervise" });
      }
      const report = await storage.getQuarterlyReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator || report.facilitatorId !== facilitator.id) {
        return res.status(403).json({ message: "Report access denied" });
      }
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });
  app.get('/api/facilitator/profile', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      const user = await storage.getUserById(req.userId);
      if (!facilitator) {
        const newFacilitator = await storage.createFacilitator({
          userId: req.userId,
        });
        return res.json({
          ...newFacilitator,
          supervisorId: user?.supervisorId || null,
        });
      }
      res.json({
        ...facilitator,
        supervisorId: user?.supervisorId || null,
      });
    } catch (error) {
      console.error("Error fetching facilitator profile:", error);
      res.status(500).json({ message: "Failed to fetch facilitator profile" });
    }
  });
  app.post('/api/facilitator/profile', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { region, supervisorId } = req.body;
      if (supervisorId !== undefined) {
        await storage.updateUserSupervisor(req.userId, supervisorId || null);
      }
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (facilitator) {
        const updated = await storage.updateFacilitator(facilitator.id, {
          region,
        });
        return res.json({
          ...updated,
          supervisorId: supervisorId || null,
        });
      } else {
        const created = await storage.createFacilitator({
          userId: req.userId,
          region,
        });
        return res.json({
          ...created,
          supervisorId: supervisorId || null,
        });
      }
    } catch (error) {
      console.error("Error updating facilitator profile:", error);
      res.status(500).json({ message: "Failed to update facilitator profile" });
    }
  });
  app.get('/api/facilitator/competencies', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.json([]);
      }
      const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
      if (preventedDowngrades.length > 0) {
        console.log(`[Competencies GET] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
      }
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      res.json(competencies);
    } catch (error) {
      console.error("Error fetching competencies:", error);
      res.status(500).json({ message: "Failed to fetch competencies" });
    }
  });
  app.post('/api/facilitator/competencies', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { competencyId, status, notes } = req.body;
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const competency = await storage.upsertCompetency({
        facilitatorId: facilitator.id,
        competencyId,
        status,
        notes,
        statusSource: 'manual',
      });
      res.json(competency);
    } catch (error) {
      console.error("Error updating competency:", error);
      res.status(500).json({ message: "Failed to update competency" });
    }
  });
  app.post('/api/facilitator/recalculate-competencies', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      let message = "Competencies recalculated successfully";
      if (preventedDowngrades.length > 0) {
        console.log(`[Competencies Recalc] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
        message += `. Preserved existing levels for: ${preventedDowngrades.join(', ')}`;
      }
      res.json({ 
        message,
        competencies,
        preventedDowngrades
      });
    } catch (error) {
      console.error("Error recalculating competencies:", error);
      res.status(500).json({ message: "Failed to recalculate competencies" });
    }
  });
  app.post('/api/facilitator/analyze-chat-history', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      console.log(`[Chat Analysis] Starting chat history analysis for facilitator ${facilitator.id}`);
      const chats = await storage.getUserChats(req.userId);
      if (chats.length === 0) {
        return res.json({
          message: "No chat history found",
          evidenceCount: 0,
          competenciesTracked: []
        });
      }
      let allMessages: Message[] = [];
      for (const chat of chats) {
        const messages = await storage.getChatMessages(chat.id, req.userId);
        allMessages = allMessages.concat(messages);
      }
      if (allMessages.length === 0) {
        return res.json({
          message: "No messages found in chat history",
          evidenceCount: 0,
          competenciesTracked: []
        });
      }
      console.log(`[Chat Analysis] Found ${allMessages.length} total messages across ${chats.length} chats`);
      const { analyzeConversationsForEvidence } = await import('./langchain-agents');
      const evidenceResults = await analyzeConversationsForEvidence(
        storage,
        facilitator.id,
        allMessages
      );
      console.log(`[Chat Analysis] Extracted ${evidenceResults.length} pieces of evidence`);
      res.json({
        message: "Chat history analyzed successfully",
        evidenceCount: evidenceResults.length,
        competenciesTracked: Array.from(new Set(evidenceResults.map(e => e.competencyId))),
        evidence: evidenceResults
      });
    } catch (error) {
      console.error("Error analyzing chat history:", error);
      res.status(500).json({ message: "Failed to analyze chat history" });
    }
  });
  app.post('/api/facilitator/apply-pending-evidence', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      console.log(`[Apply Evidence] Manual trigger for facilitator ${facilitator.id}`);
      const result = await applyPendingEvidence(storage, facilitator.id);
      console.log(`[Apply Evidence] Updated ${result.updatedCompetencies.length} competencies from ${result.totalEvidence} evidence pieces`);
      res.json({
        message: result.updatedCompetencies.length > 0 
          ? `Successfully updated ${result.updatedCompetencies.length} competencies`
          : "No competencies met the criteria for automatic updates (need 3+ evidence with 6+ avg strength)",
        updatedCompetencies: result.updatedCompetencies,
        totalEvidence: result.totalEvidence
      });
    } catch (error) {
      console.error("Error applying pending evidence:", error);
      res.status(500).json({ message: "Failed to apply pending evidence" });
    }
  });
  app.get('/api/facilitator/evidence-debug', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      console.log(`[Evidence Debug] Generating diagnostic report for facilitator ${facilitator.id}`);
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      const allEvidence = await storage.getFacilitatorEvidence(facilitator.id);
      const evidenceByCompetency = new Map<string, typeof allEvidence>();
      for (const evidence of allEvidence) {
        const existing = evidenceByCompetency.get(evidence.competencyId) || [];
        existing.push(evidence);
        evidenceByCompetency.set(evidence.competencyId, existing);
      }
      const diagnosticReport = Array.from(evidenceByCompetency.entries()).map(([competencyId, evidences]) => {
        const currentComp = competencies.find(c => c.competencyId === competencyId);
        const pendingEvidence = evidences.filter(e => !e.isAppliedToLevel);
        const appliedEvidence = evidences.filter(e => e.isAppliedToLevel);
        const avgStrength = pendingEvidence.length > 0
          ? pendingEvidence.reduce((sum, e) => sum + e.strengthScore, 0) / pendingEvidence.length
          : 0;
        const MIN_EVIDENCE_COUNT = 3;
        const MIN_AVG_STRENGTH = 6;
        const meetsUpdateCriteria = 
          pendingEvidence.length >= MIN_EVIDENCE_COUNT && 
          avgStrength >= MIN_AVG_STRENGTH;
        return {
          competencyId,
          competencyName: CORE_COMPETENCIES[competencyId]?.name || competencyId,
          currentStatus: currentComp?.status || 'not_started',
          statusSource: currentComp?.statusSource || 'auto',
          pendingEvidenceCount: pendingEvidence.length,
          appliedEvidenceCount: appliedEvidence.length,
          totalEvidenceCount: evidences.length,
          averageStrength: avgStrength.toFixed(1),
          meetsUpdateCriteria,
          updateBlockedReason: !meetsUpdateCriteria
            ? pendingEvidence.length < MIN_EVIDENCE_COUNT
              ? `Need ${MIN_EVIDENCE_COUNT} evidence (have ${pendingEvidence.length})`
              : `Need avg strength ${MIN_AVG_STRENGTH}+ (have ${avgStrength.toFixed(1)})`
            : null,
          pendingEvidence: pendingEvidence.map(e => ({
            id: e.id,
            text: e.evidenceText,
            strength: e.strengthScore,
            source: e.source,
            createdAt: e.createdAt,
            chatId: e.chatId,
            messageId: e.messageId
          })),
          appliedEvidence: appliedEvidence.slice(0, 3).map(e => ({
            id: e.id,
            text: e.evidenceText,
            strength: e.strengthScore,
            source: e.source,
            createdAt: e.createdAt
          }))
        };
      });
      diagnosticReport.sort((a, b) => {
        if (a.meetsUpdateCriteria && !b.meetsUpdateCriteria) return -1;
        if (!a.meetsUpdateCriteria && b.meetsUpdateCriteria) return 1;
        return b.pendingEvidenceCount - a.pendingEvidenceCount;
      });
      const summary = {
        facilitatorId: facilitator.id,
        facilitatorName: `${facilitator.firstName} ${facilitator.lastName}`,
        totalCompetenciesWithEvidence: diagnosticReport.length,
        competenciesMeetingCriteria: diagnosticReport.filter(c => c.meetsUpdateCriteria).length,
        totalPendingEvidence: allEvidence.filter(e => !e.isAppliedToLevel).length,
        totalAppliedEvidence: allEvidence.filter(e => e.isAppliedToLevel).length,
      };
      res.json({
        summary,
        competencies: diagnosticReport,
        thresholds: {
          minEvidenceCount: 3,
          minAverageStrength: 6
        }
      });
    } catch (error) {
      console.error("Error generating evidence debug report:", error);
      res.status(500).json({ message: "Failed to generate debug report" });
    }
  });
  app.get('/api/facilitator/qualifications', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.json([]);
      }
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      res.json(qualifications);
    } catch (error) {
      console.error("Error fetching qualifications:", error);
      res.status(500).json({ message: "Failed to fetch qualifications" });
    }
  });
  app.post('/api/facilitator/qualifications', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { courseTitle, institution, completionDate, courseLevel, description } = req.body;
      if (!courseTitle || !institution || !courseLevel || !description) {
        return res.status(400).json({ 
          message: "Course title, institution, course level, and description are required" 
        });
      }
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const qualification = await storage.createQualification({
        facilitatorId: facilitator.id,
        courseTitle,
        institution,
        completionDate: completionDate ? new Date(completionDate) : null,
        courseLevel,
        description,
      });
      const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
      if (preventedDowngrades.length > 0) {
        console.log(`[Qualification Create] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
      }
      res.json(qualification);
    } catch (error) {
      console.error("Error creating qualification:", error);
      res.status(500).json({ message: "Failed to create qualification" });
    }
  });
  app.patch('/api/facilitator/qualifications/:qualificationId', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { qualificationId } = req.params;
      const { courseTitle, institution, completionDate, courseLevel, description } = req.body;
      if (description !== undefined && (!description || !description.trim())) {
        return res.status(400).json({ 
          message: "Description cannot be empty" 
        });
      }
      if (courseLevel !== undefined && !courseLevel) {
        return res.status(400).json({ 
          message: "Course level cannot be empty" 
        });
      }
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const updates: QualificationUpdate = {};
      if (courseTitle !== undefined) updates.courseTitle = courseTitle;
      if (institution !== undefined) updates.institution = institution;
      if (completionDate !== undefined) updates.completionDate = completionDate ? new Date(completionDate) : null;
      if (courseLevel !== undefined) updates.courseLevel = courseLevel;
      if (description !== undefined) updates.description = description;
      const qualification = await storage.updateQualification(qualificationId, updates);
      const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
      if (preventedDowngrades.length > 0) {
        console.log(`[Qualification Update] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
      }
      res.json(qualification);
    } catch (error) {
      console.error("Error updating qualification:", error);
      res.status(500).json({ message: "Failed to update qualification" });
    }
  });
  app.delete('/api/facilitator/qualifications/:qualificationId', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { qualificationId } = req.params;
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      await storage.deleteQualification(qualificationId);
      if (facilitator) {
        const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
        if (preventedDowngrades.length > 0) {
          console.log(`[Qualification Delete] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting qualification:", error);
      res.status(500).json({ message: "Failed to delete qualification" });
    }
  });
  app.get('/api/facilitator/qualifications/:qualificationId/certificates', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const { qualificationId } = req.params;
      const attachments = await storage.getQualificationAttachments(qualificationId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });
  app.post('/api/facilitator/qualifications/:qualificationId/certificates', 
    requireAuth, 
    requireCSRFHeader,
    certificateUpload.single('certificate'), 
    async (req: SessionRequest, res: Response) => {
      try {
        const { qualificationId } = req.params;
        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: "Certificate file is required" });
        }
        const gcsUrl = await uploadToGCS(
          file.buffer,
          file.originalname,
          'certificates',
          file.mimetype
        );
        const filename = gcsUrl.split('/').pop() || file.originalname;
        const attachment = await storage.createQualificationAttachment({
          qualificationId,
          filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storagePath: gcsUrl,
        });
        res.json(attachment);
      } catch (error) {
        console.error("Error uploading certificate:", error);
        res.status(500).json({ message: "Failed to upload certificate" });
      }
    }
  );
  app.delete('/api/facilitator/qualifications/:qualificationId/certificates/:attachmentId', 
    requireAuth, 
    requireCSRFHeader, 
    async (req: SessionRequest, res: Response) => {
      try {
        const { attachmentId } = req.params;
        const attachments = await storage.getQualificationAttachments(req.params.qualificationId);
        const attachment = attachments.find(a => a.id === attachmentId);
        if (attachment) {
          await deleteFromGCS(attachment.storagePath);
        }
        await storage.deleteQualificationAttachment(attachmentId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting certificate:", error);
        res.status(500).json({ message: "Failed to delete certificate" });
      }
    }
  );
  app.get('/api/facilitator/qualifications/certificates/:attachmentId/download', 
    requireAuth, 
    async (req: SessionRequest, res: Response) => {
      try {
        const { attachmentId } = req.params;
        const facilitator = await storage.getFacilitatorByUserId(req.userId);
        if (!facilitator) {
          return res.status(404).json({ message: "Facilitator profile not found" });
        }
        const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
        let attachment: QualificationAttachment | undefined = undefined;
        for (const qual of qualifications) {
          const attachments = await storage.getQualificationAttachments(qual.id);
          attachment = attachments.find(a => a.id === attachmentId);
          if (attachment) break;
        }
        if (!attachment) {
          return res.status(404).json({ message: "Certificate not found" });
        }
        if (attachment.storagePath.includes('storage.googleapis.com')) {
          res.redirect(attachment.storagePath);
        } else {
        res.download(attachment.storagePath, attachment.originalName);
        }
      } catch (error) {
        console.error("Error downloading certificate:", error);
        res.status(500).json({ message: "Failed to download certificate" });
      }
    }
  );
  app.get('/api/facilitator/activities', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.json([]);
      }
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });
  app.post('/api/facilitator/activities', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { languageName, chaptersCount, durationYears, durationMonths, notes } = req.body;
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const activity = await storage.createActivity({
        facilitatorId: facilitator.id,
        languageName,
        chaptersCount: chaptersCount || 0,
        durationYears: durationYears || 0,
        durationMonths: durationMonths || 0,
        notes,
      });
      const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
      if (preventedDowngrades.length > 0) {
        console.log(`[Activity Create] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
      }
      res.json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });
  app.patch('/api/facilitator/activities/:activityId', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { activityId } = req.params;
      const { 
        languageName, chaptersCount, durationYears, durationMonths, notes,
        activityType, title, description, organization, yearsOfExperience
      } = req.body;
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const updates: ActivityUpdate = {};
      if (languageName !== undefined) updates.languageName = languageName;
      if (chaptersCount !== undefined) updates.chaptersCount = chaptersCount;
      if (durationYears !== undefined) updates.durationYears = durationYears;
      if (durationMonths !== undefined) updates.durationMonths = durationMonths;
      if (notes !== undefined) updates.notes = notes;
      if (activityType !== undefined) updates.activityType = activityType;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (organization !== undefined) updates.organization = organization;
      if (yearsOfExperience !== undefined) updates.yearsOfExperience = yearsOfExperience;
      const activity = await storage.updateActivity(activityId, updates);
      const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
      if (preventedDowngrades.length > 0) {
        console.log(`[Activity Update] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
      }
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });
  app.delete('/api/facilitator/activities/:activityId', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { activityId } = req.params;
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      await storage.deleteActivity(activityId);
      if (facilitator) {
        const { preventedDowngrades } = await storage.recalculateCompetencies(facilitator.id);
        if (preventedDowngrades.length > 0) {
          console.log(`[Activity Delete] Prevented downgrades for ${facilitator.fullName}: ${preventedDowngrades.join(', ')}`);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });
  app.get('/api/facilitator/reports', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.json([]);
      }
      const reports = await storage.getFacilitatorReports(facilitator.id);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });
  app.post('/api/facilitator/reports/generate', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { periodStart, periodEnd } = req.body;
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "Period start and end dates are required" });
      }
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const periodActivities = activities.filter(activity => {
        if (!activity.activityDate) return false;
        const activityDate = new Date(activity.activityDate);
        return activityDate >= startDate && activityDate <= endDate;
      });
      const reportData = {
        facilitator: {
          region: facilitator.region,
          mentorSupervisor: facilitator.mentorSupervisor,
          totalLanguagesMentored: facilitator.totalLanguagesMentored,
          totalChaptersMentored: facilitator.totalChaptersMentored
        },
        period: {
          start: periodStart,
          end: periodEnd
        },
        competencies: competencies.map(c => ({
          competencyId: c.competencyId,
          status: c.status,
          notes: c.notes,
          lastUpdated: c.lastUpdated
        })),
        qualifications: qualifications.map(q => ({
          courseTitle: q.courseTitle,
          institution: q.institution,
          completionDate: q.completionDate,
          credential: q.credential,
          description: q.description
        })),
        activities: periodActivities.map(a => ({
          languageName: a.languageName,
          chaptersCount: a.chaptersCount,
          activityDate: a.activityDate,
          notes: a.notes
        })),
        summary: {
          totalCompetencies: competencies.length,
          completedCompetencies: competencies.filter(c => c.status === 'proficient' || c.status === 'advanced').length,
          totalQualifications: qualifications.length,
          totalActivities: periodActivities.length,
          totalChapters: periodActivities.reduce((sum, a) => sum + (a.chaptersCount || 0), 0),
          languages: Array.from(new Set(periodActivities.map(a => a.languageName)))
        }
      };
      const recentMessages = await storage.getRecentUserMessages(req.userId, 50);
      let aiGeneratedNarrative: string | undefined;
      console.log('[Report Generation] Using LangChain Report Agent for narrative');
      try {
        const user = await storage.getUser(req.userId);
        aiGeneratedNarrative = await generateReportNarrative({
          facilitatorName: user ? `${user.firstName} ${user.lastName}` : 'Facilitator',
          region: facilitator.region,
          supervisor: facilitator.mentorSupervisor,
          totalLanguages: facilitator.totalLanguagesMentored,
          totalChapters: facilitator.totalChaptersMentored,
          competencies,
          qualifications,
          activities: periodActivities,
          recentMessages,
          periodStart: startDate,
          periodEnd: endDate,
        });
      } catch (error) {
        console.error('[Report Generation] Error generating AI narrative, falling back to template:', error);
      }
      const { filePath, document } = await generateQuarterlyReport({
        facilitator,
        competencies,
        qualifications,
        activities: periodActivities,
        recentMessages,
        periodStart: startDate,
        periodEnd: endDate,
        aiGeneratedNarrative,
      });
      const buffer = await Packer.toBuffer(document);
      await fs.writeFile(filePath, buffer);
      const report = await storage.createQuarterlyReport({
        facilitatorId: facilitator.id,
        periodStart: startDate,
        periodEnd: endDate,
        reportData,
        filePath,
      });
      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });
  app.delete('/api/facilitator/reports/:reportId', requireAuth, requireCSRFHeader, async (req: SessionRequest, res: Response) => {
    try {
      const { reportId } = req.params;
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      const report = await storage.getQuarterlyReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      if (report.facilitatorId !== facilitator.id) {
        return res.status(403).json({ message: "Unauthorized to delete this report" });
      }
      if (report.filePath) {
        try {
          await fs.unlink(report.filePath);
        } catch (fileError) {
          console.error("Error deleting report file:", fileError);
        }
      }
      await storage.deleteQuarterlyReport(reportId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });
  app.get('/api/facilitator/reports/:reportId/download', requireAuth, async (req: SessionRequest, res: Response) => {
    try {
      const { reportId } = req.params;
      const userId = req.userId;
      const user = await storage.getUserById(userId);
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const report = await storage.getQuarterlyReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      const reportOwnerUser = await storage.getUserByFacilitatorId(report.facilitatorId);
      const isOwner = facilitator && report.facilitatorId === facilitator.id;
      const isAdmin = user?.isAdmin === true;
      const isSupervisor = user?.isSupervisor === true && reportOwnerUser?.supervisorId === userId;
      if (!isOwner && !isAdmin && !isSupervisor) {
        return res.status(403).json({ message: "Unauthorized to download this report" });
      }
      if (!report.filePath) {
        return res.status(404).json({ message: "Report file not found" });
      }
      const normalizedPath = path.normalize(report.filePath);
      if (normalizedPath.includes('..')) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      try {
        await fs.access(report.filePath);
      } catch {
        return res.status(404).json({ message: "Report file not found on server" });
      }
      const fileName = `relatorio-${new Date(report.periodStart).toISOString().split('T')[0]}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      const fileStream = fsSync.createReadStream(report.filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ message: "Failed to download report" });
    }
  });
  registerDbSyncRoutes(app, requireAdmin, requireCSRFHeader);
  app.use('/uploads', requireAuth, express.static('uploads'));
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });
  const httpServer = createServer(app);
  return httpServer;
}

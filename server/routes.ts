import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateChatTitle, transcribeAudio, generateSpeech, generateSpeechStream } from "./openai";
import OpenAI from "openai";
import { storeMessageEmbedding, getContextForQuery, getComprehensiveContext, deleteChatEmbeddings } from "./vector-memory";
import { insertChatSchema, insertMessageSchema, insertApiKeySchema, insertUserSchema, insertFeedbackSchema, CORE_COMPETENCIES } from "@shared/schema";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { generateQuarterlyReport } from "./report-generator";
import { Packer } from 'docx';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import rateLimit from "express-rate-limit";
import { z } from "zod";
import multer from "multer";
import path from "path";
import { transcribeAudio as whisperTranscribe } from "./whisper";
import { processMessageWithLangChain, generateReportNarrative } from "./langchain-agents";
import { parseDocument, chunkText, storeDocumentChunks, updateDocumentChunksStatus, deleteDocumentChunks, searchDocumentChunks } from "./document-processor";
import { randomUUID } from "crypto";
import { registerDbSyncRoutes } from "./routes-db-sync";

/**
 * Extract text from certificate files (PDF, DOCX) for AI verification
 */
async function extractCertificateText(storagePath: string, mimeType: string): Promise<string | null> {
  try {
    let fileType: string | null = null;
    
    if (mimeType === 'application/pdf') {
      fileType = 'pdf';
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'docx';
    }
    
    if (!fileType) {
      return null; // Not a text-extractable document
    }
    
    const text = await parseDocument(storagePath, fileType);
    // Limit text length to avoid overwhelming the context
    return text.slice(0, 2000);
  } catch (error) {
    console.error('[Certificate Text Extraction] Error:', error);
    return null;
  }
}

// Server-side audio cache for faster TTS responses
interface CachedAudio {
  buffer: Buffer;
  timestamp: number;
  etag: string;
}

class AudioCache {
  private cache = new Map<string, CachedAudio>();
  private maxSize = 100; // Limit memory usage
  private ttl = 24 * 60 * 60 * 1000; // 24 hours

  private createCacheKey(text: string, language: string, voice?: string): string {
    // Normalize text for consistent caching
    const normalizedText = text.trim().toLowerCase();
    const voiceKey = voice || 'default';
    return createHash('sha256').update(`${normalizedText}:${language}:${voiceKey}`).digest('hex');
  }

  private isExpired(cached: CachedAudio): boolean {
    return Date.now() - cached.timestamp > this.ttl;
  }

  get(text: string, language: string, voice?: string): CachedAudio | null {
    const key = this.createCacheKey(text, language, voice);
    const cached = this.cache.get(key);
    
    if (cached && !this.isExpired(cached)) {
      // LRU: Move to end by re-inserting
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    
    if (cached) {
      this.cache.delete(key); // Remove expired
    }
    
    return null;
  }

  set(text: string, language: string, buffer: Buffer, voice?: string): CachedAudio {
    const key = this.createCacheKey(text, language, voice);
    const etag = `"${key.substring(0, 16)}"`;
    const cached: CachedAudio = {
      buffer,
      timestamp: Date.now(),
      etag
    };

    // LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, cached);
    return cached;
  }

  getETag(text: string, language: string, voice?: string): string {
    const key = this.createCacheKey(text, language, voice);
    return `"${key.substring(0, 16)}"`;
  }
}

const audioCache = new AudioCache();

// OpenAI instance for direct API calls
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR 
});

// Multer configuration for file uploads (images and audio)
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
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
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

// Multer configuration for document uploads (PDF, DOCX, TXT)
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
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

// Multer configuration for certificate uploads (PDF, images, DOCX)
const certificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/certificates/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const certificateUpload = multer({
  storage: certificateStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for certificates
  },
  fileFilter: (req: any, file: any, cb: any) => {
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

// Original multer configuration for audio uploads (for backward compatibility)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper max file size)
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Check approval status with legacy user override
    const approvalStatus = user.approvalStatus ?? 'approved';
    // Legacy override: users with lastLoginAt who are 'pending' are treated as 'approved'
    const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
    
    if (effectiveApproval === 'pending') {
      console.warn(`[Auth] Blocking pending user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      return res.status(403).json({ 
        message: "Your account is awaiting admin approval.",
        approvalStatus: "pending"
      });
    }
    
    if (effectiveApproval === 'rejected') {
      return res.status(403).json({ 
        message: "Your account has been rejected. Please contact support.",
        approvalStatus: "rejected"
      });
    }
    
    if (effectiveApproval !== 'approved') {
      console.warn(`[Auth] Blocking unapproved user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      return res.status(403).json({ 
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval
      });
    }
    
    req.userId = req.session.userId;
    req.user = user;
    return next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ message: "Authentication check failed" });
  }
}

// Admin authorization middleware
async function requireAdmin(req: any, res: any, next: any) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Check approval status first with legacy user override
    const approvalStatus = user.approvalStatus ?? 'approved';
    // Legacy override: users with lastLoginAt who are 'pending' are treated as 'approved'
    const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
    
    if (effectiveApproval === 'pending') {
      console.warn(`[Admin] Blocking pending user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      return res.status(403).json({ 
        message: "Your account is awaiting admin approval.",
        approvalStatus: "pending"
      });
    }
    
    if (effectiveApproval === 'rejected') {
      return res.status(403).json({ 
        message: "Your account has been rejected. Please contact support.",
        approvalStatus: "rejected"
      });
    }
    
    if (effectiveApproval !== 'approved') {
      console.warn(`[Admin] Blocking unapproved user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
      return res.status(403).json({ 
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval
      });
    }
    
    // Then check admin status
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    req.userId = user.id;
    req.user = user;
    return next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}

// Supervisor authorization middleware - allows both admins and supervisors
async function requireSupervisor(req: any, res: any, next: any) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Check approval status first with legacy user override
    const approvalStatus = user.approvalStatus ?? 'approved';
    const effectiveApproval = (approvalStatus === 'pending' && user.lastLoginAt) ? 'approved' : approvalStatus;
    
    if (effectiveApproval !== 'approved') {
      return res.status(403).json({ 
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval
      });
    }
    
    // Check if user is admin or supervisor
    if (!user.isAdmin && !user.isSupervisor) {
      return res.status(403).json({ message: "Supervisor access required" });
    }
    
    req.userId = user.id;
    req.user = user;
    return next();
  } catch (error) {
    console.error("Supervisor authorization error:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}

// CSRF protection middleware - requires custom header for state-changing operations
function requireCSRFHeader(req: any, res: any, next: any) {
  const customHeader = req.get('X-Requested-With');
  if (customHeader !== 'XMLHttpRequest') {
    return res.status(403).json({ message: "Missing required security header" });
  }
  return next();
}

// Explicit validation schemas with security requirements
const signupValidationSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  region: z.string().optional(),
  mentorSupervisor: z.string().optional(),
  supervisorId: z.string().uuid().optional(), // ID of the supervisor to assign
});

const loginValidationSchema = z.object({
  email: z.string().email().toLowerCase(), 
  password: z.string().min(1, "Password is required"),
});

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for public API endpoints
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for AI endpoints (more restrictive)
const aiApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 AI requests per windowMs
  message: { error: 'Too many AI requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post('/api/auth/signup', authLimiter, async (req: any, res) => {
    try {
      const userData = signupValidationSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Extract facilitator profile data and supervisor info
      const { region, mentorSupervisor, supervisorId, ...userDataOnly } = userData;
      
      // Check if approval is required
      const requireApproval = await storage.getSystemSetting('requireApproval');
      const approvalStatus = requireApproval === 'true' ? 'pending' : 'approved';
      
      // Create user with supervisor assignment
      const user = await storage.createUser({
        ...userDataOnly,
        password: hashedPassword,
        approvalStatus,
        supervisorId: supervisorId || null, // Assign supervisor if provided
      });
      
      // Automatically create facilitator profile for new users
      try {
        await storage.createFacilitator({
          userId: user.id,
          region: region || null,
          mentorSupervisor: mentorSupervisor || null,
        });
      } catch (facilitatorError) {
        console.error('Failed to create facilitator profile:', facilitatorError);
        // Don't fail signup if facilitator profile creation fails
      }
      
      // If user needs approval, redirect to login with pending message
      if (user.approvalStatus === 'pending') {
        return res.json({
          message: "Account created successfully. Awaiting admin approval.",
          approvalStatus: "pending"
        });
      }
      
      // Auto-login approved users
      // Regenerate session to prevent session fixation
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        
        // Set session
        req.session.userId = user.id;
        
        // Save session to ensure it's persisted
        req.session.save((saveErr: any) => {
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
    } catch (error: any) {
      console.error("Signup error:", error);
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      // Handle database unique constraint violations (race condition on duplicate email)
      if (error.code === '23505' || error.constraint?.includes('email')) {
        return res.status(400).json({ message: "User already exists" });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req: any, res) => {
    try {
      // Validate login data
      const { email, password } = loginValidationSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check approval status before creating session with legacy user override
      const approvalStatus = user.approvalStatus ?? 'approved';
      // Legacy override: users with lastLoginAt who are 'pending' are treated as 'approved'
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
      
      // Only allow approved users to log in
      if (effectiveApproval !== 'approved') {
        console.warn(`[Login] Blocking unapproved user: approval=${user.approvalStatus} lastLoginAt=${user.lastLoginAt} email=${user.email}`);
        return res.status(403).json({ 
          message: "Account access denied. Please contact support.",
          approvalStatus: effectiveApproval
        });
      }
      
      // Regenerate session to prevent session fixation
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        
        // Set session
        req.session.userId = user.id;
        
        // Save session to ensure it's persisted
        req.session.save(async (saveErr: any) => {
          if (saveErr) {
            console.error('Session save failed:', saveErr);
            return res.status(500).json({ message: "Failed to save session" });
          }
          
          // Track login activity
          try {
            await storage.updateUserLastLogin(user.id);
          } catch (loginTrackErr) {
            console.error('Failed to track login:', loginTrackErr);
            // Don't fail the login for tracking errors
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

  app.post('/api/auth/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie('translation.sid'); // Use our custom session cookie name
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Debug logging for admin status
      console.log(`[Auth] User ${user.email} - isAdmin: ${user.isAdmin}, isSupervisor: ${user.isSupervisor}, userId: ${user.id}`);
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isSupervisor: user.isSupervisor,
        supervisorId: user.supervisorId,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Public supervisor list endpoint for signup
  app.get('/api/supervisors', publicApiLimiter, async (req: any, res) => {
    try {
      const supervisors = await storage.getAllSupervisors();
      // Return only essential fields for autocomplete
      const supervisorList = supervisors.map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        fullName: `${s.firstName} ${s.lastName}`.trim() || s.email,
      }));
      res.json(supervisorList);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      res.status(500).json({ message: "Failed to fetch supervisors" });
    }
  });

  // Chat Chain routes
  app.get('/api/chat-chains', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const chains = await storage.getUserChatChains(userId);
      res.json(chains);
    } catch (error) {
      console.error("Error fetching chat chains:", error);
      res.status(500).json({ message: "Failed to fetch chat chains" });
    }
  });

  app.post('/api/chat-chains', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { title, summary } = req.body;
      
      const chain = await storage.createChatChain({
        userId,
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

  app.get('/api/chat-chains/:chainId', requireAuth, async (req: any, res) => {
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

  app.patch('/api/chat-chains/:chainId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chainId } = req.params;
      const { title, summary, activeChatId } = req.body;
      
      // Verify chain exists and belongs to user
      const existingChain = await storage.getChatChain(chainId, userId);
      if (!existingChain) {
        return res.status(404).json({ message: "Chat chain not found" });
      }
      
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (summary !== undefined) updates.summary = summary;
      
      // Validate activeChatId if provided
      if (activeChatId !== undefined) {
        if (activeChatId !== null) {
          // Verify the chat belongs to this user and is in this chain
          const chat = await storage.getChat(activeChatId, userId);
          if (!chat) {
            return res.status(403).json({ message: "Chat not found or unauthorized" });
          }
          if (chat.chainId !== chainId) {
            return res.status(400).json({ message: "Chat is not part of this chain" });
          }
        }
        updates.activeChatId = activeChatId;
      }
      
      const chain = await storage.updateChatChain(chainId, updates, userId);
      res.json(chain);
    } catch (error) {
      console.error("Error updating chat chain:", error);
      res.status(500).json({ message: "Failed to update chat chain" });
    }
  });

  app.delete('/api/chat-chains/:chainId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chainId } = req.params;
      
      // Verify chain exists and belongs to user
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

  app.get('/api/chat-chains/:chainId/chats', requireAuth, async (req: any, res) => {
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

  app.post('/api/chats/:chatId/chain', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { chainId } = req.body;
      
      if (chainId) {
        // Add chat to chain
        const chat = await storage.addChatToChain(chatId, chainId, userId);
        res.json(chat);
      } else {
        // Remove from chain
        const chat = await storage.removeChatFromChain(chatId, userId);
        res.json(chat);
      }
    } catch (error) {
      console.error("Error updating chat chain membership:", error);
      res.status(500).json({ message: "Failed to update chat chain membership" });
    }
  });

  // Chat routes
  app.get('/api/chats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const chats = await storage.getUserChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });

  app.post('/api/chats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const chatData = insertChatSchema.parse({ ...req.body, userId });
      const chat = await storage.createChat(chatData);
      
      // Track chat creation
      await storage.incrementUserChatCount(userId);
      
      res.json(chat);
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(500).json({ message: "Failed to create chat" });
    }
  });

  app.get('/api/chats/:chatId', requireAuth, async (req: any, res) => {
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

  app.get('/api/chats/:chatId/messages', requireAuth, async (req: any, res) => {
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

  app.post('/api/messages/:messageId/attachments', requireAuth, fileUpload.single('file'), async (req: any, res) => {
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
        // Default to document for other allowed types
        fileType = 'document';
      }
      
      let transcription: string | undefined;

      if (fileType === 'audio') {
        try {
          transcription = await whisperTranscribe(file.path);
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

  app.get('/api/messages/:messageId/attachments', requireAuth, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      const attachments = await storage.getMessageAttachments(messageId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });

  app.post('/api/chats/:chatId/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { content } = req.body;

      // Verify chat belongs to user
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Get facilitator info for context and embedding storage
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const facilitatorId = facilitator?.id;

      // Create user message
      const userMessage = await storage.createMessage({
        chatId,
        role: "user",
        content,
      });

      // Store user message embedding in Qdrant (non-blocking)
      storeMessageEmbedding({
        messageId: userMessage.id,
        chatId,
        userId,
        facilitatorId,
        content,
        role: 'user',
        timestamp: new Date(),
      }).catch(err => console.error('Error storing user message embedding:', err));

      // Check if this is the first user message and update title immediately
      const existingMessages = await storage.getChatMessages(chatId, userId);
      if (existingMessages.length === 1) {
        const title = await generateChatTitle(content);
        await storage.updateChatTitle(chatId, title, userId);
      }

      // Retrieve comprehensive context (portfolio + recent messages + vector search)
      const relevantContext = await getComprehensiveContext({
        query: content,
        chatId,
        facilitatorId,
        userId,
        includeGlobal: true,
      });

      // Wait for attachments to be uploaded (they come in a separate request)
      // Use retry logic to ensure attachments are available
      let attachments = await storage.getMessageAttachments(userMessage.id);
      if (attachments.length === 0 && content.trim() === '') {
        // If message has no content and no attachments yet, wait and retry
        // This handles the case where a file is uploaded without text
        await new Promise(resolve => setTimeout(resolve, 1000));
        attachments = await storage.getMessageAttachments(userMessage.id);
        
        if (attachments.length === 0) {
          // One more retry after another second
          await new Promise(resolve => setTimeout(resolve, 1000));
          attachments = await storage.getMessageAttachments(userMessage.id);
        }
      } else if (attachments.length === 0) {
        // For messages with content, shorter wait
        await new Promise(resolve => setTimeout(resolve, 500));
        attachments = await storage.getMessageAttachments(userMessage.id);
      }
      
      // Get any attachments for vision processing and context
      const imageAttachments = attachments.filter(att => att.fileType === 'image');
      const imageFilePaths = imageAttachments.map(att => att.storagePath);
      
      // Include all attachment metadata in context for AI awareness
      // Extract text from certificates for verification
      let attachmentContext = "";
      if (attachments.length > 0) {
        const attachmentDetails = await Promise.all(attachments.map(async (att) => {
          let details = `- ${att.originalName} (ID: ${att.id}, Type: ${att.mimeType}, Size: ${(att.fileSize / 1024).toFixed(1)}KB)`;
          
          // Extract text from certificates for verification
          const extractedText = await extractCertificateText(att.storagePath, att.mimeType);
          if (extractedText) {
            details += `\n  Content Preview: ${extractedText}`;
          }
          
          return details;
        }));
        
        attachmentContext = "\n\n[ATTACHMENTS IN THIS MESSAGE]:\n" + attachmentDetails.join("\n") + "\n";
        console.log('[Attachment Context] Processed', attachments.length, 'attachments with text extraction');
      }

      // Combine relevant context with attachment metadata
      const fullContext = relevantContext + attachmentContext;

      // Verify facilitator exists for LangChain (required for portfolio tools)
      if (!facilitatorId) {
        return res.status(400).json({ 
          message: "Facilitator profile required. Please complete your profile first." 
        });
      }
      
      console.log('[LangChain] Processing message with multi-agent system');
      
      // Get chat history for LangChain
      const chatHistory = await storage.getChatMessages(chatId, userId);
      
      // Process with LangChain agent (including image attachments)
      const langchainResponse = await processMessageWithLangChain(
        storage,
        userId,
        facilitatorId,
        content,
        chatHistory,
        fullContext,
        imageFilePaths.length > 0 ? imageFilePaths : undefined
      );
      
      const aiResponse = {
        content: langchainResponse,
        threadId: null, // LangChain doesn't use threads
      };

      // Create assistant message
      const assistantMessage = await storage.createMessage({
        chatId,
        role: "assistant",
        content: aiResponse.content,
      });

      // Store assistant message embedding in Qdrant (non-blocking)
      storeMessageEmbedding({
        messageId: assistantMessage.id,
        chatId,
        userId,
        facilitatorId,
        content: aiResponse.content,
        role: 'assistant',
        timestamp: new Date(),
      }).catch(err => console.error('Error storing assistant message embedding:', err));

      // Track message creation and API usage
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

  // Create user message only (without AI response) - for file uploads
  app.post('/api/chats/:chatId/messages/user-only', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { content = '' } = req.body;

      // Validate input - content can be empty if uploading files only
      if (typeof content !== 'string') {
        return res.status(400).json({ message: "Content must be a string" });
      }

      // Verify chat belongs to user
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Get facilitator info for embedding storage
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const facilitatorId = facilitator?.id;

      // Create user message only
      const userMessage = await storage.createMessage({
        chatId,
        role: "user",
        content,
      });

      // Store user message embedding in Qdrant (non-blocking)
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

  // Streaming message endpoint for real-time AI responses
  app.post('/api/chats/:chatId/messages/stream', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      const { content, existingMessageId } = req.body;

      // Verify chat belongs to user
      const chat = await storage.getChat(chatId, userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Get facilitator info for context and embedding storage
      const facilitator = await storage.getFacilitatorByUserId(userId);
      const facilitatorId = facilitator?.id;

      let userMessage;
      
      // Use existing message if provided (for file uploads), otherwise create new one
      if (existingMessageId) {
        const existing = await storage.getMessage(existingMessageId);
        if (!existing || existing.chatId !== chatId) {
          return res.status(404).json({ message: "Message not found" });
        }
        userMessage = existing;
      } else {
        // Create user message
        userMessage = await storage.createMessage({
          chatId,
          role: "user",
          content,
        });
        
        // Store user message embedding in Qdrant (non-blocking)
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

      // Check if this is the first user message and update title immediately (only for new messages)
      if (!existingMessageId) {
        const existingMessages = await storage.getChatMessages(chatId, userId);
        if (existingMessages.length === 1) {
          const title = await generateChatTitle(content);
          await storage.updateChatTitle(chatId, title, userId);
        }
      }
      
      // Get any image attachments for vision processing
      // No need to wait - for existingMessageId, attachments are already uploaded
      // For new messages without attachments, there's nothing to wait for
      const attachments = await storage.getMessageAttachments(userMessage.id);
      const imageAttachments = attachments.filter(att => att.fileType === 'image');
      const imageFilePaths = imageAttachments.map(att => att.storagePath);
      
      if (imageFilePaths.length > 0) {
        console.log('[Image File Paths]', imageFilePaths);
      }
      
      // Include all attachment metadata in context for AI awareness
      // Extract text from certificates for verification
      let attachmentContext = "";
      if (attachments.length > 0) {
        const attachmentDetails = await Promise.all(attachments.map(async (att) => {
          let details = `- ${att.originalName} (ID: ${att.id}, Type: ${att.mimeType}, Size: ${(att.fileSize / 1024).toFixed(1)}KB)`;
          
          // Extract text from certificates for verification
          const extractedText = await extractCertificateText(att.storagePath, att.mimeType);
          if (extractedText) {
            details += `\n  Content Preview: ${extractedText}`;
          }
          
          return details;
        }));
        
        attachmentContext = "\n\n[ATTACHMENTS IN THIS MESSAGE]:\n" + attachmentDetails.join("\n") + "\n";
        console.log('[Attachment Context] Processed', attachments.length, 'attachments with text extraction');
      }

      // Retrieve comprehensive context (portfolio + recent messages + vector search)
      const relevantContext = await getComprehensiveContext({
        query: content,
        chatId,
        facilitatorId,
        userId,
        includeGlobal: true,
      });
      
      // Combine relevant context with attachment metadata
      const fullContext = relevantContext + attachmentContext;

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Send initial user message
      res.write(`data: ${JSON.stringify({ 
        type: 'user_message', 
        data: userMessage 
      })}\n\n`);

      try {
        // Verify facilitator exists for LangChain (required for portfolio tools)
        if (!facilitatorId) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            data: { message: "Facilitator profile required. Please complete your profile first." }
          })}\n\n`);
          res.end();
          return;
        }
        
        console.log('[LangChain Streaming] Processing message with RAG-optimized LangChain agent');
        
        let assistantMessageId: string | null = null;
        let fullContent = "";
        
        // Get chat history for LangChain
        const chatHistory = await storage.getChatMessages(chatId, userId);
        
        // Process with LangChain agent (this uses RAG and is optimized!)
        const langchainResponse = await processMessageWithLangChain(
          storage,
          userId,
          facilitatorId,
          content,
          chatHistory,
          fullContext,
          imageFilePaths.length > 0 ? imageFilePaths : undefined
        );
        
        // Create assistant message
        const assistantMessage = await storage.createMessage({
          chatId,
          role: "assistant",
          content: "", // Will be updated incrementally
        });
        assistantMessageId = assistantMessage.id;
        
        // Send assistant message created event
        res.write(`data: ${JSON.stringify({ 
          type: 'assistant_message_start',
          data: assistantMessage
        })}\n\n`);
        
        // Simulate streaming by chunking the response
        const words = langchainResponse.split(' ');
        const chunkSize = 3; // Stream 3 words at a time for smooth experience
        
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ') + (i + chunkSize < words.length ? ' ' : '');
          fullContent += chunk;
          
          res.write(`data: ${JSON.stringify({ 
            type: 'content', 
            data: chunk 
          })}\n\n`);
          
          // Small delay for smooth streaming effect
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // Update the assistant message with final content
        await storage.updateMessage(assistantMessageId, { content: fullContent });
        
        // Store assistant message embedding in Qdrant (non-blocking)
        storeMessageEmbedding({
          messageId: assistantMessageId,
          chatId,
          userId,
          facilitatorId,
          content: fullContent,
          role: 'assistant',
          timestamp: new Date(),
        }).catch(err => console.error('Error storing assistant message embedding:', err));
        
        // Track message creation and API usage for streaming
        await Promise.all([
          storage.incrementUserMessageCount(userId),
          storage.incrementUserApiUsage(userId)
        ]);
        
        // Send completion event
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

  app.delete('/api/chats/:chatId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      
      // Delete chat from database (this also deletes messages via CASCADE)
      await storage.deleteChat(chatId, userId);
      
      // Delete all embeddings for this chat from Qdrant (so they don't appear in context)
      await deleteChatEmbeddings(chatId);
      
      res.json({ message: "Chat deleted successfully" });
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  app.patch('/api/chats/:chatId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { chatId } = req.params;
      
      // Create update schema for validating partial chat updates
      const updateChatSchema = insertChatSchema.pick({ assistantId: true, title: true }).partial();
      const updates = updateChatSchema.parse(req.body);
      
      // Verify chat belongs to user
      const existingChat = await storage.getChat(chatId, userId);
      if (!existingChat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Update the chat
      const updatedChat = await storage.updateChat(chatId, updates, userId);
      res.json(updatedChat);
    } catch (error) {
      console.error("Error updating chat:", error);
      res.status(500).json({ message: "Failed to update chat" });
    }
  });

  // API Key routes
  app.get('/api/api-keys', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const apiKeys = await storage.getUserApiKeys(userId);
      
      // Don't return the actual key hash
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

  app.post('/api/api-keys', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { name } = insertApiKeySchema.parse({ ...req.body, userId });
      
      // Generate a new API key
      const key = `ak_${randomBytes(16).toString('hex')}`;
      
      const apiKey = await storage.createApiKey({
        userId,
        name,
        key,
        isActive: true,
      });

      // Return the key once (user needs to save it)
      res.json({
        ...apiKey,
        key, // Only returned once
        keyHash: undefined,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete('/api/api-keys/:keyId', requireAuth, async (req: any, res) => {
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

  // Dashboard stats
  app.get('/api/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Public API endpoints (for external API access)
  const authenticateApiKey = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "API key required" });
      }

      const apiKey = authHeader.substring(7);
      
      // Extract prefix for lookup (first 8 characters)
      if (apiKey.length < 8) {
        return res.status(401).json({ message: "Invalid API key format" });
      }
      
      const prefix = apiKey.substring(0, 8);
      
      // Get candidate keys by prefix
      const candidateKeys = await storage.getApiKeysByPrefix(prefix);
      if (candidateKeys.length === 0) {
        return res.status(401).json({ message: "Invalid API key" });
      }
      
      // Find matching key using constant-time comparison
      let matchedKey: any = null;
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

      // Check approval status of the API key owner
      const keyOwner = await storage.getUserById(matchedKey.userId);
      if (!keyOwner) {
        return res.status(401).json({ message: "API key owner not found" });
      }
      
      // Check approval status with legacy user override
      const approvalStatus = keyOwner.approvalStatus ?? 'approved';
      // Legacy override: users with lastLoginAt who are 'pending' are treated as 'approved'
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

  app.post('/api/v1/chat/completions', authenticateApiKey, async (req: any, res) => {
    try {
      const { messages, temperature, max_tokens } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Messages array is required" });
      }

      // For external API, we'll use the assistant with a temporary chat ID
      const tempChatId = `api_${randomBytes(8).toString('hex')}`;
      const lastUserMessage = messages[messages.length - 1];
      
      if (!lastUserMessage || lastUserMessage.role !== 'user') {
        return res.status(400).json({ message: "Last message must be from user" });
      }

      // Use the new generateChatCompletion function to handle the entire conversation
      const response = await generateChatCompletion({
        chatId: tempChatId,
        messages: messages,
        assistantId: 'obtMentor', // Default to OBT Mentor for external API
      }, 'api-user'); // Use special API user ID for external requests

      // Record usage
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

  // Audio transcription endpoint using OpenAI Whisper
  app.post('/api/audio/transcribe', requireAuth, upload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const transcription = await transcribeAudio(req.file.buffer, req.file.originalname);
      
      // Track API usage
      await storage.incrementUserApiUsage(req.userId);
      
      res.json({ text: transcription });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  // Text-to-speech endpoint using OpenAI TTS with streaming for faster playback
  app.post('/api/audio/speak', requireAuth, async (req: any, res) => {
    try {
      const { text, language = 'en-US', voice } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      if (text.length > 4096) {
        return res.status(400).json({ message: "Text too long (max 4096 characters)" });
      }

      // Generate ETag for this content (include voice for proper caching)
      const etag = audioCache.getETag(text, language, voice);
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }

      // Check server cache first
      let cached = audioCache.get(text, language, voice);

      if (cached) {
        // Cache hit - instant response!
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
        });
        return res.send(cached.buffer);
      }

      // Cache miss - stream the audio for faster playback
      // Track API usage for new generations
      await storage.incrementUserApiUsage(req.userId);

      // Get the stream from OpenAI (this might fail, so handle before sending headers)
      let webStream: ReadableStream;
      try {
        webStream = await generateSpeechStream(text, language, voice);
      } catch (streamError) {
        console.error("Error getting speech stream:", streamError);
        return res.status(502).json({ message: "Failed to get audio from service" });
      }

      // Set headers for streaming only after we have a valid stream
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Transfer-Encoding': 'chunked', // Enable streaming
      });
      
      // Convert Web ReadableStream to Node.js Readable and collect chunks for caching
      const chunks: Buffer[] = [];
      const reader = webStream.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Send chunk to client immediately
          res.write(Buffer.from(value));
          
          // Collect for caching
          chunks.push(Buffer.from(value));
        }
        
        // Cache the complete audio
        const completeBuffer = Buffer.concat(chunks);
        audioCache.set(text, language, completeBuffer, voice);
      } catch (streamError) {
        console.error("Error streaming audio chunks:", streamError);
        // Headers already sent, can't return error status
        // Just end the connection - browser will handle partial audio
      } finally {
        // Always close the response, even on error
        res.end();
      }
    } catch (error) {
      console.error("Error generating speech:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate speech" });
      }
    }
  });

  // PUBLIC API ENDPOINTS - No authentication required, but rate limited
  
  // Public text translation endpoint
  app.post('/api/public/translate', aiApiLimiter, async (req: any, res) => {
    try {
      const { text, fromLanguage = 'auto', toLanguage = 'en-US', context = '' } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }

      if (text.length > 2048) {
        return res.status(400).json({ error: "Text too long (max 2048 characters)" });
      }

      // Create a translation prompt
      const prompt = context 
        ? `Translate the following text from ${fromLanguage} to ${toLanguage}. Context: ${context}\n\nText to translate: ${text}`
        : `Translate the following text from ${fromLanguage} to ${toLanguage}:\n\n${text}`;

      // Create a direct OpenAI chat completion for translation
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: 'system', content: 'You are a professional translator. Provide only the translation without any additional text or explanations.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });
      
      const response = completion.choices[0].message.content;

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

  // Public speech-to-text endpoint
  app.post('/api/public/transcribe', aiApiLimiter, upload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
      }

      const filename = req.file.originalname || 'audio.webm';
      const transcribedText = await transcribeAudio(req.file.buffer, filename);
      
      res.json({
        text: transcribedText,
        language: req.body.language || 'auto'
      });
    } catch (error) {
      console.error("Error in public transcription:", error);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  // Public text-to-speech endpoint
  app.post('/api/public/speak', aiApiLimiter, async (req: any, res) => {
    try {
      const { text, language = 'en-US', voice = 'alloy' } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }

      if (text.length > 1024) {
        return res.status(400).json({ error: "Text too long (max 1024 characters for public API)" });
      }

      // Generate ETag for this content
      const etag = audioCache.getETag(text, language, voice);
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }

      // Check server cache first
      let cached = audioCache.get(text, language, voice);
      let audioBuffer: Buffer;

      if (cached) {
        audioBuffer = cached.buffer;
      } else {
        audioBuffer = await generateSpeech(text, language, voice);
        cached = audioCache.set(text, language, audioBuffer, voice);
      }
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Access-Control-Allow-Origin': '*', // Allow CORS for public API
        'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error("Error in public speech generation:", error);
      res.status(500).json({ error: "Speech generation failed" });
    }
  });

  // Public API info endpoint
  app.get('/api/public/info', publicApiLimiter, (req: any, res) => {
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

  // Feedback routes
  app.post('/api/feedback', publicApiLimiter, async (req: any, res) => {
    try {
      // Validate feedback data
      const feedbackSchema = insertFeedbackSchema.extend({
        message: z.string().min(1, "Feedback message is required").max(5000, "Message too long"),
        userEmail: z.string().email().optional().or(z.literal("")),
        userName: z.string().optional().or(z.literal("")),
        category: z.enum(["bug", "feature", "general", "other"]).optional(),
      });

      const feedbackData = feedbackSchema.parse(req.body);
      
      // Extract userId from session if available
      const userId = req.session?.userId || null;

      const feedback = await storage.createFeedback({
        ...feedbackData,
        userId,
        userEmail: feedbackData.userEmail || undefined,
        userName: feedbackData.userName || undefined,
        status: 'new', // Default status
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

  // Admin feedback management routes (requires admin auth)
  app.get('/api/admin/feedback', requireAdmin, async (req: any, res) => {
    try {
      const feedback = await storage.getAllFeedback();
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // More specific routes must come before generic :id routes
  app.get('/api/admin/feedback/unread-count', requireAdmin, async (req: any, res) => {
    try {
      const unreadCount = await storage.getUnreadFeedbackCount();
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Error fetching unread feedback count:", error);
      res.status(500).json({ message: "Failed to fetch unread feedback count" });
    }
  });

  app.get('/api/admin/feedback/:id', requireAdmin, async (req: any, res) => {
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

  app.patch('/api/admin/feedback/:id', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
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

  app.delete('/api/admin/feedback/:id', requireAdmin, requireCSRFHeader, async (req: any, res) => {
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

  // Admin user management endpoints
  app.get('/api/admin/users', requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsersWithStats();
      
      // Remove sensitive information from response but include approval status
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

  app.patch('/api/admin/users/:userId/admin', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validation: ensure userId is provided and is a valid UUID format
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);

      // Prevent admins from removing their own admin status
      if (validatedUserId === req.userId) {
        return res.status(400).json({ message: "Cannot modify your own admin status" });
      }

      const updatedUser = await storage.toggleUserAdminStatus(validatedUserId);
      
      // Return sanitized user data
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

  app.patch('/api/admin/users/:userId/supervisor', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validation: ensure userId is provided and is a valid UUID format
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);

      const updatedUser = await storage.toggleUserSupervisorStatus(validatedUserId);
      
      // Return sanitized user data
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

  app.patch('/api/admin/users/:userId/assign-supervisor', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { supervisorId } = req.body;
      
      // Validation
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

  app.get('/api/admin/supervisors', requireAdmin, async (req: any, res) => {
    try {
      const supervisors = await storage.getAllSupervisors();
      res.json(supervisors);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      res.status(500).json({ message: "Failed to fetch supervisors" });
    }
  });

  app.delete('/api/admin/users/:userId', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validation: ensure userId is provided and is a valid UUID format
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);

      // Prevent admins from deleting their own account
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

  app.post('/api/admin/users/:userId/reset-password', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validation: ensure userId is provided and is a valid UUID format
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);

      // Generate a secure temporary password
      const tempPassword = randomBytes(12).toString('base64').replace(/[+/]/g, 'A').substring(0, 12);
      
      const updatedUser = await storage.resetUserPassword(validatedUserId, tempPassword);
      
      // Return sanitized user data along with the temporary password
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

  // Admin user approval management endpoints
  app.get('/api/admin/users/pending', requireAdmin, async (req: any, res) => {
    try {
      const pendingUsers = await storage.getPendingUsers();
      
      // Remove sensitive information from response
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

  app.get('/api/admin/users/pending-count', requireAdmin, async (req: any, res) => {
    try {
      const pendingCount = await storage.getPendingUsersCount();
      res.json({ count: pendingCount });
    } catch (error) {
      console.error("Error fetching pending users count:", error);
      res.status(500).json({ message: "Failed to fetch pending users count" });
    }
  });

  app.post('/api/admin/users/:userId/approve', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validation: ensure userId is provided and is a valid UUID format
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);

      const approvedUser = await storage.approveUser(validatedUserId, req.userId);
      
      // Return sanitized user data
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

  app.post('/api/admin/users/:userId/reject', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validation: ensure userId is provided and is a valid UUID format
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);

      const rejectedUser = await storage.rejectUser(validatedUserId, req.userId);
      
      // Return sanitized user data
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

  // System settings endpoints
  app.get('/api/admin/settings/require-approval', requireAdmin, async (req: any, res) => {
    try {
      const requireApproval = await storage.getSystemSetting('requireApproval');
      res.json({ requireApproval: requireApproval === 'true' });
    } catch (error) {
      console.error("Error fetching approval setting:", error);
      res.status(500).json({ message: "Failed to fetch approval setting" });
    }
  });

  app.post('/api/admin/settings/require-approval', requireAdmin, requireCSRFHeader, async (req: any, res) => {
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

  // Admin/Supervisor endpoint to generate report for any user (admin) or supervised user (supervisor)
  app.post('/api/admin/users/:userId/generate-report', requireSupervisor, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { periodStart, periodEnd } = req.body;
      
      // Check if user is admin or supervises this user
      if (!req.user.isAdmin) {
        const supervisedUser = await storage.getUserById(userId);
        if (!supervisedUser || supervisedUser.supervisorId !== req.userId) {
          return res.status(403).json({ message: "You can only generate reports for users you supervise" });
        }
      }
      
      // Validation
      const userIdSchema = z.string().uuid();
      const validatedUserId = userIdSchema.parse(userId);
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "Period start and end dates are required" });
      }
      
      const facilitator = await storage.getFacilitatorByUserId(validatedUserId);
      
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found for this user" });
      }
      
      // Fetch all data for the report period
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      
      // Filter activities by date range
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const periodActivities = activities.filter(activity => {
        if (!activity.activityDate) return false;
        const activityDate = new Date(activity.activityDate);
        return activityDate >= startDate && activityDate <= endDate;
      });
      
      // Compile report data
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
      
      // Create the report
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

  // Admin endpoints to view user portfolio data (also accessible to supervisors for their supervised users)
  app.get('/api/admin/users/:userId/profile', requireSupervisor, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user is admin or supervises this user
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

  app.get('/api/admin/users/:userId/competencies', requireSupervisor, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user is admin or supervises this user
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

  app.post('/api/admin/users/:userId/competencies', requireSupervisor, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validate request body
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
        statusSource: 'manual', // Mark as manually set by admin
      });
      
      res.json(competency);
    } catch (error) {
      console.error("Error updating user competency:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid competency data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user competency" });
    }
  });

  app.get('/api/admin/users/:userId/qualifications', requireSupervisor, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user is admin or supervises this user
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

  app.get('/api/admin/users/:userId/activities', requireSupervisor, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user is admin or supervises this user
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

  app.get('/api/admin/users/:userId/reports', requireSupervisor, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user is admin or supervises this user
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

  // Document Management Routes
  app.post('/api/admin/documents/upload', requireAdmin, requireCSRFHeader, documentUpload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No document file provided" });
      }

      const file = req.file;
      const documentId = randomUUID();
      
      // Determine file type from extension
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType: 'pdf' | 'docx' | 'txt';
      if (ext === '.pdf') fileType = 'pdf';
      else if (ext === '.docx') fileType = 'docx';
      else if (ext === '.txt') fileType = 'txt';
      else return res.status(400).json({ message: "Unsupported file type" });

      // Parse document text
      const text = await parseDocument(file.path, fileType);
      
      // Chunk the text (using defaults: ~225 words ≈ 300 tokens per chunk)
      const chunks = chunkText(text);
      
      // Store chunks in Qdrant
      const chunkCount = await storeDocumentChunks({
        documentId,
        filename: file.originalname,
        chunks,
        isActive: true,
      });

      // Save document record in database
      const document = await storage.createDocument({
        documentId,
        filename: file.originalname,
        uploadedBy: req.userId,
        fileType,
        chunkCount,
        isActive: true,
      });

      // Clean up uploaded file (we've stored everything in Qdrant)
      await fs.unlink(file.path).catch(err => console.error('Error deleting file:', err));

      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get('/api/admin/documents', requireAdmin, async (req: any, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.patch('/api/admin/documents/:documentId/toggle', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { documentId } = req.params;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const newActiveStatus = !document.isActive;

      // Update document status in Qdrant
      await updateDocumentChunksStatus(documentId, newActiveStatus);

      // Update document status in database
      const updated = await storage.updateDocumentActive(documentId, newActiveStatus);

      res.json(updated);
    } catch (error) {
      console.error("Error toggling document status:", error);
      res.status(500).json({ message: "Failed to toggle document status" });
    }
  });

  app.delete('/api/admin/documents/:documentId', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      const { documentId } = req.params;
      
      // Delete chunks from Qdrant
      await deleteDocumentChunks(documentId);

      // Delete document from database
      await storage.deleteDocument(documentId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.post('/api/admin/recalculate-all-competencies', requireAdmin, requireCSRFHeader, async (req: any, res) => {
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

  // System Prompt Management Routes
  app.get('/api/admin/system-prompt', requireAdmin, async (req: any, res) => {
    try {
      const promptPath = path.join(process.cwd(), 'server', 'system-prompt.txt');
      
      // Check if custom prompt exists
      if (fsSync.existsSync(promptPath)) {
        const customPrompt = await fs.readFile(promptPath, 'utf-8');
        res.json({ prompt: customPrompt, isCustom: true });
      } else {
        // Return default prompt from langchain-agents.ts
        const { OBT_MENTOR_INSTRUCTIONS } = await import('./langchain-agents');
        res.json({ prompt: OBT_MENTOR_INSTRUCTIONS, isCustom: false });
      }
    } catch (error) {
      console.error("Error getting system prompt:", error);
      res.status(500).json({ message: "Failed to get system prompt" });
    }
  });

  app.post('/api/admin/system-prompt', requireAdmin, requireCSRFHeader, async (req: any, res) => {
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

  // Supervisor Routes - For managing supervised users
  app.get('/api/supervisor/supervised-users', requireSupervisor, async (req: any, res) => {
    try {
      const supervisedUsers = await storage.getSupervisedUsers(req.userId);
      res.json(supervisedUsers);
    } catch (error) {
      console.error("Error fetching supervised users:", error);
      res.status(500).json({ message: "Failed to fetch supervised users" });
    }
  });

  app.get('/api/supervisor/pending-users', requireSupervisor, async (req: any, res) => {
    try {
      const pendingUsers = await storage.getPendingUsersForSupervisor(req.userId);
      res.json(pendingUsers);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      res.status(500).json({ message: "Failed to fetch pending users" });
    }
  });

  app.get('/api/supervisor/pending-users/count', requireSupervisor, async (req: any, res) => {
    try {
      const pendingUsers = await storage.getPendingUsersForSupervisor(req.userId);
      res.json({ count: pendingUsers.length });
    } catch (error) {
      console.error("Error fetching pending users count:", error);
      res.status(500).json({ message: "Failed to fetch pending users count" });
    }
  });

  app.patch('/api/supervisor/users/:userId/approve', requireSupervisor, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user is supervised by this supervisor
      const userToApprove = await storage.getUserById(userId);
      if (!userToApprove) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Allow admin to approve anyone, supervisor can only approve their supervised users
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

  app.patch('/api/supervisor/users/:userId/reject', requireSupervisor, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user is supervised by this supervisor
      const userToReject = await storage.getUserById(userId);
      if (!userToReject) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Allow admin to reject anyone, supervisor can only reject their supervised users
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

  app.get('/api/supervisor/users/:userId/facilitator', requireSupervisor, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user is supervised by this supervisor
      const supervisedUser = await storage.getUserById(userId);
      if (!supervisedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Allow admin to view anyone, supervisor can only view their supervised users
      if (!req.user.isAdmin && supervisedUser.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only view users you supervise" });
      }
      
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      
      // Get competencies, qualifications, and activities
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

  app.patch('/api/supervisor/users/:userId/competencies/:competencyId', requireSupervisor, requireCSRFHeader, async (req: any, res) => {
    try {
      const { userId, competencyId } = req.params;
      const { status, notes } = req.body;
      
      // Verify user is supervised by this supervisor
      const supervisedUser = await storage.getUserById(userId);
      if (!supervisedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Allow admin to update anyone, supervisor can only update their supervised users
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

  app.get('/api/supervisor/users/:userId/reports/:reportId', requireSupervisor, async (req: any, res) => {
    try {
      const { userId, reportId } = req.params;
      
      // Verify user is supervised by this supervisor
      const supervisedUser = await storage.getUserById(userId);
      if (!supervisedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Allow admin to view anyone, supervisor can only view their supervised users
      if (!req.user.isAdmin && supervisedUser.supervisorId !== req.userId) {
        return res.status(403).json({ message: "You can only view reports of users you supervise" });
      }
      
      const report = await storage.getQuarterlyReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Verify report belongs to the supervised user
      const facilitator = await storage.getFacilitatorByUserId(userId);
      if (!facilitator || report.facilitatorId !== facilitator.id) {
        return res.status(403).json({ message: "Report access denied" });
      }
      
      // Return report file path for download
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // OBT Mentor - Facilitator Profile Routes
  app.get('/api/facilitator/profile', requireAuth, async (req: any, res) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      const user = await storage.getUserById(req.userId);
      
      if (!facilitator) {
        // Auto-create facilitator profile if it doesn't exist
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

  app.post('/api/facilitator/profile', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { region, supervisorId } = req.body;
      
      // Update user's supervisorId in users table
      if (supervisorId !== undefined) {
        await storage.updateUserSupervisor(req.userId, supervisorId || null);
      }
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (facilitator) {
        // Update existing facilitator
        const updated = await storage.updateFacilitator(facilitator.id, {
          region,
        });
        return res.json({
          ...updated,
          supervisorId: supervisorId || null,
        });
      } else {
        // Create new facilitator
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

  // Competency Routes
  app.get('/api/facilitator/competencies', requireAuth, async (req: any, res) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (!facilitator) {
        return res.json([]);
      }
      
      // Automatically initialize/update all 11 competencies based on qualifications
      await storage.recalculateCompetencies(facilitator.id);
      
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      res.json(competencies);
    } catch (error) {
      console.error("Error fetching competencies:", error);
      res.status(500).json({ message: "Failed to fetch competencies" });
    }
  });

  app.post('/api/facilitator/competencies', requireAuth, requireCSRFHeader, async (req: any, res) => {
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
      });
      
      res.json(competency);
    } catch (error) {
      console.error("Error updating competency:", error);
      res.status(500).json({ message: "Failed to update competency" });
    }
  });

  app.post('/api/facilitator/recalculate-competencies', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      
      await storage.recalculateCompetencies(facilitator.id);
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      
      res.json({ 
        message: "Competencies recalculated successfully",
        competencies 
      });
    } catch (error) {
      console.error("Error recalculating competencies:", error);
      res.status(500).json({ message: "Failed to recalculate competencies" });
    }
  });

  // Qualification Routes
  app.get('/api/facilitator/qualifications', requireAuth, async (req: any, res) => {
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

  app.post('/api/facilitator/qualifications', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { courseTitle, institution, completionDate, courseLevel, description } = req.body;
      
      // Validate required fields
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
      
      // Recalculate competencies based on new qualification
      await storage.recalculateCompetencies(facilitator.id);
      
      res.json(qualification);
    } catch (error) {
      console.error("Error creating qualification:", error);
      res.status(500).json({ message: "Failed to create qualification" });
    }
  });

  app.patch('/api/facilitator/qualifications/:qualificationId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { qualificationId } = req.params;
      const { courseTitle, institution, completionDate, courseLevel, description } = req.body;
      
      // Validate that description is not empty if provided
      if (description !== undefined && (!description || !description.trim())) {
        return res.status(400).json({ 
          message: "Description cannot be empty" 
        });
      }
      
      // Validate that courseLevel is not empty if provided
      if (courseLevel !== undefined && !courseLevel) {
        return res.status(400).json({ 
          message: "Course level cannot be empty" 
        });
      }
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      
      const updates: any = {};
      if (courseTitle !== undefined) updates.courseTitle = courseTitle;
      if (institution !== undefined) updates.institution = institution;
      if (completionDate !== undefined) updates.completionDate = completionDate ? new Date(completionDate) : null;
      if (courseLevel !== undefined) updates.courseLevel = courseLevel;
      if (description !== undefined) updates.description = description;
      
      const qualification = await storage.updateQualification(qualificationId, updates);
      
      // Recalculate competencies based on updated qualification
      await storage.recalculateCompetencies(facilitator.id);
      
      res.json(qualification);
    } catch (error) {
      console.error("Error updating qualification:", error);
      res.status(500).json({ message: "Failed to update qualification" });
    }
  });

  app.delete('/api/facilitator/qualifications/:qualificationId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { qualificationId } = req.params;
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      await storage.deleteQualification(qualificationId);
      
      // Recalculate competencies after deletion
      if (facilitator) {
        await storage.recalculateCompetencies(facilitator.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting qualification:", error);
      res.status(500).json({ message: "Failed to delete qualification" });
    }
  });

  // Qualification Certificate Routes
  app.get('/api/facilitator/qualifications/:qualificationId/certificates', requireAuth, async (req: any, res) => {
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
    async (req: any, res) => {
      try {
        const { qualificationId } = req.params;
        const file = req.file;
        
        if (!file) {
          return res.status(400).json({ message: "Certificate file is required" });
        }

        // Ensure uploads/certificates directory exists
        const certDir = path.join(process.cwd(), 'uploads', 'certificates');
        await fs.mkdir(certDir, { recursive: true });
        
        const attachment = await storage.createQualificationAttachment({
          qualificationId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storagePath: file.path,
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
    async (req: any, res) => {
      try {
        const { attachmentId } = req.params;
        
        // Get attachment to delete file
        const attachments = await storage.getQualificationAttachments(req.params.qualificationId);
        const attachment = attachments.find(a => a.id === attachmentId);
        
        if (attachment) {
          // Delete file from disk
          try {
            await fs.unlink(attachment.storagePath);
          } catch (err) {
            console.error("Error deleting file from disk:", err);
          }
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
    async (req: any, res) => {
      try {
        const { attachmentId } = req.params;
        
        // Find the attachment across all qualifications
        const facilitator = await storage.getFacilitatorByUserId(req.userId);
        if (!facilitator) {
          return res.status(404).json({ message: "Facilitator profile not found" });
        }
        
        const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
        let attachment: any = null;
        
        for (const qual of qualifications) {
          const attachments = await storage.getQualificationAttachments(qual.id);
          attachment = attachments.find(a => a.id === attachmentId);
          if (attachment) break;
        }
        
        if (!attachment) {
          return res.status(404).json({ message: "Certificate not found" });
        }
        
        res.download(attachment.storagePath, attachment.originalName);
      } catch (error) {
        console.error("Error downloading certificate:", error);
        res.status(500).json({ message: "Failed to download certificate" });
      }
    }
  );

  // Mentorship Activity Routes
  app.get('/api/facilitator/activities', requireAuth, async (req: any, res) => {
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

  app.post('/api/facilitator/activities', requireAuth, requireCSRFHeader, async (req: any, res) => {
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
      
      // Recalculate competencies based on new activity
      await storage.recalculateCompetencies(facilitator.id);
      
      res.json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch('/api/facilitator/activities/:activityId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { activityId } = req.params;
      const { languageName, chaptersCount, durationYears, durationMonths, notes } = req.body;
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      
      const updates: any = {};
      if (languageName !== undefined) updates.languageName = languageName;
      if (chaptersCount !== undefined) updates.chaptersCount = chaptersCount;
      if (durationYears !== undefined) updates.durationYears = durationYears;
      if (durationMonths !== undefined) updates.durationMonths = durationMonths;
      if (notes !== undefined) updates.notes = notes;
      
      const activity = await storage.updateActivity(activityId, updates);
      
      // Recalculate competencies based on updated activity
      await storage.recalculateCompetencies(facilitator.id);
      
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete('/api/facilitator/activities/:activityId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { activityId } = req.params;
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      await storage.deleteActivity(activityId);
      
      // Recalculate competencies after deletion
      if (facilitator) {
        await storage.recalculateCompetencies(facilitator.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Quarterly Report Routes
  app.get('/api/facilitator/reports', requireAuth, async (req: any, res) => {
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

  app.post('/api/facilitator/reports/generate', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { periodStart, periodEnd } = req.body;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "Period start and end dates are required" });
      }
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      
      // Fetch all data for the report period
      const competencies = await storage.getFacilitatorCompetencies(facilitator.id);
      const qualifications = await storage.getFacilitatorQualifications(facilitator.id);
      const activities = await storage.getFacilitatorActivities(facilitator.id);
      
      // Filter activities by date range
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const periodActivities = activities.filter(activity => {
        if (!activity.activityDate) return false;
        const activityDate = new Date(activity.activityDate);
        return activityDate >= startDate && activityDate <= endDate;
      });
      
      // Compile report data
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
      
      // Get recent chat messages for narrative summary
      const recentMessages = await storage.getRecentUserMessages(req.userId, 50);
      
      // Generate AI narrative using LangChain Report Agent
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
      
      // Generate .docx file
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
      
      // Convert document to buffer and save
      const buffer = await Packer.toBuffer(document);
      await fs.writeFile(filePath, buffer);
      
      // Create the report with filePath
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

  app.delete('/api/facilitator/reports/:reportId', requireAuth, requireCSRFHeader, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      
      const facilitator = await storage.getFacilitatorByUserId(req.userId);
      
      if (!facilitator) {
        return res.status(404).json({ message: "Facilitator profile not found" });
      }
      
      // Fetch the report and verify ownership
      const report = await storage.getQuarterlyReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      if (report.facilitatorId !== facilitator.id) {
        return res.status(403).json({ message: "Unauthorized to delete this report" });
      }
      
      // Delete the .docx file if it exists
      if (report.filePath) {
        try {
          await fs.unlink(report.filePath);
        } catch (fileError) {
          console.error("Error deleting report file:", fileError);
          // Continue with database deletion even if file deletion fails
        }
      }
      
      await storage.deleteQuarterlyReport(reportId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Download report .docx file
  app.get('/api/facilitator/reports/:reportId/download', requireAuth, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const userId = req.userId;
      
      // Get user to check if admin/supervisor
      const user = await storage.getUserById(userId);
      const facilitator = await storage.getFacilitatorByUserId(userId);
      
      // Fetch the report
      const report = await storage.getQuarterlyReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Get the user who owns this report to check supervisor relationship
      const reportOwnerUser = await storage.getUserByFacilitatorId(report.facilitatorId);
      
      // Verify authorization: owner, admin, or supervisor
      const isOwner = facilitator && report.facilitatorId === facilitator.id;
      const isAdmin = user?.isAdmin === true;
      const isSupervisor = user?.isSupervisor === true && reportOwnerUser?.supervisorId === userId;
      
      if (!isOwner && !isAdmin && !isSupervisor) {
        return res.status(403).json({ message: "Unauthorized to download this report" });
      }
      
      // Check if file exists
      if (!report.filePath) {
        return res.status(404).json({ message: "Report file not found" });
      }
      
      // Prevent directory traversal attacks
      const normalizedPath = path.normalize(report.filePath);
      if (normalizedPath.includes('..')) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      
      // Check if file exists on filesystem
      try {
        await fs.access(report.filePath);
      } catch {
        return res.status(404).json({ message: "Report file not found on server" });
      }
      
      // Set headers for download
      const fileName = `relatorio-${new Date(report.periodStart).toISOString().split('T')[0]}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Stream the file
      const fileStream = fsSync.createReadStream(report.filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ message: "Failed to download report" });
    }
  });

  // Database sync routes (admin only)
  registerDbSyncRoutes(app, requireAdmin, requireCSRFHeader);

  // Serve uploaded files
  app.use('/uploads', requireAuth, (req: any, res, next) => {
    const express = require('express');
    express.static('uploads')(req, res, next);
  });

  // Catch-all for unmatched API routes - return 404 instead of HTML
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  const httpServer = createServer(app);
  return httpServer;
}

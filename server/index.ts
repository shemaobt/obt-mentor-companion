import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { neon } from "@neondatabase/serverless";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./utils";
import { initializeQdrantCollection } from "./vector-memory";

const app = express();
app.use(express.json({ limit: '10mb' })); // Increased for screenshot uploads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Trust proxy for proper secure cookie and IP handling (Cloud Run, nginx, etc.)
app.set('trust proxy', 1);

// Session configuration
const PostgreSQLStore = connectPgSimple(session);

// Ensure SESSION_SECRET is available (use a default for deployment if not set)
const sessionSecret = process.env.SESSION_SECRET || 'obt-mentor-companion-secret-2025';
if (!process.env.SESSION_SECRET) {
  log('Warning: SESSION_SECRET not set, using default (please set in production)');
}

// Configure session store to use existing Drizzle sessions table with error handling
let sessionStore: any;

// Validate DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  const errorMsg = 'DATABASE_URL environment variable is required';
  log(`Session store warning: ${errorMsg}`);
  // Use memory store if DATABASE_URL missing - server will still start
  const MemoryStore = session.MemoryStore;
  sessionStore = new MemoryStore();
  log('Using memory-based session store (DATABASE_URL not set)');
} else {
  try {
    sessionStore = new PostgreSQLStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: 'sessions', // Use existing Drizzle table name
      createTableIfMissing: true, // Auto-create table if missing (fixes production)
    });
    
    // Test database connection with error handling
    sessionStore.on('error', (error: any) => {
      log(`Session store database error: ${error.message}`);
      // In production, this is critical but we'll let it continue
      if (process.env.NODE_ENV === 'production') {
        log('Session store error in production - sessions may not persist');
      }
    });
    
    sessionStore.on('connect', () => {
      log('Session store connected to PostgreSQL database successfully');
    });
    
    log('Using PostgreSQL session store (production mode)');
    
  } catch (error) {
    log(`Failed to initialize PostgreSQL session store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Fallback to memory store
    const MemoryStore = session.MemoryStore;
    sessionStore = new MemoryStore();
    log('Falling back to memory-based session store (degraded mode)');
  }
}

// Add session middleware with error handling
try {
  // Check if we're in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Determine cookie settings based on environment
  const cookieSettings: any = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax' as const,
    // Set secure to true only in production with HTTPS
    secure: isProduction ? 'auto' : false,
  };

  app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'obt_mentor.sid', // Custom session cookie name
    cookie: cookieSettings,
    proxy: true, // Trust the reverse proxy (Cloud Run, nginx)
  }));
} catch (error) {
  log(`Failed to configure session middleware: ${error instanceof Error ? error.message : 'Unknown error'}`);
  // Continue without session middleware as fallback
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log response body for non-sensitive routes
      const isSensitiveRoute = path.startsWith('/api/auth') || path.startsWith('/api/api-keys');
      if (capturedJsonResponse && !isSensitiveRoute) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Track initialization state
let isInitialized = false;
let initError: string | null = null;

// Add health check endpoint for deployment readiness - MUST respond quickly
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    initialized: isInitialized,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start the server IMMEDIATELY so Cloud Run health checks pass
const port = parseInt(process.env.PORT || '5000', 10);
log(`Starting server on port ${port}...`);
log(`Environment: ${process.env.NODE_ENV || 'development'}`);
log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);

// Create HTTP server directly from express app first
const server = createServer(app);

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    log(`Server error: ${error.message}`);
    throw error;
  }
  
  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
  
  switch (error.code) {
    case 'EACCES':
      log(`ERROR: ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      log(`ERROR: ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      log(`ERROR: Server error on ${bind}: ${error.message}`);
      throw error;
  }
});

// Start listening IMMEDIATELY
server.listen(port, "0.0.0.0", () => {
  log(`✅ Server listening on port ${port}`);
  log(`Health check available at http://0.0.0.0:${port}/health`);
  
  // NOW do the slow initialization asynchronously
  initializeApp().catch((error) => {
    log(`Server initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    initError = error instanceof Error ? error.message : 'Unknown error';
    // Don't exit - keep the server running for health checks and debugging
  });
});

// Async initialization function - runs AFTER server is listening
async function initializeApp() {
  try {
    log('Starting application initialization...');
    
    // Register routes (includes database operations)
    await registerRoutes(app);
    log('Routes registered successfully');

    // Initialize Qdrant collection for global memory
    try {
      await initializeQdrantCollection();
      log('Qdrant vector memory initialized successfully');
    } catch (error) {
      log(`Warning: Qdrant initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      log('Continuing without vector memory (semantic search will be unavailable)');
    }

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      log(`Request error: ${err.message || err}`);
    });

    // Setup static file serving in production
    if (app.get("env") !== "development") {
      serveStatic(app);
      log('Static file serving configured');
    }

    isInitialized = true;
    log('✅ Application fully initialized and ready to serve requests');
  } catch (error) {
    log(`Initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

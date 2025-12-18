import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./utils";
import { initializeQdrantCollection } from "./vector-memory";
import { config } from "./config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("trust proxy", 1);

const PostgreSQLStore = connectPgSimple(session);

const sessionSecret = config.session.secret;
if (!process.env.SESSION_SECRET) {
  log("Warning: SESSION_SECRET not set, using default");
}

let sessionStore: any;

if (!process.env.DATABASE_URL) {
  log("Session store warning: DATABASE_URL not set");
  const MemoryStore = session.MemoryStore;
  sessionStore = new MemoryStore();
  log("Using memory-based session store");
} else {
  try {
    sessionStore = new PostgreSQLStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: "sessions",
      createTableIfMissing: true,
    });

    sessionStore.on("error", (error: any) => {
      log(`Session store database error: ${error.message}`);
      if (process.env.NODE_ENV === "production") {
        log("Session store error in production - sessions may not persist");
      }
    });

    sessionStore.on("connect", () => {
      log("Session store connected to PostgreSQL database successfully");
    });

    log("Using PostgreSQL session store");
  } catch (error) {
    log(`Failed to initialize PostgreSQL session store: ${error instanceof Error ? error.message : "Unknown error"}`);
    const MemoryStore = session.MemoryStore;
    sessionStore = new MemoryStore();
    log("Falling back to memory-based session store");
  }
}

try {
  const isProduction = process.env.NODE_ENV === "production";

  const cookieSettings: any = {
    httpOnly: true,
    maxAge: config.session.maxAge,
    sameSite: "lax" as const,
    secure: isProduction ? "auto" : false,
  };

  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: config.session.cookieName,
      cookie: cookieSettings,
      proxy: true,
    })
  );
} catch (error) {
  log(`Failed to configure session middleware: ${error instanceof Error ? error.message : "Unknown error"}`);
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

      const isSensitiveRoute = path.startsWith("/api/auth") || path.startsWith("/api/api-keys");
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

let isInitialized = false;
let initError: string | null = null;

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    initialized: isInitialized,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

const port = parseInt(process.env.PORT || "5000", 10);
log(`Starting server on port ${port}...`);
log(`Environment: ${process.env.NODE_ENV || "development"}`);
log(`DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "not set"}`);

const server = createServer(app);

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    log(`Server error: ${error.message}`);
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  switch (error.code) {
    case "EACCES":
      log(`ERROR: ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      log(`ERROR: ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      log(`ERROR: Server error on ${bind}: ${error.message}`);
      throw error;
  }
});

server.listen(port, "0.0.0.0", () => {
  log(`✅ Server listening on port ${port}`);
  log(`Health check available at http://0.0.0.0:${port}/health`);

  initializeApp().catch((error) => {
    log(`Server initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    initError = error instanceof Error ? error.message : "Unknown error";
  });
});

async function initializeApp() {
  try {
    log("Starting application initialization...");

    await registerRoutes(app);
    log("Routes registered successfully");

    try {
      await initializeQdrantCollection();
      log("Qdrant vector memory initialized successfully");
    } catch (error) {
      log(`Warning: Qdrant initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      log("Continuing without vector memory");
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      log(`Request error: ${err.message || err}`);
    });

    if (app.get("env") !== "development") {
      serveStatic(app);
      log("Static file serving configured");
    }

    isInitialized = true;
    log("✅ Application fully initialized and ready to serve requests");
  } catch (error) {
    log(`Initialization error: ${error instanceof Error ? error.message : "Unknown error"}`);
    throw error;
  }
}

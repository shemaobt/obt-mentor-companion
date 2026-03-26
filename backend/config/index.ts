function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function getGoogleApiKey(): string {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: GOOGLE_API_KEY or GEMINI_API_KEY");
  }
  return apiKey;
}

function getDatabaseUrl(): string {
  const url = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing required environment variable: DATABASE_URL or PRODUCTION_DATABASE_URL");
  }
  return url;
}

function getDbSyncConfig(): { productionUrlConfigured: boolean; developmentUrlConfigured: boolean } {
  return {
    productionUrlConfigured: !!process.env.PRODUCTION_DATABASE_URL,
    developmentUrlConfigured: !!process.env.DATABASE_URL,
  };
}

function getQdrantConfig(): { url: string; apiKey: string } {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    throw new Error("Missing required environment variables: QDRANT_URL and QDRANT_API_KEY");
  }
  return { url, apiKey };
}

const nodeEnv = getEnv("NODE_ENV", "development");

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === "production",
  isDevelopment: nodeEnv === "development",
  port: parseInt(getEnv("PORT", "5000"), 10),
  database: {
    url: getDatabaseUrl(),
  },
  google: {
    apiKey: getGoogleApiKey(),
  },
  qdrant: getQdrantConfig(),
  gcs: {
    bucketName: getEnv("GCS_BUCKET_NAME", "obt-mentor-uploads"),
  },
  dbSync: getDbSyncConfig(),
  session: {
    secret: requireEnv("SESSION_SECRET"),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    cookieName: "obt_mentor.sid",
  },
  upload: {
    maxFileSize: 25 * 1024 * 1024,
    maxCertificateSize: 10 * 1024 * 1024,
    maxProfileImageSize: 5 * 1024 * 1024,
    directory: "uploads/",
    allowedImageTypes: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
    allowedAudioTypes: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/ogg", "audio/webm", "video/webm"],
    allowedDocTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
    allowedCertificateTypes: ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    allowedProfileImageTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
  },
  rateLimits: {
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 15,
    },
    publicApi: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
    aiApi: {
      windowMs: 15 * 60 * 1000,
      max: 50,
    },
    passwordChange: {
      windowMs: 15 * 60 * 1000,
      max: 10,
    },
  },
  auth: {
    saltRounds: 12,
    minPasswordLength: 6,
  },
  cache: {
    audio: {
      maxSize: 100,
      ttl: 24 * 60 * 60 * 1000,
    },
  },
};


export const config = {
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
      max: 5,
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
  session: {
    secret: process.env.SESSION_SECRET || "obt-mentor-companion-secret-2025",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    cookieName: "obt_mentor.sid",
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


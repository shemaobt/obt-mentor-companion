import multer from "multer";
import path from "path";
import { config } from "./index";

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.directory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const fileUpload = multer({
  storage: fileStorage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = [
      ...config.upload.allowedImageTypes,
      ...config.upload.allowedAudioTypes,
      ...config.upload.allowedDocTypes,
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image, audio, and document files are allowed"));
    }
  },
});

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (config.upload.allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
    }
  },
});

export const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxCertificateSize,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (config.upload.allowedCertificateTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPEG, PNG, and DOCX files are allowed for certificates"));
    }
  },
});

export const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxProfileImageSize,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (config.upload.allowedProfileImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed"));
    }
  },
});

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "video/webm") {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});


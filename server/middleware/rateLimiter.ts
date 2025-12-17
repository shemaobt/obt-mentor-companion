import rateLimit from "express-rate-limit";
import { config } from "../config";

export const authLimiter = rateLimit({
  windowMs: config.rateLimits.auth.windowMs,
  max: config.rateLimits.auth.max,
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicApiLimiter = rateLimit({
  windowMs: config.rateLimits.publicApi.windowMs,
  max: config.rateLimits.publicApi.max,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiApiLimiter = rateLimit({
  windowMs: config.rateLimits.aiApi.windowMs,
  max: config.rateLimits.aiApi.max,
  message: { error: "Too many AI requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordChangeLimiter = rateLimit({
  windowMs: config.rateLimits.passwordChange.windowMs,
  max: config.rateLimits.passwordChange.max,
  message: { message: "Too many password change attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});


import { z } from "zod";
import { config } from "../config";

export const signupValidationSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(config.auth.minPasswordLength, `Password must be at least ${config.auth.minPasswordLength} characters long`),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  region: z.string().optional(),
  mentorSupervisor: z.string().optional(),
  supervisorId: z.string().uuid().optional(),
});

export const loginValidationSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordValidationSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(config.auth.minPasswordLength, `New password must be at least ${config.auth.minPasswordLength} characters long`),
});

export const feedbackValidationSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
  category: z.enum(["bug", "feature", "general", "other"]).optional(),
});

export const chatValidationSchema = z.object({
  title: z.string().min(1).max(500),
  assistantId: z.string().optional(),
});

export const messageValidationSchema = z.object({
  content: z.string().min(1),
  role: z.enum(["user", "assistant"]),
});

export const apiKeyValidationSchema = z.object({
  name: z.string().min(1).max(100),
});


import { z } from "zod";

export const createChatChainSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().max(1000).optional(),
});

export const updateChatChainSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().max(1000).optional(),
  activeChatId: z.string().uuid().nullable().optional(),
});

export const setChatChainSchema = z.object({
  chainId: z.string().uuid().nullable(),
});

export const createMessageSchema = z.object({
  content: z.string().max(50000),
});

export const streamMessageSchema = z.object({
  content: z.string().max(50000),
  existingMessageId: z.string().uuid().optional(),
});

export type CreateChatChainInput = z.infer<typeof createChatChainSchema>;
export type UpdateChatChainInput = z.infer<typeof updateChatChainSchema>;
export type SetChatChainInput = z.infer<typeof setChatChainSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type StreamMessageInput = z.infer<typeof streamMessageSchema>;

import type { User } from "@shared/schema";
import { randomBytes, createHash } from "crypto";

export interface SupervisorListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  fullName: string;
}

export function formatSupervisorList(supervisors: User[]): SupervisorListItem[] {
  return supervisors.map(s => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    fullName: `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.email,
  }));
}

export interface ApiKeyWithMask {
  id: string;
  name: string;
  prefix: string;
  maskedKey: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export function maskApiKey(key: { id: string; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null; expiresAt: Date | null }): ApiKeyWithMask {
  return {
    ...key,
    maskedKey: `ak_${key.prefix}...***`,
  };
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `ak_${randomBytes(16).toString("hex")}`;
  const prefix = key.substring(3, 11);
  const hash = createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}

export async function streamTextWithChunks(
  text: string,
  chunkSize: number,
  delayMs: number,
  onChunk: (chunk: string) => void
): Promise<string> {
  let fullContent = "";
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    fullContent += chunk;
    onChunk(chunk);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return fullContent;
}

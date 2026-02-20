import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function generateChatTitle(firstMessage: string): string {
  const title = firstMessage.trim();
  if (title.length <= 50) return title;

  const words = title.split(" ");
  let result = "";

  for (const word of words) {
    if ((result + " " + word).length > 47) break;
    result = result ? result + " " + word : word;
  }

  return result + "...";
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.log(`Static file directory not found: ${distPath} - skipping static file serving`);
    return;
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

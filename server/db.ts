import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Use PRODUCTION_DATABASE_URL if available, otherwise fall back to DATABASE_URL
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL or PRODUCTION_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle({ client: pool, schema });
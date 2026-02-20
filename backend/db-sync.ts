import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users, facilitators } from "@shared/schema";
import { eq, gt } from "drizzle-orm";

/**
 * One-way database sync from production to development
 * 
 * This script safely copies user data from production to development:
 * - Users table (including admin, supervisor, approval status)
 * - Facilitators table (profiles linked to users)
 * 
 * SAFETY RULES:
 * - NEVER syncs back to production (one-way only)
 * - Uses read-only access to production
 * - Skips sensitive data (password hashes, API keys)
 * - Does NOT sync: chats, messages, documents, vector memory
 */

interface SyncResult {
  success: boolean;
  usersCreated: number;
  usersUpdated: number;
  facilitatorsCreated: number;
  facilitatorsUpdated: number;
  errors: string[];
}

export async function syncProductionToDevDatabase(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    usersCreated: 0,
    usersUpdated: 0,
    facilitatorsCreated: 0,
    facilitatorsUpdated: 0,
    errors: [],
  };

  try {
    // Get database connections
    const productionUrl = process.env.PRODUCTION_DATABASE_URL;
    const developmentUrl = process.env.DATABASE_URL;

    if (!productionUrl) {
      result.errors.push("PRODUCTION_DATABASE_URL not configured");
      return result;
    }

    if (!developmentUrl) {
      result.errors.push("DATABASE_URL not configured");
      return result;
    }

    console.log("[DB Sync] Starting one-way sync from production to development...");

    // Create database connections
    const prodSql = neon(productionUrl);
    const prodDb = drizzle(prodSql);

    const devSql = neon(developmentUrl);
    const devDb = drizzle(devSql);

    // Step 1: Sync users table
    console.log("[DB Sync] Fetching users from production...");
    const prodUsers = await prodDb.select().from(users);
    console.log(`[DB Sync] Found ${prodUsers.length} users in production`);

    for (const prodUser of prodUsers) {
      try {
        // Check if user exists in dev
        const [existingUser] = await devDb
          .select()
          .from(users)
          .where(eq(users.id, prodUser.id))
          .limit(1);

        if (existingUser) {
          // Check if dev user has production password hash (from old sync)
          const needsPasswordRemediation = existingUser.passwordHash === prodUser.passwordHash;
          
          // Update existing user (preserve dev password if different, remediate if same as prod)
          const updateData: any = {
            email: prodUser.email,
            firstName: prodUser.firstName,
            lastName: prodUser.lastName,
            isAdmin: prodUser.isAdmin,
            isSupervisor: prodUser.isSupervisor,
            supervisorId: prodUser.supervisorId,
            approvalStatus: prodUser.approvalStatus,
            approvedAt: prodUser.approvedAt,
            approvedBy: prodUser.approvedBy,
            lastLoginAt: prodUser.lastLoginAt,
            updatedAt: new Date(),
          };
          
          // Security remediation: Replace production password hash with unusable one
          if (needsPasswordRemediation) {
            const randomPassword = `REMEDIATED_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const bcrypt = await import('bcryptjs');
            updateData.passwordHash = await bcrypt.hash(randomPassword, 12);
            console.log(`[DB Sync] Remediating password for user: ${prodUser.email}`);
          }
          
          await devDb
            .update(users)
            .set(updateData)
            .where(eq(users.id, prodUser.id));

          result.usersUpdated++;
          console.log(`[DB Sync] Updated user: ${prodUser.email}`);
        } else {
          // Create new user - DO NOT copy password hash from production
          // Generate a random, unusable password hash for security
          const randomPassword = `SYNCED_FROM_PROD_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const bcrypt = await import('bcryptjs');
          const unusableHash = await bcrypt.hash(randomPassword, 12);
          
          await devDb.insert(users).values({
            id: prodUser.id,
            email: prodUser.email,
            firstName: prodUser.firstName,
            lastName: prodUser.lastName,
            passwordHash: unusableHash, // DO NOT use production password hash
            isAdmin: prodUser.isAdmin,
            isSupervisor: prodUser.isSupervisor,
            supervisorId: prodUser.supervisorId,
            approvalStatus: prodUser.approvalStatus,
            approvedAt: prodUser.approvedAt,
            approvedBy: prodUser.approvedBy,
            lastLoginAt: prodUser.lastLoginAt,
            createdAt: prodUser.createdAt,
            updatedAt: prodUser.updatedAt,
          });

          result.usersCreated++;
          console.log(`[DB Sync] Created user: ${prodUser.email} (with new dev-only password)`);
        }
      } catch (error) {
        const errorMsg = `Failed to sync user ${prodUser.email}: ${error.message}`;
        console.error(`[DB Sync] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // Step 2: Sync facilitators table
    console.log("[DB Sync] Fetching facilitators from production...");
    const prodFacilitators = await prodDb.select().from(facilitators);
    console.log(`[DB Sync] Found ${prodFacilitators.length} facilitators in production`);

    for (const prodFacilitator of prodFacilitators) {
      try {
        // Check if facilitator exists in dev
        const [existingFacilitator] = await devDb
          .select()
          .from(facilitators)
          .where(eq(facilitators.id, prodFacilitator.id))
          .limit(1);

        if (existingFacilitator) {
          // Update existing facilitator
          await devDb
            .update(facilitators)
            .set({
              userId: prodFacilitator.userId,
              currentLanguage: prodFacilitator.currentLanguage,
              currentProject: prodFacilitator.currentProject,
              totalLanguagesMentored: prodFacilitator.totalLanguagesMentored,
              totalChaptersMentored: prodFacilitator.totalChaptersMentored,
              updatedAt: new Date(),
            })
            .where(eq(facilitators.id, prodFacilitator.id));

          result.facilitatorsUpdated++;
          console.log(`[DB Sync] Updated facilitator for user: ${prodFacilitator.userId}`);
        } else {
          // Create new facilitator
          await devDb.insert(facilitators).values({
            id: prodFacilitator.id,
            userId: prodFacilitator.userId,
            currentLanguage: prodFacilitator.currentLanguage,
            currentProject: prodFacilitator.currentProject,
            totalLanguagesMentored: prodFacilitator.totalLanguagesMentored,
            totalChaptersMentored: prodFacilitator.totalChaptersMentored,
            createdAt: prodFacilitator.createdAt,
            updatedAt: prodFacilitator.updatedAt,
          });

          result.facilitatorsCreated++;
          console.log(`[DB Sync] Created facilitator for user: ${prodFacilitator.userId}`);
        }
      } catch (error) {
        const errorMsg = `Failed to sync facilitator ${prodFacilitator.id}: ${error.message}`;
        console.error(`[DB Sync] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    
    console.log("[DB Sync] Sync completed!");
    console.log(`[DB Sync] Users: ${result.usersCreated} created, ${result.usersUpdated} updated`);
    console.log(`[DB Sync] Facilitators: ${result.facilitatorsCreated} created, ${result.facilitatorsUpdated} updated`);
    
    if (result.errors.length > 0) {
      console.error(`[DB Sync] Encountered ${result.errors.length} errors during sync`);
    }

    return result;
  } catch (error) {
    console.error("[DB Sync] Fatal error during sync:", error);
    result.errors.push(`Fatal sync error: ${error.message}`);
    return result;
  }
}

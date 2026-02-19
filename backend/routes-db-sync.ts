import type { Express } from "express";
import { syncProductionToDevDatabase } from "./db-sync";
import { config } from "./config/index.js";

export function registerDbSyncRoutes(app: Express, requireAdmin: any, requireCSRFHeader: any) {
  
  app.post('/api/admin/db-sync/trigger', requireAdmin, requireCSRFHeader, async (req: any, res) => {
    try {
      console.log(`[DB Sync] Manual sync triggered by admin user: ${req.userId}`);
      
      const result = await syncProductionToDevDatabase();
      
      if (result.success) {
        res.json({
          success: true,
          message: "Database sync completed successfully",
          details: {
            usersCreated: result.usersCreated,
            usersUpdated: result.usersUpdated,
            facilitatorsCreated: result.facilitatorsCreated,
            facilitatorsUpdated: result.facilitatorsUpdated,
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Database sync completed with errors",
          details: {
            usersCreated: result.usersCreated,
            usersUpdated: result.usersUpdated,
            facilitatorsCreated: result.facilitatorsCreated,
            facilitatorsUpdated: result.facilitatorsUpdated,
          },
          errors: result.errors,
        });
      }
    } catch (error) {
      console.error("[DB Sync] Error triggering manual sync:", error);
      res.status(500).json({
        success: false,
        message: "Failed to trigger database sync",
        error: error.message
      });
    }
  });

  app.get('/api/admin/db-sync/status', requireAdmin, async (req: any, res) => {
    try {
      const { productionUrlConfigured, developmentUrlConfigured } = config.dbSync;
      
      res.json({
        configured: productionUrlConfigured && developmentUrlConfigured,
        productionConfigured: productionUrlConfigured,
        developmentConfigured: developmentUrlConfigured,
        syncDirection: "production → development (one-way only)",
        syncTables: ["users", "facilitators"],
        excludedTables: ["chats", "messages", "api_keys", "documents", "vector_memory"],
      });
    } catch (error) {
      console.error("[DB Sync] Error checking sync status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check sync status"
      });
    }
  });
}

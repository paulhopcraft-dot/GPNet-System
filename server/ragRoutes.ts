import { Router } from "express";
import { embeddingService } from "./embeddingService.js";
import { freshdeskRagBackfillService } from "./freshdeskRagBackfillService.js";
import { freshdeskRagSyncService } from "./freshdeskRagSyncService.js";
import { db } from "./db.js";
import { ticketMessages, ticketMessageEmbeddings } from "@shared/schema.js";
import { desc, eq } from "drizzle-orm";

const ragRoutes = Router();

/**
 * Get RAG system health status
 */
ragRoutes.get("/health", async (req, res) => {
  try {
    const [embeddingStats, syncStatus] = await Promise.all([
      embeddingService.getEmbeddingStats(),
      freshdeskRagSyncService.getStatus()
    ]);

    const health = {
      system: "Freshdesk RAG System",
      status: "healthy",
      timestamp: new Date(),
      stats: embeddingStats,
      sync: syncStatus,
      services: {
        embeddings: embeddingStats.totalMessages > 0 ? "active" : "no_data",
        freshdesk: process.env.FRESHDESK_API_KEY ? "configured" : "not_configured",
        openai: process.env.OPENAI_API_KEY || process.env.GPNET_OPENAI ? "configured" : "not_configured"
      }
    };

    res.json(health);
  } catch (error) {
    console.error("RAG health check failed:", error);
    res.status(500).json({
      system: "Freshdesk RAG System",
      status: "error",
      error: (error as Error).message,
      timestamp: new Date()
    });
  }
});

/**
 * Search similar messages using embeddings
 */
ragRoutes.post("/search", async (req, res) => {
  try {
    const { query, limit = 10, ticketId, excludePrivate = true } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: "Query parameter is required and must be a string"
      });
    }

    const results = await embeddingService.findSimilarMessages(
      query,
      parseInt(limit),
      ticketId,
      excludePrivate
    );

    res.json({
      query,
      results,
      count: results.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("RAG search failed:", error);
    res.status(500).json({
      error: "Search failed",
      details: (error as Error).message
    });
  }
});

/**
 * Get conversation context for a specific ticket
 */
ragRoutes.get("/ticket/:ticketId/context", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { limit = 20 } = req.query;

    const context = await embeddingService.getTicketConversationContext(
      ticketId,
      parseInt(limit as string)
    );

    res.json({
      ticketId,
      context,
      count: context.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Failed to get ticket context:", error);
    res.status(500).json({
      error: "Failed to retrieve ticket context",
      details: (error as Error).message
    });
  }
});

/**
 * Run manual sync operations
 */
ragRoutes.post("/sync", async (req, res) => {
  try {
    const { type = "incremental", months = 12 } = req.body;

    let result;
    if (type === "full") {
      result = await freshdeskRagSyncService.runFullBackfill(parseInt(months));
    } else {
      result = await freshdeskRagSyncService.runIncrementalSync();
    }

    res.json({
      type,
      status: "completed",
      result,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Manual sync failed:", error);
    res.status(500).json({
      error: "Sync operation failed",
      details: (error as Error).message
    });
  }
});

/**
 * Get sync job status
 */
ragRoutes.get("/sync/status", async (req, res) => {
  try {
    const status = freshdeskRagSyncService.getStatus();
    res.json(status);
  } catch (error) {
    console.error("Failed to get sync status:", error);
    res.status(500).json({
      error: "Failed to retrieve sync status",
      details: (error as Error).message
    });
  }
});

/**
 * Get recent messages (for debugging)
 */
ragRoutes.get("/messages/recent", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const messages = await db
      .select({
        id: ticketMessages.id,
        ticketId: ticketMessages.ticketId,
        authorRole: ticketMessages.authorRole,
        authorName: ticketMessages.authorName,
        bodyText: ticketMessages.bodyText,
        isPrivate: ticketMessages.isPrivate,
        createdAt: ticketMessages.createdAt,
        freshdeskCreatedAt: ticketMessages.freshdeskCreatedAt,
      })
      .from(ticketMessages)
      .orderBy(desc(ticketMessages.freshdeskCreatedAt))
      .limit(parseInt(limit as string));

    res.json({
      messages,
      count: messages.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Failed to get recent messages:", error);
    res.status(500).json({
      error: "Failed to retrieve recent messages",
      details: (error as Error).message
    });
  }
});

/**
 * Generate embedding for a specific message (for testing)
 */
ragRoutes.post("/messages/:messageId/embed", async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get the message
    const [message] = await db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({
        error: "Message not found"
      });
    }

    // Generate embedding
    const embeddingId = await embeddingService.storeMessageEmbedding(
      messageId,
      message.bodyText
    );

    if (!embeddingId) {
      return res.status(500).json({
        error: "Failed to generate embedding"
      });
    }

    res.json({
      messageId,
      embeddingId,
      status: "completed",
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Failed to generate embedding:", error);
    res.status(500).json({
      error: "Failed to generate embedding",
      details: (error as Error).message
    });
  }
});

/**
 * Delete RAG data (dangerous operation)
 */
ragRoutes.delete("/data", async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== "DELETE_ALL_RAG_DATA") {
      return res.status(400).json({
        error: "Confirmation required",
        required: "Send { confirm: 'DELETE_ALL_RAG_DATA' } to proceed"
      });
    }

    // Delete all embeddings first (due to foreign key constraints)
    await db.delete(ticketMessageEmbeddings);
    
    // Delete all messages
    await db.delete(ticketMessages);

    res.json({
      status: "completed",
      deleted: {
        embeddings: "all",
        messages: "all"
      },
      timestamp: new Date(),
      warning: "All RAG data has been permanently deleted"
    });

  } catch (error) {
    console.error("Failed to delete RAG data:", error);
    res.status(500).json({
      error: "Failed to delete RAG data",
      details: (error as Error).message
    });
  }
});

/**
 * Admin endpoint: Trigger historical backfill of Freshdesk conversations
 */
ragRoutes.post("/admin/backfill", async (req, res) => {
  try {
    const { months = 12, dryRun = false } = req.body;

    console.log(`🚀 Starting admin-triggered backfill: ${months} months, dryRun: ${dryRun}`);

    const result = await freshdeskRagBackfillService.backfillConversations({
      months: parseInt(months),
      batchSize: 5, // Smaller batches for admin UI
      includePrivateNotes: true,
      generateEmbeddings: true,
      dryRun: Boolean(dryRun)
    });

    res.json({
      status: "completed",
      progress: result,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Admin backfill failed:", error);
    res.status(500).json({
      error: "Backfill operation failed",
      details: (error as Error).message,
      timestamp: new Date()
    });
  }
});

export default ragRoutes;
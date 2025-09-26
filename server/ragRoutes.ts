import { Router } from "express";
import { embeddingService } from "./embeddingService.js";
import { freshdeskRagBackfillService } from "./freshdeskRagBackfillService.js";
import { freshdeskRagSyncService } from "./freshdeskRagSyncService.js";
import { freshdeskService } from "./freshdeskService.js";
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
 * Debug endpoint: Check Freshdesk configuration
 */
ragRoutes.get("/admin/freshdesk-debug", async (req, res) => {
  try {
    const apiKey = process.env.FRESHDESK_API_KEY;
    const domain = process.env.FRESHDESK_DOMAIN;
    
    res.json({
      apiKeyExists: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'not found',
      domain: domain || 'not found',
      baseUrl: domain ? `https://${domain}.freshdesk.com/api/v2` : 'domain missing',
      isAvailable: freshdeskService.isAvailable(),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      error: "Debug failed",
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

/**
 * Admin endpoint: Populate sample conversation data for demo
 */
ragRoutes.post("/admin/populate-sample-data", async (req, res) => {
  try {
    console.log("🚀 Starting sample data population for Michelle's knowledge base...");

    // Sample conversations representing typical pre-employment health check scenarios
    // Using real ticket IDs from database
    const sampleConversations = [
      {
        ticketId: "fe8c5aea-2378-4e84-9987-d1cb402f8ae2",
        authorRole: "agent",
        authorName: "Sarah Wilson",
        bodyText: "Good morning! I've reviewed your pre-employment health assessment. Your lifting capacity test shows you can safely lift up to 25kg. However, you mentioned a previous back injury in 2023. Can you provide more details about any current limitations or treatments?",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-20T09:15:00Z")
      },
      {
        ticketId: "fe8c5aea-2378-4e84-9987-d1cb402f8ae2", 
        authorRole: "customer",
        authorName: "John Smith",
        bodyText: "Hi Sarah, thanks for getting back to me. The back injury was a herniated disc L4-L5. I had physiotherapy for 3 months and it's much better now. I can lift and carry normally but I do notice some stiffness after sitting for long periods. The role involves some warehouse work - will this be an issue?",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-20T14:30:00Z")
      },
      {
        ticketId: "fe8c5aea-2378-4e84-9987-d1cb402f8ae2",
        authorRole: "agent", 
        authorName: "Sarah Wilson",
        bodyText: "Thank you for the additional information. Based on your assessment and history, I'm classifying you as 'Fit with Restrictions'. You're suitable for the warehouse role with the following recommendations: 1) Take regular breaks every 2 hours to stretch, 2) Use proper lifting techniques, 3) Avoid prolonged static postures. The employer will be advised to provide ergonomic support.",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-20T16:45:00Z")
      },
      {
        ticketId: "a82b7c56-0179-48f0-bb1e-c6456c802d9e",
        authorRole: "customer",
        authorName: "Maria Rodriguez", 
        bodyText: "I'm concerned about my health assessment results. The report mentions I have elevated blood pressure readings during the medical exam. I take medication for hypertension and it's usually well controlled. Will this prevent me from getting the job in construction?",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-18T10:20:00Z")
      },
      {
        ticketId: "a82b7c56-0179-48f0-bb1e-c6456c802d9e",
        authorRole: "agent",
        authorName: "Dr. Michael Chen",
        bodyText: "Hello Maria, I understand your concern. Controlled hypertension with medication is very common and typically doesn't disqualify candidates for construction work. Your BP readings were 145/92 during assessment, which is borderline. Can you please provide: 1) Your current medication details, 2) Recent BP readings from your GP, 3) Any symptoms like dizziness or chest pain during physical activity?",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-18T15:30:00Z")
      },
      {
        ticketId: "a82b7c56-0179-48f0-bb1e-c6456c802d9e",
        authorRole: "customer", 
        authorName: "Maria Rodriguez",
        bodyText: "I take Amlodipine 5mg daily. My home readings are usually around 130/85. I had some stress about the assessment which might have elevated it. No dizziness or chest pain during exercise. I walk 5km daily and feel fine. Can provide GP letter if needed.",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-18T17:15:00Z")
      },
      {
        ticketId: "a82b7c56-0179-48f0-bb1e-c6456c802d9e",
        authorRole: "agent",
        authorName: "Dr. Michael Chen",
        bodyText: "Perfect, Maria. Your well-controlled hypertension and excellent exercise tolerance indicate you're suitable for construction work. I'm classifying you as 'Fit' with a recommendation for 6-monthly BP monitoring through occupational health. The stress factor during assessment explains the elevated reading. No restrictions needed for your role.",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-19T09:00:00Z")
      },
      {
        ticketId: "f84a5639-3240-4756-ba30-2f5dd198da38",
        authorRole: "agent",
        authorName: "Dr. Lisa Patterson",
        bodyText: "I'm writing regarding your pre-employment psychological screening. The questionnaire indicates some concerns about work-related stress and anxiety. This is confidential information, but I need to understand if you require any workplace adjustments or support for mental health to ensure your wellbeing in this customer service role.",
        isPrivate: true,
        freshdeskCreatedAt: new Date("2024-09-22T11:00:00Z")
      },
      {
        ticketId: "f84a5639-3240-4756-ba30-2f5dd198da38",
        authorRole: "customer",
        authorName: "James Mitchell",
        bodyText: "Thank you for reaching out confidentially. I've had anxiety issues in the past, particularly in high-pressure environments. I'm currently seeing a counselor and take medication (sertraline 50mg). I'm much better now but I do worry about handling difficult customers or meeting strict targets. Are there accommodations that might help?",
        isPrivate: true,
        freshdeskCreatedAt: new Date("2024-09-22T16:20:00Z")
      },
      {
        ticketId: "f84a5639-3240-4756-ba30-2f5dd198da38",
        authorRole: "agent",
        authorName: "Dr. Lisa Patterson", 
        bodyText: "Thank you for your openness, James. Your proactive approach to mental health management is commendable. I'm recommending you as 'Fit with Restrictions' with the following workplace adjustments: 1) Gradual introduction to customer interactions, 2) Access to quiet break area, 3) Flexible break timing during busy periods, 4) Regular check-ins with supervisor. These are reasonable adjustments under disability legislation.",
        isPrivate: true,
        freshdeskCreatedAt: new Date("2024-09-23T10:30:00Z")
      },
      {
        ticketId: "7b05c7b2-468d-479f-a5c0-5f2625a1a24f",
        authorRole: "customer",
        authorName: "David Thompson",
        bodyText: "I need clarification on my medical clearance. The audiometry test showed some hearing loss in my left ear. I work around machinery and thought my hearing was fine. What does this mean for my job as a machine operator? Do I need hearing aids?",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-21T13:45:00Z")
      },
      {
        ticketId: "7b05c7b2-468d-479f-a5c0-5f2625a1a24f",
        authorRole: "agent",
        authorName: "Sarah Wilson",
        bodyText: "Hi David, your audiometry shows mild to moderate hearing loss in the left ear (40dB loss at higher frequencies). For machine operator roles, this needs careful assessment. The main concerns are: 1) Ability to hear warning signals, 2) Communication with colleagues, 3) Further hearing protection needs. I'm arranging a specialist occupational audiologist review before making final recommendations.",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-21T17:20:00Z")
      },
      {
        ticketId: "dde192d7-53f6-4535-bce8-5a462e0ffc37",
        authorRole: "agent",
        authorName: "Dr. Michael Chen", 
        bodyText: "Following up on your pre-employment medical. Your vision screening flagged some concerns with depth perception and peripheral vision. Given you're applying for a driving role, I need additional information about your driving history and any visual aids you currently use.",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-19T08:30:00Z")
      },
      {
        ticketId: "dde192d7-53f6-4535-bce8-5a462e0ffc37",
        authorRole: "customer",
        authorName: "Emma Johnson",
        bodyText: "I wear glasses for distance vision and have done for 10 years. My optician said my prescription is stable. I've been driving professionally for 3 years with no accidents or issues. I wasn't aware of any depth perception problems. Should I get my eyes checked again before starting?",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-19T12:15:00Z")
      },
      {
        ticketId: "dde192d7-53f6-4535-bce8-5a462e0ffc37",
        authorRole: "agent",
        authorName: "Dr. Michael Chen",
        bodyText: "Emma, your driving experience is reassuring. The depth perception issue was borderline on our screening. Given your clean driving record, I'm classifying you as 'Fit' but recommend: 1) Annual vision screening, 2) Ensure glasses are always worn while driving, 3) Report any vision changes immediately. Your employer will be advised of the annual screening requirement.",
        isPrivate: false,
        freshdeskCreatedAt: new Date("2024-09-19T15:45:00Z")
      }
    ];

    // Insert sample messages into database
    let insertedCount = 0;
    for (const conversation of sampleConversations) {
      try {
        // Insert message
        const [message] = await db
          .insert(ticketMessages)
          .values({
            id: crypto.randomUUID(),
            ticketId: conversation.ticketId,
            authorRole: conversation.authorRole,
            authorName: conversation.authorName,
            bodyText: conversation.bodyText,
            isPrivate: conversation.isPrivate,
            freshdeskCreatedAt: conversation.freshdeskCreatedAt,
            createdAt: new Date()
          })
          .returning();

        // Generate embedding for the message
        if (message) {
          await embeddingService.storeMessageEmbedding(message.id, message.bodyText);
          insertedCount++;
        }
      } catch (error) {
        console.error("Failed to insert sample conversation:", error);
      }
    }

    console.log(`✅ Successfully populated ${insertedCount} sample conversations with embeddings`);

    res.json({
      status: "completed",
      inserted: insertedCount,
      total: sampleConversations.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Sample data population failed:", error);
    res.status(500).json({
      error: "Sample data population failed",
      details: (error as Error).message,
      timestamp: new Date()
    });
  }
});

export default ragRoutes;
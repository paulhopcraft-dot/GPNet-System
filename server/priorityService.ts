import { db } from "./db";
import { tickets, analyses, emails, externalEmails, workers } from "@shared/schema";
import { eq, and, gt, gte, desc, sql } from "drizzle-orm";

/**
 * Priority Service - Calculates priority scores and levels for cases
 * 
 * Scoring Rules:
 * - Start at 0
 * - +50 if any Red flag (ragScore === 'red' from analyses table, or flagRedCount > 0)
 * - +30 if SLA due within 24h; +15 if within 72h
 * - +20 if new message from worker in last 24h with negative sentiment
 * - +10 if manager has not viewed last update within 48h
 * 
 * Priority Levels:
 * - >= 60: "High"
 * - 30-59: "Medium"
 * - < 30: "Low"
 */

interface PriorityResult {
  score: number;
  level: string;
}

/**
 * Calculate priority score for a specific ticket
 */
export async function calculatePriorityScore(ticketId: string): Promise<PriorityResult> {
  try {
    let score = 0;
    const now = new Date();

    // Get ticket data
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
    });

    if (!ticket) {
      console.warn(`[Priority Service] Ticket not found: ${ticketId}`);
      return { score: 0, level: "Low" };
    }

    // 1. Check for Red flags (+50 points)
    // Check flagRedCount directly on ticket
    if (ticket.flagRedCount && ticket.flagRedCount > 0) {
      score += 50;
      console.log(`[Priority Service] ${ticketId}: +50 (flagRedCount=${ticket.flagRedCount})`);
    } else {
      // Also check analyses table for ragScore === 'red'
      const analysis = await db.query.analyses.findFirst({
        where: eq(analyses.ticketId, ticketId),
        orderBy: [desc(analyses.lastAssessedAt)],
      });

      if (analysis && analysis.ragScore === 'red') {
        score += 50;
        console.log(`[Priority Service] ${ticketId}: +50 (ragScore=red)`);
      }
    }

    // 2. Check SLA due date (+30 if within 24h, +15 if within 72h)
    if (ticket.slaDueAt) {
      const slaDate = new Date(ticket.slaDueAt);
      const hoursUntilSla = (slaDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilSla <= 24 && hoursUntilSla > 0) {
        score += 30;
        console.log(`[Priority Service] ${ticketId}: +30 (SLA due in ${hoursUntilSla.toFixed(1)}h)`);
      } else if (hoursUntilSla <= 72 && hoursUntilSla > 0) {
        score += 15;
        console.log(`[Priority Service] ${ticketId}: +15 (SLA due in ${hoursUntilSla.toFixed(1)}h)`);
      }
    }

    // 3. Check for recent worker messages with negative sentiment (+20 points)
    // Since sentiment is not stored in the schema, we'll check for worker emails with high urgency
    // or from externalEmails with urgencyLevel 'high' or 'critical'
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get worker info to identify worker emails
    const worker = ticket.workerId ? await db.query.workers.findFirst({
      where: eq(workers.id, ticket.workerId),
    }) : null;

    if (worker) {
      // Check emails table for recent worker messages
      const recentWorkerEmails = await db.query.emails.findMany({
        where: and(
          eq(emails.ticketId, ticketId),
          gte(emails.sentAt, twentyFourHoursAgo),
          eq(emails.senderEmail, worker.email)
        ),
        limit: 5,
      });

      if (recentWorkerEmails.length > 0) {
        // Check for negative indicators in email content (simple heuristic)
        const hasNegativeContent = recentWorkerEmails.some(email => {
          const body = email.body.toLowerCase();
          const negativeKeywords = [
            'pain', 'worse', 'cannot', 'unable', 'difficult', 'struggle',
            'concern', 'worried', 'anxious', 'stress', 'urgent', 'emergency',
            'help', 'problem', 'issue'
          ];
          return negativeKeywords.some(keyword => body.includes(keyword));
        });

        if (hasNegativeContent) {
          score += 20;
          console.log(`[Priority Service] ${ticketId}: +20 (recent worker message with negative indicators)`);
        }
      }
    }

    // Also check externalEmails for high urgency worker messages
    const recentExternalEmails = await db.query.externalEmails.findMany({
      where: and(
        eq(externalEmails.ticketId, ticketId),
        gte(externalEmails.forwardedAt, twentyFourHoursAgo)
      ),
      limit: 5,
    });

    const hasUrgentWorkerEmail = recentExternalEmails.some(email => {
      // Check if sender is the worker and urgency is high/critical
      if (worker && email.originalSender === worker.email) {
        return email.urgencyLevel === 'high' || email.urgencyLevel === 'critical';
      }
      return false;
    });

    if (hasUrgentWorkerEmail && score < 20) { // Don't double-count
      score += 20;
      console.log(`[Priority Service] ${ticketId}: +20 (urgent external email from worker)`);
    }

    // 4. Check if manager has viewed last update within 48h (+10 points)
    // This requires tracking manager views - for now we'll check lastUpdateAt
    // If lastUpdateAt is more than 48h ago without status change, it needs attention
    if (ticket.lastUpdateAt) {
      const lastUpdate = new Date(ticket.lastUpdateAt);
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate >= 48) {
        score += 10;
        console.log(`[Priority Service] ${ticketId}: +10 (no manager view for ${hoursSinceUpdate.toFixed(1)}h)`);
      }
    }

    // Determine priority level based on score
    let level = "Low";
    if (score >= 60) {
      level = "High";
    } else if (score >= 30) {
      level = "Medium";
    }

    console.log(`[Priority Service] ${ticketId}: Final score=${score}, level=${level}`);

    return { score, level };
  } catch (error) {
    console.error(`[Priority Service] Error calculating priority for ticket ${ticketId}:`, error);
    // Return default values on error
    return { score: 0, level: "Low" };
  }
}

/**
 * Update a ticket's priority score and level
 */
export async function updateTicketPriority(ticketId: string): Promise<void> {
  try {
    const { score, level } = await calculatePriorityScore(ticketId);

    await db
      .update(tickets)
      .set({
        priorityScore: score,
        priorityLevel: level,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    console.log(`[Priority Service] Updated ticket ${ticketId}: score=${score}, level=${level}`);
  } catch (error) {
    console.error(`[Priority Service] Error updating priority for ticket ${ticketId}:`, error);
    throw error;
  }
}

/**
 * Batch update priorities for all tickets
 */
export async function updateAllPriorities(): Promise<void> {
  try {
    console.log("[Priority Service] Starting batch priority update for all tickets...");

    // Get all tickets
    const allTickets = await db.query.tickets.findMany();

    console.log(`[Priority Service] Found ${allTickets.length} tickets to process`);

    let successCount = 0;
    let errorCount = 0;

    // Process each ticket
    for (const ticket of allTickets) {
      try {
        await updateTicketPriority(ticket.id);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`[Priority Service] Failed to update ticket ${ticket.id}:`, error);
      }
    }

    console.log(
      `[Priority Service] Batch update complete: ${successCount} successful, ${errorCount} errors`
    );
  } catch (error) {
    console.error("[Priority Service] Error in batch priority update:", error);
    throw error;
  }
}

/**
 * Update priorities for tickets in a specific organization
 */
export async function updatePrioritiesForOrganization(organizationId: string): Promise<void> {
  try {
    console.log(`[Priority Service] Starting priority update for organization ${organizationId}...`);

    // Get tickets for this organization
    const orgTickets = await db.query.tickets.findMany({
      where: eq(tickets.organizationId, organizationId),
    });

    console.log(`[Priority Service] Found ${orgTickets.length} tickets for organization ${organizationId}`);

    let successCount = 0;
    let errorCount = 0;

    for (const ticket of orgTickets) {
      try {
        await updateTicketPriority(ticket.id);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`[Priority Service] Failed to update ticket ${ticket.id}:`, error);
      }
    }

    console.log(
      `[Priority Service] Organization update complete: ${successCount} successful, ${errorCount} errors`
    );
  } catch (error) {
    console.error(`[Priority Service] Error updating priorities for organization ${organizationId}:`, error);
    throw error;
  }
}

/**
 * Get priority statistics across all tickets
 */
export async function getPriorityStats(): Promise<{
  high: number;
  medium: number;
  low: number;
  total: number;
}> {
  try {
    const allTickets = await db.query.tickets.findMany();

    const stats = {
      high: allTickets.filter(t => t.priorityLevel === "High").length,
      medium: allTickets.filter(t => t.priorityLevel === "Medium").length,
      low: allTickets.filter(t => t.priorityLevel === "Low").length,
      total: allTickets.length,
    };

    return stats;
  } catch (error) {
    console.error("[Priority Service] Error getting priority stats:", error);
    return { high: 0, medium: 0, low: 0, total: 0 };
  }
}

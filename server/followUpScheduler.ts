import { db } from "./db";
import { tickets, workers, formSubmissions } from "@shared/schema";
import { eq, and, lt, ne, gt, lte, gte, isNull, inArray } from "drizzle-orm";
import { EmailService } from "./emailService";

export interface FollowUpScheduler {
  start(): void;
  stop(): void;
  checkAndSendFollowUps(): Promise<void>;
}

export class AutomatedFollowUpScheduler implements FollowUpScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private emailService: EmailService;
  
  // Check every hour for pending follow-ups
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  
  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  start(): void {
    if (this.intervalId) {
      return; // Already running
    }
    
    console.log("Starting automated follow-up scheduler...");
    this.intervalId = setInterval(() => {
      this.checkAndSendFollowUps().catch(error => {
        console.error("Error in follow-up scheduler:", error);
      });
    }, this.CHECK_INTERVAL);
    
    // Run immediately on start
    this.checkAndSendFollowUps().catch(error => {
      console.error("Error in initial follow-up check:", error);
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Stopped automated follow-up scheduler");
    }
  }

  async checkAndSendFollowUps(): Promise<void> {
    console.log("Checking for pending follow-up notifications...");
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    try {
      // Find tickets that need 24-hour follow-ups
      await this.send24HourFollowUps(twentyFourHoursAgo);
      
      // Find tickets that need day 3 follow-ups
      await this.sendDay3FollowUps(threeDaysAgo);
      
    } catch (error) {
      console.error("Error checking follow-ups:", error);
    }
  }

  private async send24HourFollowUps(twentyFourHoursAgo: Date): Promise<void> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    // Find tickets created 24-72 hours ago where workers haven't submitted forms yet
    const pendingTickets = await db
      .select({
        ticket: tickets,
        worker: workers
      })
      .from(tickets)
      .innerJoin(workers, eq(tickets.workerId, workers.id))
      .leftJoin(formSubmissions, eq(formSubmissions.ticketId, tickets.id))
      .where(
        and(
          // Created between 24-72 hours ago (avoid overlap with day 3)
          lte(tickets.createdAt, twentyFourHoursAgo),
          gte(tickets.createdAt, threeDaysAgo),
          // Worker hasn't submitted a form yet
          isNull(formSubmissions.id),
          // Status indicates awaiting worker submission (not internal review)
          inArray(tickets.status, ["NEW", "INVITED"]),
          // Only send if we haven't already sent a 24hr follow-up
          eq(tickets.followUp24hrSent, false)
        )
      );

    console.log(`Found ${pendingTickets.length} tickets needing 24-hour follow-ups`);

    for (const { ticket, worker } of pendingTickets) {
      try {
        const result = await this.emailService.send24HourFollowUp(
          worker.email,
          `${worker.firstName} ${worker.lastName}`,
          ticket.id,
          ticket.formType || 'Health Check'
        );

        if (result.success) {
          // Mark as sent to avoid duplicate notifications
          await db
            .update(tickets)
            .set({ 
              followUp24hrSent: true,
              updatedAt: new Date()
            })
            .where(eq(tickets.id, ticket.id));
          
          console.log(`Sent 24-hour follow-up for ticket ${ticket.id} to ${worker.email}`);
        } else {
          console.error(`Failed to send 24-hour follow-up for ticket ${ticket.id}:`, result.error);
        }
      } catch (error) {
        console.error(`Error sending 24-hour follow-up for ticket ${ticket.id}:`, error);
      }
    }
  }

  private async sendDay3FollowUps(threeDaysAgo: Date): Promise<void> {
    // Find tickets created 3+ days ago where workers still haven't submitted forms
    const pendingTickets = await db
      .select({
        ticket: tickets,
        worker: workers
      })
      .from(tickets)
      .innerJoin(workers, eq(tickets.workerId, workers.id))
      .leftJoin(formSubmissions, eq(formSubmissions.ticketId, tickets.id))
      .where(
        and(
          // Created 3+ days ago
          lte(tickets.createdAt, threeDaysAgo),
          // Worker hasn't submitted a form yet
          isNull(formSubmissions.id),
          // Status indicates awaiting worker submission (not internal review)
          inArray(tickets.status, ["NEW", "INVITED"]),
          // Only send if we haven't already sent a day 3 follow-up
          eq(tickets.followUpDay3Sent, false),
          // Ensure 24hr follow-up was sent first (optional sequencing)
          eq(tickets.followUp24hrSent, true)
        )
      );

    console.log(`Found ${pendingTickets.length} tickets needing day 3 follow-ups`);

    for (const { ticket, worker } of pendingTickets) {
      try {
        const result = await this.emailService.sendDay3FollowUp(
          worker.email,
          `${worker.firstName} ${worker.lastName}`,
          ticket.id,
          ticket.formType || 'Health Check'
        );

        if (result.success) {
          // Mark as sent to avoid duplicate notifications
          await db
            .update(tickets)
            .set({ 
              followUpDay3Sent: true,
              updatedAt: new Date()
            })
            .where(eq(tickets.id, ticket.id));
          
          console.log(`Sent day 3 follow-up for ticket ${ticket.id} to ${worker.email}`);
        } else {
          console.error(`Failed to send day 3 follow-up for ticket ${ticket.id}:`, result.error);
        }
      } catch (error) {
        console.error(`Error sending day 3 follow-up for ticket ${ticket.id}:`, error);
      }
    }
  }
}

// Create singleton instance
let followUpScheduler: AutomatedFollowUpScheduler | null = null;

export function createFollowUpScheduler(emailService: EmailService): AutomatedFollowUpScheduler {
  if (!followUpScheduler) {
    followUpScheduler = new AutomatedFollowUpScheduler(emailService);
  }
  return followUpScheduler;
}

export { followUpScheduler };
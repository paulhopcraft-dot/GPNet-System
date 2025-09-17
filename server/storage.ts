import { 
  tickets, workers, formSubmissions, analyses, emails, attachments,
  type Ticket, type Worker, type FormSubmission, type Analysis, type Email, type Attachment,
  type InsertTicket, type InsertWorker, type InsertFormSubmission, type InsertAnalysis
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Storage interface for GPNet operations
export interface IStorage {
  // Tickets
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getAllTickets(): Promise<Ticket[]>;
  updateTicketStatus(id: string, status: string): Promise<Ticket>;
  
  // Workers
  createWorker(worker: InsertWorker): Promise<Worker>;
  getWorker(id: string): Promise<Worker | undefined>;
  
  // Form Submissions
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  getFormSubmissionByTicket(ticketId: string): Promise<FormSubmission | undefined>;
  
  // Analyses
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysisByTicket(ticketId: string): Promise<Analysis | undefined>;
  updateAnalysis(ticketId: string, updates: Partial<InsertAnalysis>): Promise<Analysis>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    total: number;
    new: number;
    inProgress: number;
    awaiting: number;
    complete: number;
    flagged: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Tickets
  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const [ticket] = await db
      .insert(tickets)
      .values(insertTicket)
      .returning();
    return ticket;
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket || undefined;
  }

  async getAllTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async updateTicketStatus(id: string, status: string): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  // Workers
  async createWorker(insertWorker: InsertWorker): Promise<Worker> {
    const [worker] = await db
      .insert(workers)
      .values(insertWorker)
      .returning();
    return worker;
  }

  async getWorker(id: string): Promise<Worker | undefined> {
    const [worker] = await db.select().from(workers).where(eq(workers.id, id));
    return worker || undefined;
  }

  // Form Submissions
  async createFormSubmission(insertSubmission: InsertFormSubmission): Promise<FormSubmission> {
    const [submission] = await db
      .insert(formSubmissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getFormSubmissionByTicket(ticketId: string): Promise<FormSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.ticketId, ticketId));
    return submission || undefined;
  }

  // Analyses
  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const [analysis] = await db
      .insert(analyses)
      .values(insertAnalysis)
      .returning();
    return analysis;
  }

  async getAnalysisByTicket(ticketId: string): Promise<Analysis | undefined> {
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.ticketId, ticketId));
    return analysis || undefined;
  }

  async updateAnalysis(ticketId: string, updates: Partial<InsertAnalysis>): Promise<Analysis> {
    const [analysis] = await db
      .update(analyses)
      .set(updates)
      .where(eq(analyses.ticketId, ticketId))
      .returning();
    return analysis;
  }

  // Dashboard stats
  async getDashboardStats() {
    const allTickets = await this.getAllTickets();
    
    const stats = {
      total: allTickets.length,
      new: allTickets.filter(t => t.status === 'NEW').length,
      inProgress: allTickets.filter(t => t.status === 'ANALYSING').length,
      awaiting: allTickets.filter(t => t.status === 'AWAITING_REVIEW').length,
      complete: allTickets.filter(t => t.status === 'COMPLETE').length,
      flagged: 0, // Will be calculated from RAG scores later
    };

    return stats;
  }
}

export const storage = new DatabaseStorage();

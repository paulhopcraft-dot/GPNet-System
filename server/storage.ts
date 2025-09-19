import { 
  tickets, workers, formSubmissions, analyses, emails, attachments,
  injuries, stakeholders, rtwPlans,
  type Ticket, type Worker, type FormSubmission, type Analysis, type Email, type Attachment,
  type Injury, type Stakeholder, type RtwPlan,
  type InsertTicket, type InsertWorker, type InsertFormSubmission, type InsertAnalysis,
  type InsertInjury, type InsertStakeholder, type InsertRtwPlan
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
  
  // Injuries
  createInjury(injury: InsertInjury): Promise<Injury>;
  getInjuryByTicket(ticketId: string): Promise<Injury | undefined>;
  
  // Stakeholders
  createStakeholder(stakeholder: InsertStakeholder): Promise<Stakeholder>;
  getStakeholder(id: string): Promise<Stakeholder | undefined>;
  getStakeholdersByTicket(ticketId: string): Promise<Stakeholder[]>;
  updateStakeholder(id: string, updates: Partial<InsertStakeholder>): Promise<Stakeholder>;
  deleteStakeholder(id: string): Promise<void>;
  
  // RTW Plans
  createRtwPlan(plan: InsertRtwPlan): Promise<RtwPlan>;
  getRtwPlan(id: string): Promise<RtwPlan | undefined>;
  getRtwPlansByTicket(ticketId: string): Promise<RtwPlan[]>;
  updateRtwPlan(id: string, updates: Partial<InsertRtwPlan>): Promise<RtwPlan>;
  updateRtwPlanStatus(id: string, status: string): Promise<RtwPlan>;
  deleteRtwPlan(id: string): Promise<void>;
  
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

  // Injuries
  async createInjury(insertInjury: InsertInjury): Promise<Injury> {
    const [injury] = await db
      .insert(injuries)
      .values(insertInjury)
      .returning();
    return injury;
  }

  async getInjuryByTicket(ticketId: string): Promise<Injury | undefined> {
    const [injury] = await db
      .select()
      .from(injuries)
      .where(eq(injuries.ticketId, ticketId));
    return injury || undefined;
  }

  // Stakeholders
  async createStakeholder(insertStakeholder: InsertStakeholder): Promise<Stakeholder> {
    const [stakeholder] = await db
      .insert(stakeholders)
      .values(insertStakeholder)
      .returning();
    return stakeholder;
  }

  async getStakeholder(id: string): Promise<Stakeholder | undefined> {
    const [stakeholder] = await db
      .select()
      .from(stakeholders)
      .where(eq(stakeholders.id, id));
    return stakeholder || undefined;
  }

  async getStakeholdersByTicket(ticketId: string): Promise<Stakeholder[]> {
    return await db
      .select()
      .from(stakeholders)
      .where(eq(stakeholders.ticketId, ticketId))
      .orderBy(desc(stakeholders.createdAt));
  }

  async updateStakeholder(id: string, updates: Partial<InsertStakeholder>): Promise<Stakeholder> {
    const [stakeholder] = await db
      .update(stakeholders)
      .set(updates)
      .where(eq(stakeholders.id, id))
      .returning();
    return stakeholder;
  }

  async deleteStakeholder(id: string): Promise<void> {
    await db
      .delete(stakeholders)
      .where(eq(stakeholders.id, id));
  }

  // RTW Plans
  async createRtwPlan(insertPlan: InsertRtwPlan): Promise<RtwPlan> {
    const [plan] = await db
      .insert(rtwPlans)
      .values(insertPlan)
      .returning();
    return plan;
  }

  async getRtwPlan(id: string): Promise<RtwPlan | undefined> {
    const [plan] = await db
      .select()
      .from(rtwPlans)
      .where(eq(rtwPlans.id, id));
    return plan || undefined;
  }

  async getRtwPlansByTicket(ticketId: string): Promise<RtwPlan[]> {
    return await db
      .select()
      .from(rtwPlans)
      .where(eq(rtwPlans.ticketId, ticketId))
      .orderBy(desc(rtwPlans.createdAt));
  }

  async updateRtwPlan(id: string, updates: Partial<InsertRtwPlan>): Promise<RtwPlan> {
    const [plan] = await db
      .update(rtwPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rtwPlans.id, id))
      .returning();
    return plan;
  }

  async updateRtwPlanStatus(id: string, status: string): Promise<RtwPlan> {
    const [plan] = await db
      .update(rtwPlans)
      .set({ status, updatedAt: new Date() })
      .where(eq(rtwPlans.id, id))
      .returning();
    return plan;
  }

  async deleteRtwPlan(id: string): Promise<void> {
    await db
      .delete(rtwPlans)
      .where(eq(rtwPlans.id, id));
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

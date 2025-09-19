import { 
  tickets, workers, formSubmissions, analyses, emails, attachments,
  injuries, stakeholders, rtwPlans,
  legislationDocuments, rtwWorkflowSteps, complianceAudit, workerParticipationEvents,
  letterTemplates, generatedLetters,
  type Ticket, type Worker, type FormSubmission, type Analysis, type Email, type Attachment,
  type Injury, type Stakeholder, type RtwPlan,
  type LegislationDocument, type RtwWorkflowStep, type ComplianceAudit, type WorkerParticipationEvent,
  type LetterTemplate, type GeneratedLetter,
  type InsertTicket, type InsertWorker, type InsertFormSubmission, type InsertAnalysis,
  type InsertInjury, type InsertStakeholder, type InsertRtwPlan,
  type InsertLegislationDocument, type InsertRtwWorkflowStep, type InsertComplianceAudit,
  type InsertWorkerParticipationEvent, type InsertLetterTemplate, type InsertGeneratedLetter
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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

  // ===============================================
  // RTW COMPLEX CLAIMS - LEGISLATION COMPLIANCE
  // ===============================================

  // Legislation Documents
  createLegislationDocument(document: InsertLegislationDocument): Promise<LegislationDocument>;
  getLegislationDocument(id: string): Promise<LegislationDocument | undefined>;
  getLegislationBySourceAndSection(source: string, sectionId: string): Promise<LegislationDocument | undefined>;
  getLegislationBySource(source: string): Promise<LegislationDocument[]>;
  getAllLegislation(): Promise<LegislationDocument[]>;

  // RTW Workflow Steps
  createRtwWorkflowStep(step: InsertRtwWorkflowStep): Promise<RtwWorkflowStep>;
  getRtwWorkflowStep(id: string): Promise<RtwWorkflowStep | undefined>;
  getRtwWorkflowStepsByTicket(ticketId: string): Promise<RtwWorkflowStep[]>;
  getCurrentRtwStep(ticketId: string): Promise<RtwWorkflowStep | undefined>;
  updateRtwWorkflowStep(id: string, updates: Partial<InsertRtwWorkflowStep>): Promise<RtwWorkflowStep>;

  // Compliance Audit
  createComplianceAudit(audit: InsertComplianceAudit): Promise<ComplianceAudit>;
  getComplianceAuditByTicket(ticketId: string): Promise<ComplianceAudit[]>;
  getComplianceAuditById(id: string): Promise<ComplianceAudit | undefined>;

  // Worker Participation Events
  createWorkerParticipationEvent(event: InsertWorkerParticipationEvent): Promise<WorkerParticipationEvent>;
  getWorkerParticipationEventsByTicket(ticketId: string): Promise<WorkerParticipationEvent[]>;
  getWorkerParticipationEventsByStep(workflowStepId: string): Promise<WorkerParticipationEvent[]>;
  updateWorkerParticipationEvent(id: string, updates: Partial<InsertWorkerParticipationEvent>): Promise<WorkerParticipationEvent>;

  // Letter Templates
  createLetterTemplate(template: InsertLetterTemplate): Promise<LetterTemplate>;
  getLetterTemplate(id: string): Promise<LetterTemplate | undefined>;
  getLetterTemplateByName(name: string): Promise<LetterTemplate | undefined>;
  getAllLetterTemplates(): Promise<LetterTemplate[]>;
  getLetterTemplatesByType(templateType: string): Promise<LetterTemplate[]>;

  // Generated Letters
  createGeneratedLetter(letter: InsertGeneratedLetter): Promise<GeneratedLetter>;
  getGeneratedLetter(id: string): Promise<GeneratedLetter | undefined>;
  getGeneratedLettersByTicket(ticketId: string): Promise<GeneratedLetter[]>;
  updateGeneratedLetterStatus(id: string, status: string): Promise<GeneratedLetter>;

  // Ticket RTW Management
  updateTicketRtwStatus(id: string, rtwStep: string, complianceStatus: string, nextDeadline?: { date: string, type: string }): Promise<Ticket>;
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

  // ===============================================
  // RTW COMPLEX CLAIMS - LEGISLATION COMPLIANCE IMPLEMENTATIONS
  // ===============================================

  // Legislation Documents
  async createLegislationDocument(insertDocument: InsertLegislationDocument): Promise<LegislationDocument> {
    const [document] = await db
      .insert(legislationDocuments)
      .values(insertDocument)
      .returning();
    return document;
  }

  async getLegislationDocument(id: string): Promise<LegislationDocument | undefined> {
    const [document] = await db
      .select()
      .from(legislationDocuments)
      .where(eq(legislationDocuments.id, id));
    return document || undefined;
  }

  async getLegislationBySourceAndSection(source: string, sectionId: string): Promise<LegislationDocument | undefined> {
    const [document] = await db
      .select()
      .from(legislationDocuments)
      .where(and(
        eq(legislationDocuments.source, source),
        eq(legislationDocuments.sectionId, sectionId),
        eq(legislationDocuments.isActive, true)
      ));
    return document || undefined;
  }

  async getLegislationBySource(source: string): Promise<LegislationDocument[]> {
    return await db
      .select()
      .from(legislationDocuments)
      .where(and(
        eq(legislationDocuments.source, source),
        eq(legislationDocuments.isActive, true)
      ))
      .orderBy(legislationDocuments.sectionId);
  }

  async getAllLegislation(): Promise<LegislationDocument[]> {
    return await db
      .select()
      .from(legislationDocuments)
      .where(eq(legislationDocuments.isActive, true))
      .orderBy(legislationDocuments.source, legislationDocuments.sectionId);
  }

  // RTW Workflow Steps
  async createRtwWorkflowStep(insertStep: InsertRtwWorkflowStep): Promise<RtwWorkflowStep> {
    const [step] = await db
      .insert(rtwWorkflowSteps)
      .values(insertStep)
      .returning();
    return step;
  }

  async getRtwWorkflowStep(id: string): Promise<RtwWorkflowStep | undefined> {
    const [step] = await db
      .select()
      .from(rtwWorkflowSteps)
      .where(eq(rtwWorkflowSteps.id, id));
    return step || undefined;
  }

  async getRtwWorkflowStepsByTicket(ticketId: string): Promise<RtwWorkflowStep[]> {
    return await db
      .select()
      .from(rtwWorkflowSteps)
      .where(eq(rtwWorkflowSteps.ticketId, ticketId))
      .orderBy(desc(rtwWorkflowSteps.createdAt));
  }

  async getCurrentRtwStep(ticketId: string): Promise<RtwWorkflowStep | undefined> {
    const [step] = await db
      .select()
      .from(rtwWorkflowSteps)
      .where(and(
        eq(rtwWorkflowSteps.ticketId, ticketId),
        eq(rtwWorkflowSteps.status, "in_progress")
      ))
      .orderBy(desc(rtwWorkflowSteps.createdAt))
      .limit(1);
    return step || undefined;
  }

  async updateRtwWorkflowStep(id: string, updates: Partial<InsertRtwWorkflowStep>): Promise<RtwWorkflowStep> {
    const [step] = await db
      .update(rtwWorkflowSteps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rtwWorkflowSteps.id, id))
      .returning();
    return step;
  }

  // Compliance Audit
  async createComplianceAudit(insertAudit: InsertComplianceAudit): Promise<ComplianceAudit> {
    const [audit] = await db
      .insert(complianceAudit)
      .values(insertAudit)
      .returning();
    return audit;
  }

  async getComplianceAuditByTicket(ticketId: string): Promise<ComplianceAudit[]> {
    return await db
      .select()
      .from(complianceAudit)
      .where(eq(complianceAudit.ticketId, ticketId))
      .orderBy(desc(complianceAudit.createdAt));
  }

  async getComplianceAuditById(id: string): Promise<ComplianceAudit | undefined> {
    const [audit] = await db
      .select()
      .from(complianceAudit)
      .where(eq(complianceAudit.id, id));
    return audit || undefined;
  }

  // Worker Participation Events
  async createWorkerParticipationEvent(insertEvent: InsertWorkerParticipationEvent): Promise<WorkerParticipationEvent> {
    const [event] = await db
      .insert(workerParticipationEvents)
      .values(insertEvent)
      .returning();
    return event;
  }

  async getWorkerParticipationEventsByTicket(ticketId: string): Promise<WorkerParticipationEvent[]> {
    return await db
      .select()
      .from(workerParticipationEvents)
      .where(eq(workerParticipationEvents.ticketId, ticketId))
      .orderBy(desc(workerParticipationEvents.createdAt));
  }

  async getWorkerParticipationEventsByStep(workflowStepId: string): Promise<WorkerParticipationEvent[]> {
    return await db
      .select()
      .from(workerParticipationEvents)
      .where(eq(workerParticipationEvents.workflowStepId, workflowStepId))
      .orderBy(desc(workerParticipationEvents.createdAt));
  }

  async updateWorkerParticipationEvent(id: string, updates: Partial<InsertWorkerParticipationEvent>): Promise<WorkerParticipationEvent> {
    const [event] = await db
      .update(workerParticipationEvents)
      .set(updates)
      .where(eq(workerParticipationEvents.id, id))
      .returning();
    return event;
  }

  // Letter Templates
  async createLetterTemplate(insertTemplate: InsertLetterTemplate): Promise<LetterTemplate> {
    const [template] = await db
      .insert(letterTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async getLetterTemplate(id: string): Promise<LetterTemplate | undefined> {
    const [template] = await db
      .select()
      .from(letterTemplates)
      .where(eq(letterTemplates.id, id));
    return template || undefined;
  }

  async getLetterTemplateByName(name: string): Promise<LetterTemplate | undefined> {
    const [template] = await db
      .select()
      .from(letterTemplates)
      .where(and(
        eq(letterTemplates.name, name),
        eq(letterTemplates.isActive, true)
      ));
    return template || undefined;
  }

  async getAllLetterTemplates(): Promise<LetterTemplate[]> {
    return await db
      .select()
      .from(letterTemplates)
      .where(eq(letterTemplates.isActive, true))
      .orderBy(letterTemplates.templateType, letterTemplates.name);
  }

  async getLetterTemplatesByType(templateType: string): Promise<LetterTemplate[]> {
    return await db
      .select()
      .from(letterTemplates)
      .where(and(
        eq(letterTemplates.templateType, templateType),
        eq(letterTemplates.isActive, true)
      ))
      .orderBy(letterTemplates.name);
  }

  // Generated Letters
  async createGeneratedLetter(insertLetter: InsertGeneratedLetter): Promise<GeneratedLetter> {
    const [letter] = await db
      .insert(generatedLetters)
      .values(insertLetter)
      .returning();
    return letter;
  }

  async getGeneratedLetter(id: string): Promise<GeneratedLetter | undefined> {
    const [letter] = await db
      .select()
      .from(generatedLetters)
      .where(eq(generatedLetters.id, id));
    return letter || undefined;
  }

  async getGeneratedLettersByTicket(ticketId: string): Promise<GeneratedLetter[]> {
    return await db
      .select()
      .from(generatedLetters)
      .where(eq(generatedLetters.ticketId, ticketId))
      .orderBy(desc(generatedLetters.createdAt));
  }

  async updateGeneratedLetterStatus(id: string, status: string): Promise<GeneratedLetter> {
    const [letter] = await db
      .update(generatedLetters)
      .set({ status })
      .where(eq(generatedLetters.id, id))
      .returning();
    return letter;
  }

  // Ticket RTW Management
  async updateTicketRtwStatus(id: string, rtwStep: string, complianceStatus: string, nextDeadline?: { date: string, type: string }): Promise<Ticket> {
    const updateData: any = {
      rtwStep,
      complianceStatus,
      updatedAt: new Date()
    };

    if (nextDeadline) {
      updateData.nextDeadlineDate = nextDeadline.date;
      updateData.nextDeadlineType = nextDeadline.type;
    }

    const [ticket] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }
}

export const storage = new DatabaseStorage();

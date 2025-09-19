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

  // Enhanced Analytics
  getTrendAnalytics(days?: number): Promise<{
    daily_cases: { date: string; count: number; }[];
    case_completion_rate: number;
    avg_processing_time_days: number;
    risk_distribution: { green: number; amber: number; red: number; };
    injury_types: { type: string; count: number; }[];
    compliance_status: { compliant: number; at_risk: number; non_compliant: number; };
  }>;

  getPerformanceMetrics(): Promise<{
    cases_this_month: number;
    cases_last_month: number;
    completion_rate: number;
    avg_response_time: number;
    participation_rate: number;
    risk_cases_resolved: number;
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

  // Enhanced Analytics
  async getTrendAnalytics(days: number = 30) {
    const allTickets = await this.getAllTickets();
    const allAnalyses = await db.select().from(analyses);
    const allInjuries = await db.select().from(injuries);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Daily case creation trend
    const daily_cases = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = allTickets.filter(t => {
        if (!t.createdAt) return false;
        const ticketDate = new Date(t.createdAt).toISOString().split('T')[0];
        return ticketDate === dateStr;
      }).length;
      
      daily_cases.push({ date: dateStr, count });
    }
    
    // Case completion rate
    const completedCases = allTickets.filter(t => t.status === 'COMPLETE').length;
    const case_completion_rate = allTickets.length > 0 ? (completedCases / allTickets.length) * 100 : 0;
    
    // Average processing time
    const completedTickets = allTickets.filter(t => t.status === 'COMPLETE' && t.createdAt && t.updatedAt);
    const totalProcessingDays = completedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.createdAt!);
      const completed = new Date(ticket.updatedAt!);
      const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    const avg_processing_time_days = completedTickets.length > 0 ? totalProcessingDays / completedTickets.length : 0;
    
    // Risk distribution from RAG scores
    const ragCounts = { green: 0, amber: 0, red: 0 };
    allAnalyses.forEach(analysis => {
      if (analysis.ragScore === 'green') ragCounts.green++;
      else if (analysis.ragScore === 'amber') ragCounts.amber++;
      else if (analysis.ragScore === 'red') ragCounts.red++;
    });
    
    // Injury types distribution
    const injuryTypeCounts: { [key: string]: number } = {};
    allInjuries.forEach(injury => {
      if (injury.injuryType) {
        injuryTypeCounts[injury.injuryType] = (injuryTypeCounts[injury.injuryType] || 0) + 1;
      }
    });
    const injury_types = Object.entries(injuryTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 injury types
    
    // Compliance status distribution
    const complianceStatusCounts = { compliant: 0, at_risk: 0, non_compliant: 0 };
    allTickets.forEach(ticket => {
      if (ticket.complianceStatus === 'compliant') complianceStatusCounts.compliant++;
      else if (ticket.complianceStatus === 'at_risk') complianceStatusCounts.at_risk++;
      else if (ticket.complianceStatus === 'non_compliant') complianceStatusCounts.non_compliant++;
    });
    
    return {
      daily_cases,
      case_completion_rate,
      avg_processing_time_days,
      risk_distribution: ragCounts,
      injury_types,
      compliance_status: complianceStatusCounts,
    };
  }

  async getPerformanceMetrics() {
    const allTickets = await this.getAllTickets();
    const allParticipationEvents = await db.select().from(workerParticipationEvents);
    
    // Current month calculation
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Cases this month vs last month
    const cases_this_month = allTickets.filter(t => 
      t.createdAt && new Date(t.createdAt) >= currentMonthStart
    ).length;
    
    const cases_last_month = allTickets.filter(t => 
      t.createdAt && 
      new Date(t.createdAt) >= lastMonthStart && 
      new Date(t.createdAt) <= lastMonthEnd
    ).length;
    
    // Overall completion rate
    const completedCases = allTickets.filter(t => t.status === 'COMPLETE').length;
    const completion_rate = allTickets.length > 0 ? (completedCases / allTickets.length) * 100 : 0;
    
    // Average response time (simplified to processing time)
    const completedTickets = allTickets.filter(t => t.status === 'COMPLETE' && t.createdAt && t.updatedAt);
    const totalResponseHours = completedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.createdAt!);
      const completed = new Date(ticket.updatedAt!);
      const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    const avg_response_time = completedTickets.length > 0 ? totalResponseHours / completedTickets.length : 0;
    
    // Participation rate
    const totalParticipationEvents = allParticipationEvents.length;
    const attendedEvents = allParticipationEvents.filter(event => 
      event.participationStatus === 'attended'
    ).length;
    const participation_rate = totalParticipationEvents > 0 ? (attendedEvents / totalParticipationEvents) * 100 : 0;
    
    // Risk cases resolved (cases that had red RAG but are now complete)
    const riskCasesResolved = await db
      .select()
      .from(tickets)
      .leftJoin(analyses, eq(tickets.id, analyses.ticketId))
      .where(and(
        eq(tickets.status, 'COMPLETE'),
        eq(analyses.ragScore, 'red')
      ));
    
    return {
      cases_this_month,
      cases_last_month,
      completion_rate,
      avg_response_time,
      participation_rate,
      risk_cases_resolved: riskCasesResolved.length,
    };
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

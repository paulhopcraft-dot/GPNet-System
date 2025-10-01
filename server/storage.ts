import { 
  tickets, workers, formSubmissions, analyses, emails, attachments,
  injuries, stakeholders, rtwPlans, riskHistory,
  legislationDocuments, rtwWorkflowSteps, complianceAudit, workerParticipationEvents,
  letterTemplates, generatedLetters, freshdeskTickets, freshdeskSyncLogs,
  organizations, clientUsers, adminUsers, auditEvents, archiveIndex,
  externalEmails, emailAttachments, caseProviders, aiRecommendations, conversations, conversationMessages,
  specialists, escalations, specialistAssignments,
  medicalDocuments, documentProcessingJobs, documentProcessingLogs, documentEmbeddings,
  checks, companyAliases, emailDrafts, checkRequests,
  medicalOpinionRequests, organizationSettings, reminderSchedule,
  type Ticket, type Worker, type FormSubmission, type Analysis, type Email, type Attachment,
  type Injury, type Stakeholder, type RtwPlan, type RiskHistory,
  type LegislationDocument, type RtwWorkflowStep, type ComplianceAudit, type WorkerParticipationEvent,
  type LetterTemplate, type GeneratedLetter, type FreshdeskTicket, type FreshdeskSyncLog,
  type Organization, type ClientUser, type AdminUser, type AuditEvent, type ArchiveIndex,
  type Specialist, type Escalation, type SpecialistAssignment,
  type MedicalDocument, type DocumentProcessingJob, type DocumentProcessingLog, type DocumentEmbedding,
  type Check, type CompanyAlias, type EmailDraft, type CheckRequest,
  type MedicalOpinionRequest, type OrganizationSettings, type ReminderSchedule,
  type InsertTicket, type InsertWorker, type InsertFormSubmission, type InsertAnalysis, type InsertEmail,
  type InsertInjury, type InsertStakeholder, type InsertRtwPlan, type InsertRiskHistory,
  type InsertLegislationDocument, type InsertRtwWorkflowStep, type InsertComplianceAudit,
  type InsertWorkerParticipationEvent, type InsertLetterTemplate, type InsertGeneratedLetter,
  type InsertFreshdeskTicket, type InsertFreshdeskSyncLog,
  type InsertOrganization, type InsertClientUser, type InsertAdminUser, type InsertAuditEvent, type InsertArchiveIndex,
  type InsertSpecialist, type InsertEscalation, type InsertSpecialistAssignment,
  type InsertMedicalDocument, type InsertDocumentProcessingJob, type InsertDocumentProcessingLog, type InsertDocumentEmbedding,
  type InsertCheck, type InsertCompanyAlias, type InsertEmailDraft, type InsertCheckRequest,
  type InsertMedicalOpinionRequest, type InsertOrganizationSettings, type InsertReminderSchedule
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, asc } from "drizzle-orm";

// Storage interface for GPNet operations
export interface IStorage {
  // Tickets
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getAllTickets(): Promise<Ticket[]>;
  updateTicketStatus(id: string, status: string): Promise<Ticket>;
  updateTicketPriority(id: string, priority: string): Promise<Ticket>;
  
  // Step Tracking
  updateTicketStep(id: string, nextStep: string, assignedTo?: string): Promise<Ticket>;
  completeCurrentStep(id: string, completionNotes?: string): Promise<Ticket>;
  updateTicketStepAndComplete(id: string, nextStep: string, assignedTo?: string, completionNotes?: string): Promise<Ticket>;
  
  // Ticket Assignment
  updateTicket(id: string, updates: Partial<InsertTicket>): Promise<Ticket>;
  getTicketsByAssignee(assignedTo: string): Promise<Ticket[]>;
  
  // Workers
  createWorker(worker: InsertWorker): Promise<Worker>;
  getWorker(id: string): Promise<Worker | undefined>;
  
  // Form Submissions
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  getFormSubmissionByTicket(ticketId: string): Promise<FormSubmission | undefined>;
  
  // Analyses
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysisByTicket(ticketId: string): Promise<Analysis | undefined>;
  updateAnalysis(ticketId: string, updates: Partial<InsertAnalysis>, historyMetadata?: {
    changeSource: string;
    changeReason: string;
    triggeredBy: string;
    confidence: number;
  }): Promise<Analysis>;
  
  // Risk History
  createRiskHistoryEntry(entry: InsertRiskHistory): Promise<RiskHistory>;
  getRiskHistoryByTicket(ticketId: string): Promise<RiskHistory[]>;
  getCasesNeedingReassessment(): Promise<{ticketId: string; lastAssessed: Date; currentRisk: string}[]>;
  
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
  
  // Emails
  getEmailsByTicket(ticketId: string): Promise<Email[]>;
  
  // Freshdesk Integration
  findTicketByFreshdeskId(freshdeskTicketId: number): Promise<Ticket | null>;
  findOrganizationByFreshdeskId(freshdeskCompanyId: number): Promise<Organization | null>;
  
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

  // Organization-scoped Analytics for Cross-tenant Insights
  getTrendAnalyticsForOrganization(organizationId: string, days?: number): Promise<{
    daily_cases: { date: string; count: number; }[];
    case_completion_rate: number;
    avg_processing_time_days: number;
    risk_distribution: { green: number; amber: number; red: number; };
    injury_types: { type: string; count: number; }[];
    compliance_status: { compliant: number; at_risk: number; non_compliant: number; };
  }>;

  getPerformanceMetricsForOrganization(organizationId: string): Promise<{
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

  // Freshdesk Integration
  createFreshdeskTicket(freshdeskTicket: InsertFreshdeskTicket): Promise<FreshdeskTicket>;
  getFreshdeskTicket(id: string): Promise<FreshdeskTicket | undefined>;
  getFreshdeskTicketByGpnetId(gpnetTicketId: string): Promise<FreshdeskTicket | undefined>;
  getFreshdeskTicketByFreshdeskId(freshdeskTicketId: number): Promise<FreshdeskTicket | undefined>;
  updateFreshdeskTicket(id: string, updates: Partial<InsertFreshdeskTicket>): Promise<FreshdeskTicket>;
  updateFreshdeskTicketStatus(id: string, syncStatus: string): Promise<FreshdeskTicket>;
  getAllFreshdeskTickets(): Promise<FreshdeskTicket[]>;
  
  // Correspondence (bidirectional sync)
  createCorrespondence(correspondenceData: {
    ticketId: string;
    direction: string;
    type: string;
    subject: string;
    content: string;
    senderName: string;
    senderEmail: string;
    source: string;
    externalId?: string;
  }): Promise<Email | null>;

  // Freshdesk Sync Logs
  createFreshdeskSyncLog(syncLog: InsertFreshdeskSyncLog): Promise<FreshdeskSyncLog>;
  getFreshdeskSyncLogsByTicket(gpnetTicketId: string): Promise<FreshdeskSyncLog[]>;
  getFreshdeskSyncLogsByOperation(operation: string): Promise<FreshdeskSyncLog[]>;
  getFailedFreshdeskSyncLogs(): Promise<FreshdeskSyncLog[]>;

  // ===============================================
  // MULTI-TENANT AUTHENTICATION & ADMIN
  // ===============================================

  // Organizations
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  archiveOrganization(id: string, archivedBy: string): Promise<Organization>;

  // Client Users
  createClientUser(user: InsertClientUser): Promise<ClientUser>;
  getClientUser(id: string): Promise<ClientUser | undefined>;
  getClientUserByEmail(email: string, organizationId?: string): Promise<ClientUser | undefined>;
  getClientUsersByOrganization(organizationId: string): Promise<ClientUser[]>;
  getAllClientUsers(): Promise<ClientUser[]>;
  updateClientUser(id: string, updates: Partial<InsertClientUser>): Promise<ClientUser>;
  updateClientUserLastLogin(id: string): Promise<ClientUser>;

  // Admin Users
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  getAllAdminUsers(): Promise<AdminUser[]>;
  updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser>;
  updateAdminPassword(id: string, hashedPassword: string): Promise<AdminUser>;
  updateAdminUserLastLogin(id: string): Promise<AdminUser>;
  setAdminImpersonation(id: string, targetOrgId: string | null): Promise<AdminUser>;

  // Audit Events
  createAuditEvent(event: InsertAuditEvent): Promise<AuditEvent>;
  getAuditEvents(filters?: {
    organizationId?: string;
    actorId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditEvent[]>;

  // Archive Index
  createArchiveEntry(entry: InsertArchiveIndex): Promise<ArchiveIndex>;
  getArchivedEntities(entityType?: string, organizationId?: string): Promise<ArchiveIndex[]>;
  restoreArchivedEntity(id: string, restoredBy: string): Promise<ArchiveIndex>;

  // ===============================================
  // MEDICAL DOCUMENT PROCESSING
  // ===============================================
  
  // Medical Documents
  createMedicalDocument(document: InsertMedicalDocument): Promise<MedicalDocument>;
  getMedicalDocument(id: string): Promise<MedicalDocument | undefined>;
  getMedicalDocumentsByTicket(ticketId: string): Promise<MedicalDocument[]>;
  getMedicalDocumentsByWorker(workerId: string): Promise<MedicalDocument[]>;
  updateMedicalDocument(id: string, updates: Partial<InsertMedicalDocument>): Promise<MedicalDocument>;
  findDocumentByChecksum(checksum: string): Promise<MedicalDocument | undefined>;
  getMedicalDocumentsPendingReview(): Promise<MedicalDocument[]>;
  
  // Document Processing Jobs
  createDocumentProcessingJob(job: InsertDocumentProcessingJob): Promise<DocumentProcessingJob>;
  getDocumentProcessingJob(id: string): Promise<DocumentProcessingJob | undefined>;
  updateDocumentProcessingJob(id: string, updates: Partial<InsertDocumentProcessingJob>): Promise<DocumentProcessingJob>;
  getDocumentProcessingJobsByStatus(status: string): Promise<DocumentProcessingJob[]>;
  
  // Document Processing Logs
  createDocumentProcessingLog(log: InsertDocumentProcessingLog): Promise<DocumentProcessingLog>;
  getDocumentProcessingLogsByDocument(documentId: string): Promise<DocumentProcessingLog[]>;
  getDocumentProcessingLogsByJob(jobId: string): Promise<DocumentProcessingLog[]>;
  
  // Helper methods for webhook processing
  findTicketByFreshdeskId(freshdeskId: number): Promise<Ticket | undefined>;
  findWorkerByEmail(email: string): Promise<Worker | undefined>;
  findWorkersByName(name: string): Promise<Worker[]>;
  findCasesByWorkerId(workerId: string): Promise<Ticket[]>;
  findOpenTicketsForWorker(workerId: string): Promise<Ticket[]>;
  linkTicketToFreshdesk(ticketId: string, freshdeskId: number): Promise<void>;
  getCaseByTicketId(ticketId: string): Promise<any | undefined>;
  updateCase(caseId: string, updates: any): Promise<any>;

  // Multi-tenant data access (add organizationId context to existing methods)
  getAllTicketsForOrganization(organizationId: string): Promise<Ticket[]>;
  getDashboardStatsForOrganization(organizationId: string): Promise<{
    total: number;
    new: number;
    inProgress: number;
    awaiting: number;
    complete: number;
    flagged: number;
  }>;

  // Specialists
  getAllSpecialists(): Promise<Specialist[]>;
  getSpecialist(id: string): Promise<Specialist | undefined>;
  createSpecialist(specialist: InsertSpecialist): Promise<Specialist>;
  updateSpecialist(id: string, updates: Partial<InsertSpecialist>): Promise<Specialist>;

  // Escalations
  getEscalations(filters?: {
    status?: string;
    priority?: string;
    specialistId?: string;
  }): Promise<Escalation[]>;
  getEscalationWithContext(escalationId: string): Promise<any>;
  updateEscalationStatus(escalationId: string, status: string, resolutionNotes?: string): Promise<Escalation>;
  assignEscalationToSpecialist(params: {
    escalationId: string;
    specialistId: string;
    assignmentReason: string;
    assignmentType: string;
  }): Promise<SpecialistAssignment>;
  getEscalationDashboardData(): Promise<any>;

  // Company Aliases (for fuzzy matching)
  createCompanyAlias(data: InsertCompanyAlias): Promise<CompanyAlias>;
  getCompanyAliases(companyId: string): Promise<CompanyAlias[]>;
  getAllCompanyAliases(): Promise<CompanyAlias[]>;
  getCompanyAliasesForOrganization(organizationId: string): Promise<CompanyAlias[]>;
  findCompanyByAlias(normalizedName: string): Promise<CompanyAlias[]>;
  deleteCompanyAlias(id: string): Promise<void>;

  // ===============================================
  // MEDICAL OPINION REQUEST WORKFLOW
  // ===============================================
  
  // Medical Opinion Requests
  createMedicalOpinionRequest(data: InsertMedicalOpinionRequest): Promise<MedicalOpinionRequest>;
  getMedicalOpinionRequest(id: string): Promise<MedicalOpinionRequest | undefined>;
  getMedicalOpinionRequestsByTicket(ticketId: string): Promise<MedicalOpinionRequest[]>;
  updateMedicalOpinionRequest(id: string, data: Partial<InsertMedicalOpinionRequest>): Promise<MedicalOpinionRequest>;
  assignMedicalOpinionRequest(id: string, doctorId: string): Promise<MedicalOpinionRequest>;
  completeMedicalOpinionRequest(id: string, opinion: string, recommendations: any, decision: string): Promise<MedicalOpinionRequest>;
  getPendingMedicalOpinionRequests(): Promise<MedicalOpinionRequest[]>;
  getOverdueMedicalOpinionRequests(): Promise<MedicalOpinionRequest[]>;
  
  // Organization Settings
  createOrganizationSettings(data: InsertOrganizationSettings): Promise<OrganizationSettings>;
  getOrganizationSettings(organizationId: string): Promise<OrganizationSettings | undefined>;
  updateOrganizationSettings(organizationId: string, data: Partial<InsertOrganizationSettings>): Promise<OrganizationSettings>;
  
  // Reminder Schedule
  createReminderSchedule(data: InsertReminderSchedule): Promise<ReminderSchedule>;
  getReminderSchedule(id: string): Promise<ReminderSchedule | undefined>;
  getRemindersByTicket(ticketId: string): Promise<ReminderSchedule[]>;
  updateReminderStatus(id: string, status: string, sentAt?: Date): Promise<ReminderSchedule>;
  getPendingReminders(): Promise<ReminderSchedule[]>;
  getOverdueReminders(): Promise<ReminderSchedule[]>;

  // ===============================================
  // DOCUMENT EMBEDDINGS FOR RAG
  // ===============================================
  
  // Document embeddings for medical reports
  createDocumentEmbedding(embedding: InsertDocumentEmbedding): Promise<DocumentEmbedding>;
  getDocumentEmbeddingsByDocument(documentId: string): Promise<DocumentEmbedding[]>;
  getDocumentEmbeddingsByTicket(ticketId: string): Promise<DocumentEmbedding[]>;
  
  // Document methods (aliasing to medical documents for now)
  getDocument(id: string): Promise<MedicalDocument | undefined>;
  
  // Helper methods for Freshdesk integration
  getAllTicketsWithFreshdeskIds(): Promise<Ticket[]>;
  getDocumentProcessingLogs(documentId: string): Promise<DocumentProcessingLog[]>;
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

  async updateTicketPriority(id: string, priority: string): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ priority, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  // Step Tracking Methods
  async updateTicketStep(id: string, nextStep: string, assignedTo?: string): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ 
        nextStep, 
        assignedTo: assignedTo || null,
        updatedAt: new Date() 
      })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  async completeCurrentStep(id: string, completionNotes?: string): Promise<Ticket> {
    // Get current ticket to move nextStep to lastStep
    const currentTicket = await this.getTicket(id);
    if (!currentTicket) {
      throw new Error(`Ticket ${id} not found`);
    }

    const [ticket] = await db
      .update(tickets)
      .set({ 
        lastStep: currentTicket.nextStep,
        lastStepCompletedAt: new Date(),
        nextStep: null, // Clear next step until a new one is assigned
        updatedAt: new Date() 
      })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  // Ticket Assignment Methods
  async updateTicket(id: string, updates: Partial<InsertTicket>): Promise<Ticket> {
    const [ticket] = await db
      .update(tickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  async getTicketsByAssignee(assignedTo: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.assignedTo, assignedTo))
      .orderBy(desc(tickets.updatedAt));
  }

  async updateTicketStepAndComplete(id: string, nextStep: string, assignedTo?: string, completionNotes?: string): Promise<Ticket> {
    // Get current ticket to move nextStep to lastStep
    const currentTicket = await this.getTicket(id);
    if (!currentTicket) {
      throw new Error(`Ticket ${id} not found`);
    }

    const [ticket] = await db
      .update(tickets)
      .set({ 
        lastStep: currentTicket.nextStep,
        lastStepCompletedAt: new Date(),
        nextStep,
        assignedTo: assignedTo || null,
        updatedAt: new Date() 
      })
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

  async updateAnalysis(ticketId: string, updates: Partial<InsertAnalysis>, historyMetadata?: {
    changeSource: string;
    changeReason: string;
    triggeredBy: string;
    confidence: number;
  }): Promise<Analysis> {
    // Get existing analysis to track risk level changes
    const existingAnalysis = await this.getAnalysisByTicket(ticketId);
    
    // Prepare update object - only include timing fields if ragScore is being updated
    const updateObject: any = { ...updates };
    if (updates.ragScore) {
      updateObject.lastAssessedAt = new Date();
      updateObject.nextReviewAt = this.calculateNextReviewDate(updates.ragScore);
    }
    
    // Update the analysis
    const [analysis] = await db
      .update(analyses)
      .set(updateObject)
      .where(eq(analyses.ticketId, ticketId))
      .returning();

    // Create history entry if risk level changed
    if (existingAnalysis && updates.ragScore && existingAnalysis.ragScore !== updates.ragScore) {
      await this.createRiskHistoryEntry({
        ticketId,
        previousRagScore: existingAnalysis.ragScore,
        newRagScore: updates.ragScore,
        changeSource: historyMetadata?.changeSource || 'system_update',
        changeReason: historyMetadata?.changeReason || 'Risk level updated via analysis update',
        confidence: historyMetadata?.confidence || 100,
        riskFactors: updates.recommendations || [],
        triggeredBy: historyMetadata?.triggeredBy || 'system'
      });
    }

    return analysis;
  }

  // Risk History methods
  async createRiskHistoryEntry(entry: InsertRiskHistory): Promise<RiskHistory> {
    const [historyEntry] = await db
      .insert(riskHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }

  async getRiskHistoryByTicket(ticketId: string): Promise<RiskHistory[]> {
    return await db
      .select()
      .from(riskHistory)
      .where(eq(riskHistory.ticketId, ticketId))
      .orderBy(desc(riskHistory.timestamp));
  }

  async getCasesNeedingReassessment(): Promise<{ticketId: string; lastAssessed: Date; currentRisk: string}[]> {
    // Get all analyses and filter in memory since we need <= comparison
    const casesWithAnalyses = await db
      .select({
        ticketId: analyses.ticketId,
        lastAssessed: analyses.lastAssessedAt,
        nextReview: analyses.nextReviewAt,
        currentRisk: analyses.ragScore
      })
      .from(analyses);

    const now = new Date();
    return casesWithAnalyses
      .filter(c => c.nextReview && c.nextReview <= now)
      .map(c => ({
        ticketId: c.ticketId,
        lastAssessed: c.lastAssessed || new Date(),
        currentRisk: c.currentRisk || 'green'
      }));
  }

  // Helper method to calculate next review date based on risk level
  private calculateNextReviewDate(ragScore: string | null): Date {
    const now = new Date();
    const nextReview = new Date(now);
    
    switch (ragScore) {
      case 'red':
        nextReview.setDate(now.getDate() + 3); // 3 days for high risk
        break;
      case 'amber':
        nextReview.setDate(now.getDate() + 7); // 7 days for medium risk
        break;
      case 'green':
      default:
        nextReview.setDate(now.getDate() + 30); // 30 days for low risk
        break;
    }
    
    return nextReview;
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

  // Emails
  async getEmailsByTicket(ticketId: string): Promise<Email[]> {
    return await db
      .select()
      .from(emails)
      .where(eq(emails.ticketId, ticketId))
      .orderBy(desc(emails.sentAt));
  }

  // Freshdesk Integration
  async findTicketByFreshdeskId(freshdeskTicketId: number): Promise<Ticket | null> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.fdId, freshdeskTicketId))
      .limit(1);
    return ticket || null;
  }

  async findOrganizationByFreshdeskId(freshdeskCompanyId: number): Promise<Organization | null> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.freshdeskCompanyId, freshdeskCompanyId))
      .limit(1);
    return org || null;
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

  // Freshdesk Integration
  async createFreshdeskTicket(insertFreshdeskTicket: InsertFreshdeskTicket): Promise<FreshdeskTicket> {
    const [freshdeskTicket] = await db
      .insert(freshdeskTickets)
      .values(insertFreshdeskTicket)
      .returning();
    return freshdeskTicket;
  }

  async getFreshdeskTicket(id: string): Promise<FreshdeskTicket | undefined> {
    const [freshdeskTicket] = await db
      .select()
      .from(freshdeskTickets)
      .where(eq(freshdeskTickets.id, id));
    return freshdeskTicket || undefined;
  }

  async getFreshdeskTicketByGpnetId(gpnetTicketId: string): Promise<FreshdeskTicket | undefined> {
    const [freshdeskTicket] = await db
      .select()
      .from(freshdeskTickets)
      .where(eq(freshdeskTickets.gpnetTicketId, gpnetTicketId));
    return freshdeskTicket || undefined;
  }

  async getFreshdeskTicketByFreshdeskId(freshdeskTicketId: number): Promise<FreshdeskTicket | undefined> {
    const [freshdeskTicket] = await db
      .select()
      .from(freshdeskTickets)
      .where(eq(freshdeskTickets.freshdeskTicketId, freshdeskTicketId));
    return freshdeskTicket || undefined;
  }

  async updateFreshdeskTicket(id: string, updates: Partial<InsertFreshdeskTicket>): Promise<FreshdeskTicket> {
    const [freshdeskTicket] = await db
      .update(freshdeskTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(freshdeskTickets.id, id))
      .returning();
    return freshdeskTicket;
  }

  async updateFreshdeskTicketStatus(id: string, syncStatus: string): Promise<FreshdeskTicket> {
    const [freshdeskTicket] = await db
      .update(freshdeskTickets)
      .set({ syncStatus, updatedAt: new Date() })
      .where(eq(freshdeskTickets.id, id))
      .returning();
    return freshdeskTicket;
  }

  async getAllFreshdeskTickets(): Promise<FreshdeskTicket[]> {
    return await db
      .select()
      .from(freshdeskTickets)
      .orderBy(desc(freshdeskTickets.createdAt));
  }

  // Freshdesk Sync Logs
  async createFreshdeskSyncLog(insertSyncLog: InsertFreshdeskSyncLog): Promise<FreshdeskSyncLog> {
    const [syncLog] = await db
      .insert(freshdeskSyncLogs)
      .values(insertSyncLog)
      .returning();
    return syncLog;
  }

  async getFreshdeskSyncLogsByTicket(gpnetTicketId: string): Promise<FreshdeskSyncLog[]> {
    return await db
      .select()
      .from(freshdeskSyncLogs)
      .where(eq(freshdeskSyncLogs.gpnetTicketId, gpnetTicketId))
      .orderBy(desc(freshdeskSyncLogs.createdAt));
  }

  async getFreshdeskSyncLogsByOperation(operation: string): Promise<FreshdeskSyncLog[]> {
    return await db
      .select()
      .from(freshdeskSyncLogs)
      .where(eq(freshdeskSyncLogs.operation, operation))
      .orderBy(desc(freshdeskSyncLogs.createdAt));
  }

  async getFailedFreshdeskSyncLogs(): Promise<FreshdeskSyncLog[]> {
    return await db
      .select()
      .from(freshdeskSyncLogs)
      .where(eq(freshdeskSyncLogs.status, 'failed'))
      .orderBy(desc(freshdeskSyncLogs.createdAt));
  }

  // Correspondence methods (using emails table for bidirectional sync)
  async createCorrespondence(correspondenceData: {
    ticketId: string;
    direction: string;
    type: string;
    subject: string;
    content: string;
    senderName: string;
    senderEmail: string;
    source: string;
    externalId?: string;
  }): Promise<Email | null> {
    // Check for duplicate if externalId provided
    if (correspondenceData.externalId && correspondenceData.source) {
      const [existing] = await db
        .select()
        .from(emails)
        .where(and(
          eq(emails.source, correspondenceData.source),
          eq(emails.externalId, correspondenceData.externalId)
        ));
      
      if (existing) {
        console.log(`Correspondence already exists: ${correspondenceData.source}:${correspondenceData.externalId}`);
        return null;
      }
    }
    
    // Use emails table structure for correspondence tracking
    const emailData: InsertEmail = {
      ticketId: correspondenceData.ticketId,
      subject: `[${correspondenceData.type.toUpperCase()}] ${correspondenceData.subject}`,
      body: correspondenceData.content,
      source: correspondenceData.source,
      direction: correspondenceData.direction,
      externalId: correspondenceData.externalId,
      senderName: correspondenceData.senderName,
      senderEmail: correspondenceData.senderEmail
    };
    
    const [email] = await db
      .insert(emails)
      .values(emailData)
      .returning();
    return email;
  }

  // ===============================================
  // MULTI-TENANT AUTHENTICATION & ADMIN IMPLEMENTATIONS
  // ===============================================

  // Organizations
  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const [organization] = await db
      .insert(organizations)
      .values(insertOrganization)
      .returning();
    return organization;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));
    return organization || undefined;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug));
    return organization || undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db
      .select()
      .from(organizations)
      .where(eq(organizations.isArchived, false))
      .orderBy(desc(organizations.createdAt));
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const [organization] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return organization;
  }

  async archiveOrganization(id: string, archivedBy: string): Promise<Organization> {
    const [organization] = await db
      .update(organizations)
      .set({ 
        isArchived: true, 
        archivedAt: new Date(), 
        archivedBy,
        updatedAt: new Date() 
      })
      .where(eq(organizations.id, id))
      .returning();
    return organization;
  }

  // Client Users
  async createClientUser(insertUser: InsertClientUser): Promise<ClientUser> {
    const [user] = await db
      .insert(clientUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async getClientUser(id: string): Promise<ClientUser | undefined> {
    const [user] = await db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.id, id));
    return user || undefined;
  }

  async getClientUserByEmail(email: string, organizationId?: string): Promise<ClientUser | undefined> {
    const conditions = [eq(clientUsers.email, email)];
    
    if (organizationId) {
      conditions.push(eq(clientUsers.organizationId, organizationId));
    }
    
    const [user] = await db
      .select()
      .from(clientUsers)
      .where(and(...conditions));
    
    return user || undefined;
  }

  async getClientUsersByOrganization(organizationId: string): Promise<ClientUser[]> {
    return await db
      .select()
      .from(clientUsers)
      .where(and(
        eq(clientUsers.organizationId, organizationId),
        eq(clientUsers.isArchived, false)
      ))
      .orderBy(desc(clientUsers.createdAt));
  }

  async getAllClientUsers(): Promise<ClientUser[]> {
    return await db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.isArchived, false))
      .orderBy(desc(clientUsers.createdAt));
  }

  async updateClientUser(id: string, updates: Partial<InsertClientUser>): Promise<ClientUser> {
    const [user] = await db
      .update(clientUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clientUsers.id, id))
      .returning();
    return user;
  }

  async updateClientUserLastLogin(id: string): Promise<ClientUser> {
    // Get current login count first
    const currentUser = await this.getClientUser(id);
    const newLoginCount = (currentUser?.loginCount || 0) + 1;
    
    const [user] = await db
      .update(clientUsers)
      .set({ 
        lastLoginAt: new Date(),
        loginCount: newLoginCount,
        updatedAt: new Date() 
      })
      .where(eq(clientUsers.id, id))
      .returning();
    return user;
  }

  // Admin Users
  async createAdminUser(insertUser: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db
      .insert(adminUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id));
    return user || undefined;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email));
    return user || undefined;
  }

  async getAllAdminUsers(): Promise<AdminUser[]> {
    return await db
      .select()
      .from(adminUsers)
      .orderBy(desc(adminUsers.createdAt));
  }

  async updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser> {
    const [user] = await db
      .update(adminUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return user;
  }

  async updateAdminPassword(id: string, hashedPassword: string): Promise<AdminUser> {
    const [user] = await db
      .update(adminUsers)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return user;
  }

  async updateAdminUserLastLogin(id: string): Promise<AdminUser> {
    // Get current login count first
    const currentUser = await this.getAdminUser(id);
    const newLoginCount = (currentUser?.loginCount || 0) + 1;
    
    const [user] = await db
      .update(adminUsers)
      .set({ 
        lastLoginAt: new Date(),
        loginCount: newLoginCount,
        updatedAt: new Date() 
      })
      .where(eq(adminUsers.id, id))
      .returning();
    return user;
  }

  async setAdminImpersonation(id: string, targetOrgId: string | null): Promise<AdminUser> {
    const [user] = await db
      .update(adminUsers)
      .set({ 
        currentImpersonationTarget: targetOrgId,
        impersonationStartedAt: targetOrgId ? new Date() : null,
        updatedAt: new Date() 
      })
      .where(eq(adminUsers.id, id))
      .returning();
    return user;
  }

  // Audit Events
  async createAuditEvent(insertEvent: InsertAuditEvent): Promise<AuditEvent> {
    const [event] = await db
      .insert(auditEvents)
      .values(insertEvent)
      .returning();
    return event;
  }

  async getAuditEvents(filters?: {
    organizationId?: string;
    actorId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditEvent[]> {
    const conditions = [];
    
    if (filters) {
      if (filters.organizationId) conditions.push(eq(auditEvents.companyId, filters.organizationId));
      if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
      if (filters.eventType) conditions.push(eq(auditEvents.eventType, filters.eventType));
      // Add date filtering if needed
    }
    
    let query = db.select().from(auditEvents);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(auditEvents.timestamp));
  }

  // Archive Index
  async createArchiveEntry(insertEntry: InsertArchiveIndex): Promise<ArchiveIndex> {
    const [entry] = await db
      .insert(archiveIndex)
      .values(insertEntry)
      .returning();
    return entry;
  }

  async getArchivedEntities(entityType?: string, organizationId?: string): Promise<ArchiveIndex[]> {
    const conditions = [];
    if (entityType) conditions.push(eq(archiveIndex.entityType, entityType));
    if (organizationId) conditions.push(eq(archiveIndex.companyId, organizationId));
    
    let query = db.select().from(archiveIndex);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(archiveIndex.archivedAt));
  }

  async restoreArchivedEntity(id: string, restoredBy: string): Promise<ArchiveIndex> {
    const [entry] = await db
      .update(archiveIndex)
      .set({ 
        restoredAt: new Date(),
        restoredBy 
      })
      .where(eq(archiveIndex.id, id))
      .returning();
    return entry;
  }

  // Multi-tenant data access
  async getAllTicketsForOrganization(organizationId: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.organizationId, organizationId))
      .orderBy(desc(tickets.createdAt));
  }

  async getDashboardStatsForOrganization(organizationId: string): Promise<{
    total: number;
    new: number;
    inProgress: number;
    awaiting: number;
    complete: number;
    flagged: number;
  }> {
    const allTickets = await this.getAllTicketsForOrganization(organizationId);
    
    const stats = {
      total: allTickets.length,
      new: allTickets.filter(t => t.status === 'NEW').length,
      inProgress: allTickets.filter(t => ['ANALYSING', 'IN_PROGRESS'].includes(t.status || '')).length,
      awaiting: allTickets.filter(t => t.status === 'AWAITING_REVIEW').length,
      complete: allTickets.filter(t => t.status === 'COMPLETE').length,
      flagged: 0 // Will need to get flagged count from analyses
    };

    // Get flagged count by checking analyses for red RAG scores
    const flaggedTickets = await db
      .select({ ticketId: analyses.ticketId })
      .from(analyses)
      .innerJoin(tickets, eq(analyses.ticketId, tickets.id))
      .where(and(
        eq(tickets.organizationId, organizationId),
        eq(analyses.ragScore, 'red')
      ));
    
    stats.flagged = flaggedTickets.length;
    
    return stats;
  }

  // Organization-scoped analytics for cross-tenant insights
  async getTrendAnalyticsForOrganization(organizationId: string, days: number = 30) {
    const allTickets = await this.getAllTicketsForOrganization(organizationId);
    
    // Get analyses and injuries for this organization only
    const allAnalyses = await db
      .select()
      .from(analyses)
      .innerJoin(tickets, eq(analyses.ticketId, tickets.id))
      .where(eq(tickets.organizationId, organizationId));
      
    const allInjuries = await db
      .select()
      .from(injuries)
      .innerJoin(tickets, eq(injuries.ticketId, tickets.id))
      .where(eq(tickets.organizationId, organizationId));
    
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
      
      const count = allTickets.filter(ticket => {
        if (!ticket.createdAt) return false;
        const ticketDate = new Date(ticket.createdAt).toISOString().split('T')[0];
        return ticketDate === dateStr;
      }).length;
      
      daily_cases.push({ date: dateStr, count });
    }

    // Case completion rate
    const completedCases = allTickets.filter(t => t.status === 'COMPLETE').length;
    const case_completion_rate = allTickets.length > 0 ? (completedCases / allTickets.length) * 100 : 0;

    // Average processing time
    const completedTicketsWithDates = allTickets.filter(t => 
      t.status === 'COMPLETE' && t.createdAt && t.updatedAt
    );
    
    let avg_processing_time_days = 0;
    if (completedTicketsWithDates.length > 0) {
      const totalDays = completedTicketsWithDates.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt!);
        const updated = new Date(ticket.updatedAt!);
        const diffDays = (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return sum + diffDays;
      }, 0);
      avg_processing_time_days = totalDays / completedTicketsWithDates.length;
    }

    // Risk distribution from analyses
    const ragCounts = { green: 0, amber: 0, red: 0 };
    allAnalyses.forEach(analysis => {
      if (analysis.analyses.ragScore === 'green') ragCounts.green++;
      else if (analysis.analyses.ragScore === 'amber') ragCounts.amber++;
      else if (analysis.analyses.ragScore === 'red') ragCounts.red++;
    });

    // Injury types
    const injuryTypeCounts: Record<string, number> = {};
    allInjuries.forEach(injury => {
      const injuryType = injury.injuries.injuryType || 'Other';
      injuryTypeCounts[injuryType] = (injuryTypeCounts[injuryType] || 0) + 1;
    });
    
    const injury_types = Object.entries(injuryTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Compliance status
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

  async getPerformanceMetricsForOrganization(organizationId: string) {
    const allTickets = await this.getAllTicketsForOrganization(organizationId);
    
    // Get participation events for this organization only
    const allParticipationEvents = await db
      .select()
      .from(workerParticipationEvents)
      .innerJoin(tickets, eq(workerParticipationEvents.ticketId, tickets.id))
      .where(eq(tickets.organizationId, organizationId));
    
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

    // Completion rate
    const completedCases = allTickets.filter(t => t.status === 'COMPLETE').length;
    const completion_rate = allTickets.length > 0 ? (completedCases / allTickets.length) * 100 : 0;

    // Average response time (in hours)
    const completedTicketsWithDates = allTickets.filter(t => 
      t.status === 'COMPLETE' && t.createdAt && t.updatedAt
    );
    
    let avg_response_time = 0;
    if (completedTicketsWithDates.length > 0) {
      const totalHours = completedTicketsWithDates.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt!);
        const updated = new Date(ticket.updatedAt!);
        const diffHours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
        return sum + diffHours;
      }, 0);
      avg_response_time = totalHours / completedTicketsWithDates.length;
    }

    // Participation rate
    const attendedEvents = allParticipationEvents.filter(e => 
      e.worker_participation_events.participationStatus === 'attended'
    ).length;
    const participation_rate = allParticipationEvents.length > 0 
      ? (attendedEvents / allParticipationEvents.length) * 100 
      : 0;

    // Risk cases resolved (red RAG that became complete)
    const riskCasesResolved = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyses)
      .innerJoin(tickets, eq(analyses.ticketId, tickets.id))
      .where(and(
        eq(tickets.organizationId, organizationId),
        eq(analyses.ragScore, 'red'),
        eq(tickets.status, 'COMPLETE')
      ));

    const risk_cases_resolved = riskCasesResolved[0]?.count || 0;

    return {
      cases_this_month,
      cases_last_month,
      completion_rate,
      avg_response_time,
      participation_rate,
      risk_cases_resolved
    };
  }

  // ===============================================
  // SPECIALIST MANAGEMENT
  // ===============================================

  async getAllSpecialists(): Promise<Specialist[]> {
    return db.select().from(specialists).orderBy(specialists.name);
  }

  async getSpecialist(id: string): Promise<Specialist | undefined> {
    const result = await db
      .select()
      .from(specialists)
      .where(eq(specialists.id, id))
      .limit(1);
    
    return result[0];
  }

  async createSpecialist(insertSpecialist: InsertSpecialist): Promise<Specialist> {
    const [specialist] = await db
      .insert(specialists)
      .values(insertSpecialist)
      .returning();
    
    return specialist;
  }

  async updateSpecialist(id: string, updates: Partial<InsertSpecialist>): Promise<Specialist> {
    const [specialist] = await db
      .update(specialists)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(specialists.id, id))
      .returning();
    
    return specialist;
  }

  // ===============================================
  // ESCALATION MANAGEMENT
  // ===============================================

  async getEscalations(filters?: {
    status?: string;
    priority?: string;
    specialistId?: string;
  }): Promise<Escalation[]> {
    let query = db.select().from(escalations);

    if (filters?.status) {
      query = query.where(eq(escalations.status, filters.status));
    }
    if (filters?.priority) {
      query = query.where(eq(escalations.priority, filters.priority));
    }
    if (filters?.specialistId) {
      query = query.where(eq(escalations.assignedSpecialistId, filters.specialistId));
    }

    return query.orderBy(desc(escalations.createdAt));
  }

  async getEscalationWithContext(escalationId: string): Promise<any> {
    const escalation = await db
      .select()
      .from(escalations)
      .where(eq(escalations.id, escalationId))
      .limit(1);

    if (!escalation[0]) return null;

    // Get assigned specialist
    const assignedSpecialist = escalation[0].assignedSpecialistId
      ? await this.getSpecialist(escalation[0].assignedSpecialistId)
      : null;

    // Get specialist assignments
    const assignments = await db
      .select()
      .from(specialistAssignments)
      .leftJoin(specialists, eq(specialistAssignments.specialistId, specialists.id))
      .where(eq(specialistAssignments.escalationId, escalationId));

    // Get conversation context
    const conversation = escalation[0].conversationId
      ? await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, escalation[0].conversationId))
          .limit(1)
      : null;

    // Get ticket context if available
    const ticket = escalation[0].ticketId
      ? await this.getTicket(escalation[0].ticketId)
      : null;

    return {
      escalation: escalation[0],
      assignedSpecialist,
      assignments,
      conversation: conversation?.[0],
      ticket
    };
  }

  async updateEscalationStatus(escalationId: string, status: string, resolutionNotes?: string): Promise<Escalation> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === "resolved") {
      updateData.resolvedAt = new Date();
      if (resolutionNotes) {
        updateData.resolutionNotes = resolutionNotes;
      }
    }

    if (status === "in_progress") {
      updateData.firstResponseAt = new Date();
    }

    const [escalation] = await db
      .update(escalations)
      .set(updateData)
      .where(eq(escalations.id, escalationId))
      .returning();

    return escalation;
  }

  async assignEscalationToSpecialist(params: {
    escalationId: string;
    specialistId: string;
    assignmentReason: string;
    assignmentType: string;
  }): Promise<SpecialistAssignment> {
    const { escalationId, specialistId, assignmentReason, assignmentType } = params;

    // Get escalation to get conversation ID
    const escalation = await db
      .select()
      .from(escalations)
      .where(eq(escalations.id, escalationId))
      .limit(1);

    if (!escalation[0]) {
      throw new Error("Escalation not found");
    }

    // Create assignment
    const [assignment] = await db
      .insert(specialistAssignments)
      .values({
        escalationId,
        specialistId,
        conversationId: escalation[0].conversationId,
        assignmentType,
        assignmentReason,
        routingScore: 90 // Manual assignment gets high score
      })
      .returning();

    // Update escalation with assigned specialist
    await db
      .update(escalations)
      .set({
        assignedSpecialistId: specialistId,
        status: "assigned",
        assignedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(escalations.id, escalationId));

    // Update specialist caseload
    await db
      .update(specialists)
      .set({
        currentCaseload: sql`${specialists.currentCaseload} + 1`,
        lastSeenAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(specialists.id, specialistId));

    return assignment;
  }

  async getEscalationDashboardData(): Promise<any> {
    // Get escalation counts by status
    const statusCounts = await db
      .select({
        status: escalations.status,
        count: sql<number>`count(*)`
      })
      .from(escalations)
      .groupBy(escalations.status);

    // Get escalation counts by priority
    const priorityCounts = await db
      .select({
        priority: escalations.priority,
        count: sql<number>`count(*)`
      })
      .from(escalations)
      .groupBy(escalations.priority);

    // Get recent escalations
    const recentEscalations = await db
      .select()
      .from(escalations)
      .leftJoin(specialists, eq(escalations.assignedSpecialistId, specialists.id))
      .orderBy(desc(escalations.createdAt))
      .limit(10);

    // Get specialist workload
    const specialistWorkload = await db
      .select({
        specialist: specialists,
        activeEscalations: sql<number>`count(${escalations.id})`
      })
      .from(specialists)
      .leftJoin(escalations, and(
        eq(specialists.id, escalations.assignedSpecialistId),
        sql`${escalations.status} IN ('pending', 'assigned', 'in_progress')`
      ))
      .groupBy(specialists.id);

    return {
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>),
      priorityCounts: priorityCounts.reduce((acc, item) => {
        acc[item.priority] = item.count;
        return acc;
      }, {} as Record<string, number>),
      recentEscalations,
      specialistWorkload
    };
  }

  // ===============================================
  // MEDICAL DOCUMENT PROCESSING IMPLEMENTATIONS
  // ===============================================
  
  // Medical Documents
  async createMedicalDocument(document: InsertMedicalDocument): Promise<MedicalDocument> {
    const [result] = await db
      .insert(medicalDocuments)
      .values(document)
      .returning();
    return result;
  }

  async getMedicalDocument(id: string): Promise<MedicalDocument | undefined> {
    const [document] = await db
      .select()
      .from(medicalDocuments)
      .where(eq(medicalDocuments.id, id));
    return document || undefined;
  }

  async getMedicalDocumentsByTicket(ticketId: string): Promise<MedicalDocument[]> {
    return await db
      .select()
      .from(medicalDocuments)
      .where(eq(medicalDocuments.ticketId, ticketId))
      .orderBy(desc(medicalDocuments.createdAt));
  }

  async getMedicalDocumentsByWorker(workerId: string): Promise<MedicalDocument[]> {
    return await db
      .select()
      .from(medicalDocuments)
      .where(eq(medicalDocuments.workerId, workerId))
      .orderBy(desc(medicalDocuments.createdAt));
  }

  async updateMedicalDocument(id: string, updates: Partial<InsertMedicalDocument>): Promise<MedicalDocument> {
    const [document] = await db
      .update(medicalDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(medicalDocuments.id, id))
      .returning();
    return document;
  }

  async findDocumentByChecksum(checksum: string): Promise<MedicalDocument | undefined> {
    const [document] = await db
      .select()
      .from(medicalDocuments)
      .where(eq(medicalDocuments.checksum, checksum));
    return document || undefined;
  }

  async getMedicalDocumentsPendingReview(): Promise<MedicalDocument[]> {
    return await db
      .select()
      .from(medicalDocuments)
      .where(eq(medicalDocuments.requiresReview, true))
      .orderBy(desc(medicalDocuments.createdAt));
  }
  
  // Document Processing Jobs
  async createDocumentProcessingJob(job: InsertDocumentProcessingJob): Promise<DocumentProcessingJob> {
    const [result] = await db
      .insert(documentProcessingJobs)
      .values(job)
      .returning();
    return result;
  }

  async getDocumentProcessingJob(id: string): Promise<DocumentProcessingJob | undefined> {
    const [job] = await db
      .select()
      .from(documentProcessingJobs)
      .where(eq(documentProcessingJobs.id, id));
    return job || undefined;
  }

  async updateDocumentProcessingJob(id: string, updates: Partial<InsertDocumentProcessingJob>): Promise<DocumentProcessingJob> {
    const [job] = await db
      .update(documentProcessingJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentProcessingJobs.id, id))
      .returning();
    return job;
  }

  async getDocumentProcessingJobsByStatus(status: string): Promise<DocumentProcessingJob[]> {
    return await db
      .select()
      .from(documentProcessingJobs)
      .where(eq(documentProcessingJobs.status, status))
      .orderBy(desc(documentProcessingJobs.createdAt));
  }
  
  // Document Processing Logs
  async createDocumentProcessingLog(log: InsertDocumentProcessingLog): Promise<DocumentProcessingLog> {
    const [result] = await db
      .insert(documentProcessingLogs)
      .values(log)
      .returning();
    return result;
  }

  async getDocumentProcessingLogsByDocument(documentId: string): Promise<DocumentProcessingLog[]> {
    return await db
      .select()
      .from(documentProcessingLogs)
      .where(eq(documentProcessingLogs.documentId, documentId))
      .orderBy(desc(documentProcessingLogs.createdAt));
  }

  async getDocumentProcessingLogsByJob(jobId: string): Promise<DocumentProcessingLog[]> {
    return await db
      .select()
      .from(documentProcessingLogs)
      .where(eq(documentProcessingLogs.jobId, jobId))
      .orderBy(desc(documentProcessingLogs.createdAt));
  }
  
  // Helper methods for webhook processing
  async findTicketByFreshdeskId(freshdeskId: number): Promise<Ticket | undefined> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.fdId, freshdeskId));
    return ticket || undefined;
  }

  async findWorkerByEmail(email: string): Promise<Worker | undefined> {
    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.email, email));
    return worker || undefined;
  }

  async findWorkersByName(name: string): Promise<Worker[]> {
    const searchTerms = name.toLowerCase().split(' ');
    const results = await db
      .select()
      .from(workers)
      .where(
        sql`(lower(first_name) LIKE ${'%' + searchTerms[0] + '%'} 
             OR lower(last_name) LIKE ${'%' + searchTerms[0] + '%'} 
             OR lower(first_name || ' ' || last_name) LIKE ${'%' + name.toLowerCase() + '%'})`
      );
    return results;
  }

  async findCasesByWorkerId(workerId: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.workerId, workerId))
      .orderBy(desc(tickets.createdAt));
  }

  async findOpenTicketsForWorker(workerId: string): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.workerId, workerId),
        sql`${tickets.status} NOT IN ('COMPLETE', 'CLOSED', 'ARCHIVED')`
      ))
      .orderBy(desc(tickets.createdAt));
  }

  async linkTicketToFreshdesk(ticketId: string, freshdeskId: number): Promise<void> {
    await db
      .update(tickets)
      .set({ fdId: freshdeskId, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
  }

  async getCaseByTicketId(ticketId: string): Promise<any | undefined> {
    // Note: Using formSubmissions as a proxy for case data since cases table structure varies
    const [caseData] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.ticketId, ticketId));
    return caseData || undefined;
  }

  async updateCase(caseId: string, updates: any): Promise<any> {
    // Note: This is a placeholder - would need proper case table structure
    // For now, we'll update the ticket next step and status
    const [ticket] = await db
      .update(tickets)
      .set({ 
        nextStep: updates.nextStep || undefined,
        lastStep: updates.lastStep || undefined,
        lastStepCompletedAt: updates.lastStepCompletedAt || undefined,
        updatedAt: new Date()
      })
      .where(eq(tickets.id, caseId))
      .returning();
    return ticket;
  }

  // ===============================================
  // MANAGER-INITIATED CHECK SYSTEM STORAGE METHODS
  // ===============================================

  // Check management CRUD
  async createCheck(data: InsertCheck): Promise<Check> {
    const [check] = await db
      .insert(checks)
      .values(data)
      .returning();
    return check;
  }

  async getChecks(): Promise<Check[]> {
    return await db
      .select()
      .from(checks)
      .orderBy(asc(checks.sortOrder), asc(checks.displayName));
  }

  async getActiveChecks(): Promise<Check[]> {
    return await db
      .select()
      .from(checks)
      .where(eq(checks.active, true))
      .orderBy(asc(checks.sortOrder), asc(checks.displayName));
  }

  async getCheckById(id: string): Promise<Check | undefined> {
    const [check] = await db
      .select()
      .from(checks)
      .where(eq(checks.id, id));
    return check || undefined;
  }

  async getCheckByKey(checkKey: string): Promise<Check | undefined> {
    const [check] = await db
      .select()
      .from(checks)
      .where(eq(checks.checkKey, checkKey));
    return check || undefined;
  }

  async updateCheck(id: string, data: Partial<InsertCheck>): Promise<Check> {
    const [check] = await db
      .update(checks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(checks.id, id))
      .returning();
    return check;
  }

  async deleteCheck(id: string): Promise<void> {
    await db
      .delete(checks)
      .where(eq(checks.id, id));
  }

  // Company aliases management
  async createCompanyAlias(data: InsertCompanyAlias): Promise<CompanyAlias> {
    const [alias] = await db
      .insert(companyAliases)
      .values(data)
      .returning();
    return alias;
  }

  async getCompanyAliases(companyId: string): Promise<CompanyAlias[]> {
    return await db
      .select()
      .from(companyAliases)
      .where(eq(companyAliases.companyId, companyId))
      .orderBy(desc(companyAliases.isPreferred), asc(companyAliases.aliasName));
  }

  async findCompanyByAlias(normalizedName: string): Promise<CompanyAlias[]> {
    return await db
      .select()
      .from(companyAliases)
      .where(eq(companyAliases.normalizedName, normalizedName))
      .orderBy(desc(companyAliases.confidence));
  }

  async deleteCompanyAlias(id: string): Promise<void> {
    await db
      .delete(companyAliases)
      .where(eq(companyAliases.id, id));
  }

  async getAllCompanyAliases(): Promise<CompanyAlias[]> {
    return await db
      .select()
      .from(companyAliases)
      .orderBy(desc(companyAliases.confidence), asc(companyAliases.aliasName));
  }

  async getCompanyAliasesForOrganization(organizationId: string): Promise<CompanyAlias[]> {
    // This is an alias for getCompanyAliases for better method naming
    return this.getCompanyAliases(organizationId);
  }

  // Email drafts management
  async createEmailDraft(data: InsertEmailDraft): Promise<EmailDraft> {
    const [draft] = await db
      .insert(emailDrafts)
      .values(data)
      .returning();
    return draft;
  }

  async getEmailDraft(id: string): Promise<EmailDraft | undefined> {
    const [draft] = await db
      .select()
      .from(emailDrafts)
      .where(eq(emailDrafts.id, id));
    return draft || undefined;
  }

  async updateEmailDraft(id: string, data: Partial<InsertEmailDraft>): Promise<EmailDraft> {
    const [draft] = await db
      .update(emailDrafts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailDrafts.id, id))
      .returning();
    return draft;
  }

  async getEmailDraftsForManager(managerEmail: string): Promise<EmailDraft[]> {
    return await db
      .select()
      .from(emailDrafts)
      .where(eq(emailDrafts.managerEmail, managerEmail))
      .orderBy(desc(emailDrafts.createdAt));
  }

  // Check requests management
  async createCheckRequest(data: InsertCheckRequest): Promise<CheckRequest> {
    const [request] = await db
      .insert(checkRequests)
      .values(data)
      .returning();
    return request;
  }

  async getCheckRequest(id: string): Promise<CheckRequest | undefined> {
    const [request] = await db
      .select()
      .from(checkRequests)
      .where(eq(checkRequests.id, id));
    return request || undefined;
  }

  async updateCheckRequest(id: string, data: Partial<InsertCheckRequest>): Promise<CheckRequest> {
    const [request] = await db
      .update(checkRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(checkRequests.id, id))
      .returning();
    return request;
  }

  async getCheckRequestsForManager(managerId: string): Promise<CheckRequest[]> {
    return await db
      .select()
      .from(checkRequests)
      .where(eq(checkRequests.requestedBy, managerId))
      .orderBy(desc(checkRequests.createdAt));
  }

  async getPendingCheckRequests(): Promise<CheckRequest[]> {
    return await db
      .select()
      .from(checkRequests)
      .where(sql`${checkRequests.status} IN ('initiated', 'draft_sent')`)
      .orderBy(desc(checkRequests.createdAt));
  }

  // ===============================================
  // MEDICAL OPINION REQUEST WORKFLOW IMPLEMENTATIONS
  // ===============================================
  
  // Medical Opinion Requests
  async createMedicalOpinionRequest(data: InsertMedicalOpinionRequest): Promise<MedicalOpinionRequest> {
    // Calculate SLA deadline (30 minutes from now by default)
    const slaMinutes = 30; // TODO: Get from organization settings
    const slaDeadline = new Date(Date.now() + (slaMinutes * 60 * 1000));
    
    const [request] = await db
      .insert(medicalOpinionRequests)
      .values({ 
        ...data, 
        slaDeadline,
        requestedAt: new Date()
      })
      .returning();
    return request;
  }

  async getMedicalOpinionRequest(id: string): Promise<MedicalOpinionRequest | undefined> {
    const [request] = await db
      .select()
      .from(medicalOpinionRequests)
      .where(eq(medicalOpinionRequests.id, id));
    return request || undefined;
  }

  async getMedicalOpinionRequestsByTicket(ticketId: string): Promise<MedicalOpinionRequest[]> {
    return await db
      .select()
      .from(medicalOpinionRequests)
      .where(eq(medicalOpinionRequests.ticketId, ticketId))
      .orderBy(desc(medicalOpinionRequests.requestedAt));
  }

  async updateMedicalOpinionRequest(id: string, data: Partial<InsertMedicalOpinionRequest>): Promise<MedicalOpinionRequest> {
    const [request] = await db
      .update(medicalOpinionRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(medicalOpinionRequests.id, id))
      .returning();
    return request;
  }

  async assignMedicalOpinionRequest(id: string, doctorId: string): Promise<MedicalOpinionRequest> {
    const [request] = await db
      .update(medicalOpinionRequests)
      .set({ 
        doctorId,
        status: 'assigned',
        updatedAt: new Date()
      })
      .where(eq(medicalOpinionRequests.id, id))
      .returning();
    return request;
  }

  async completeMedicalOpinionRequest(id: string, opinion: string, recommendations: any, decision: string): Promise<MedicalOpinionRequest> {
    const [request] = await db
      .update(medicalOpinionRequests)
      .set({
        medicalOpinion: opinion,
        recommendations,
        preEmploymentDecision: decision,
        status: 'responded',
        respondedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(medicalOpinionRequests.id, id))
      .returning();
    return request;
  }

  async getPendingMedicalOpinionRequests(): Promise<MedicalOpinionRequest[]> {
    return await db
      .select()
      .from(medicalOpinionRequests)
      .where(sql`${medicalOpinionRequests.status} IN ('pending', 'assigned')`)
      .orderBy(asc(medicalOpinionRequests.requestedAt));
  }

  async getOverdueMedicalOpinionRequests(): Promise<MedicalOpinionRequest[]> {
    const now = new Date();
    return await db
      .select()
      .from(medicalOpinionRequests)
      .where(
        and(
          sql`${medicalOpinionRequests.status} IN ('pending', 'assigned')`,
          sql`${medicalOpinionRequests.slaDeadline} < ${now}`
        )
      )
      .orderBy(asc(medicalOpinionRequests.slaDeadline));
  }
  
  // Organization Settings
  async createOrganizationSettings(data: InsertOrganizationSettings): Promise<OrganizationSettings> {
    const [settings] = await db
      .insert(organizationSettings)
      .values(data)
      .returning();
    return settings;
  }

  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettings | undefined> {
    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId));
    return settings || undefined;
  }

  async updateOrganizationSettings(organizationId: string, data: Partial<InsertOrganizationSettings>): Promise<OrganizationSettings> {
    const [settings] = await db
      .update(organizationSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizationSettings.organizationId, organizationId))
      .returning();
    return settings;
  }
  
  // Reminder Schedule
  async createReminderSchedule(data: InsertReminderSchedule): Promise<ReminderSchedule> {
    const [reminder] = await db
      .insert(reminderSchedule)
      .values(data)
      .returning();
    return reminder;
  }

  async getReminderSchedule(id: string): Promise<ReminderSchedule | undefined> {
    const [reminder] = await db
      .select()
      .from(reminderSchedule)
      .where(eq(reminderSchedule.id, id));
    return reminder || undefined;
  }

  async getRemindersByTicket(ticketId: string): Promise<ReminderSchedule[]> {
    return await db
      .select()
      .from(reminderSchedule)
      .where(eq(reminderSchedule.ticketId, ticketId))
      .orderBy(asc(reminderSchedule.scheduledFor));
  }

  async updateReminderStatus(id: string, status: string, sentAt?: Date): Promise<ReminderSchedule> {
    const [reminder] = await db
      .update(reminderSchedule)
      .set({ 
        status,
        sentAt: sentAt || new Date(),
        updatedAt: new Date()
      })
      .where(eq(reminderSchedule.id, id))
      .returning();
    return reminder;
  }

  async getPendingReminders(): Promise<ReminderSchedule[]> {
    const now = new Date();
    return await db
      .select()
      .from(reminderSchedule)
      .where(
        and(
          eq(reminderSchedule.status, 'pending'),
          sql`${reminderSchedule.scheduledFor} <= ${now}`
        )
      )
      .orderBy(asc(reminderSchedule.scheduledFor));
  }

  async getOverdueReminders(): Promise<ReminderSchedule[]> {
    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    return await db
      .select()
      .from(reminderSchedule)
      .where(
        and(
          eq(reminderSchedule.status, 'pending'),
          sql`${reminderSchedule.scheduledFor} < ${oneDayAgo}`
        )
      )
      .orderBy(asc(reminderSchedule.scheduledFor));
  }
  // ===============================================
  // DOCUMENT EMBEDDINGS FOR RAG
  // ===============================================
  
  async createDocumentEmbedding(embedding: InsertDocumentEmbedding): Promise<DocumentEmbedding> {
    const [result] = await db
      .insert(documentEmbeddings)
      .values(embedding)
      .returning();
    return result;
  }

  async getDocumentEmbeddingsByDocument(documentId: string): Promise<DocumentEmbedding[]> {
    return await db
      .select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.documentId, documentId))
      .orderBy(documentEmbeddings.chunkIndex);
  }

  async getDocumentEmbeddingsByTicket(ticketId: string): Promise<DocumentEmbedding[]> {
    return await db
      .select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.ticketId, ticketId))
      .orderBy(documentEmbeddings.filename, documentEmbeddings.chunkIndex);
  }
  
  // Document methods (aliasing to medical documents for now)
  async getDocument(id: string): Promise<MedicalDocument | undefined> {
    return await this.getMedicalDocument(id);
  }
  
  // Helper methods for Freshdesk integration
  async getAllTicketsWithFreshdeskIds(): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(sql`${tickets.fdId} IS NOT NULL`)
      .orderBy(desc(tickets.createdAt));
  }

  async getDocumentProcessingLogs(documentId: string): Promise<DocumentProcessingLog[]> {
    return await this.getDocumentProcessingLogsByDocument(documentId);
  }
}

export const storage = new DatabaseStorage();

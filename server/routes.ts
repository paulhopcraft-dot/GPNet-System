import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import authRoutes from "./authRoutes";
import { webhookSecurityMiddleware } from "./webhookSecurity";
import { 
  normalizePreEmploymentData, 
  normalizeInjuryData, 
  normalizeMentalHealthData, 
  normalizeExitCheckData, 
  normalizePreventionCheckData,
  normalizeGeneralHealthData,
  type JotformRawPayload 
} from "./jotformPayloadNormalizer";
import { 
  preEmploymentFormSchema, type PreEmploymentFormData, 
  injuryFormSchema, type InjuryFormData,
  mentalHealthFormSchema, type MentalHealthFormData,
  exitCheckFormSchema, type ExitCheckFormData,
  preventionCheckFormSchema, type PreventionCheckFormData,
  generalHealthFormSchema, type GeneralHealthFormData,
  rtwPlanSchema, insertStakeholderSchema,
  emailRiskAssessmentSchema, manualRiskUpdateSchema, stepUpdateSchema 
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { pdfService } from "./pdfService";
import { EnhancedRiskAssessmentService, type RiskInput } from "./riskAssessmentService";
import { michelle, type MichelleContext, type ConversationResponse } from "./michelle";
import { requireAuth } from "./authRoutes";
import { requireAdmin } from "./adminRoutes";
import { createEmailProcessingService, type EmailProcessingResult } from "./emailProcessingService";
import { type RawEmailData } from "./emailParsingService";
import { emailDraftRoutes } from "./emailDraftRoutes";
import { companyMatchingRoutes } from "./companyMatchingRoutes";
import { autoAllocationRoutes } from "./autoAllocationRoutes";
import { caseRoutes } from "./caseRoutes";
import { michelleRoutes } from "./michelleRoutes";
import adminRoutes from "./adminRoutes";
import { externalEmails, aiRecommendations, emailAttachments } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";

// Using centralized risk assessment service for all analysis (duplicate engines removed)
// All analysis logic moved to riskAssessmentService.ts for consistency

// Import schedulers for startup
import { createMedicalCertificateScheduler } from "./medicalCertificateScheduler";
import { createConsultantAppointmentService } from "./consultantAppointmentService";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize services with storage
  const riskAssessmentService = new EnhancedRiskAssessmentService(storage);
  
  // Initialize and start schedulers
  const medicalCertScheduler = createMedicalCertificateScheduler(storage);
  const consultantAppointmentService = createConsultantAppointmentService(storage);
  
  // Start background schedulers
  medicalCertScheduler.start();
  console.log('Medical certificate scheduler started');
  
  // Start consultant appointment checking (daily interval like medical certs)
  setInterval(async () => {
    try {
      await consultantAppointmentService.checkAppointmentAttendance();
    } catch (error) {
      console.error('Error in consultant appointment attendance check:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
  console.log('Consultant appointment attendance checking started');
  // ===========================================
  // SESSION CONFIGURATION & AUTHENTICATION
  // ===========================================
  
  const PgSession = connectPgSimple(session);
  
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true
    }),
    name: 'gpnet.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Mount authentication routes
  app.use('/api/auth', authRoutes);
  
  // ===========================================
  // SERVICE INITIALIZATION
  // ===========================================
  
  const emailProcessingService = createEmailProcessingService(storage);
  
  // ===========================================
  // EXTERNAL EMAIL PROCESSING ENDPOINTS
  // ===========================================
  
  // Process external email forwarded by manager
  app.post("/api/external-emails/process", async (req, res) => {
    try {
      console.log("Processing external email from manager");
      
      const { email, organizationId, forwardedBy } = req.body;
      
      if (!email || !organizationId || !forwardedBy) {
        return res.status(400).json({ 
          error: 'Missing required fields: email, organizationId, forwardedBy' 
        });
      }

      // Process the email using the email processing service
      const emailData = {
        from: email.from,
        to: email.to || forwardedBy,
        subject: email.subject || 'External Email',
        body: email.content || email.body || '',
        date: new Date().toISOString(),
        messageId: email.messageId || `external-${Date.now()}`,
        attachments: email.attachments || []
      };

      const result: EmailProcessingResult = await (emailProcessingService as any).processEmail(
        emailData, 
        organizationId, 
        forwardedBy
      );

      res.json({ 
        success: true, 
        message: 'External email processed successfully',
        emailId: result.externalEmailId,
        ticketId: result.ticketId,
        aiAnalysis: result.aiAnalysis,
        recommendations: result.aiRecommendations
      });
    } catch (error) {
      console.error('Error processing external email:', error);
      res.status(500).json({ 
        error: 'Failed to process external email' 
      });
    }
  });

  // Get external email status
  app.get("/api/external-emails/:emailId/status", async (req, res) => {
    try {
      const { emailId } = req.params;
      
      const email = await db.select()
        .from(externalEmails)
        .where(eq(externalEmails.id, emailId))
        .limit(1);
      
      if (email.length === 0) {
        return res.status(404).json({ error: 'Email not found' });
      }
      
      res.json({
        id: email[0].id,
        status: email[0].processingStatus,
        ticketId: email[0].ticketId,
        urgencyLevel: email[0].urgencyLevel,
        confidenceScore: email[0].confidenceScore,
        processedAt: (email[0] as any).processedAt
      });
      
    } catch (error) {
      console.error("Failed to get email status:", error);
      res.status(500).json({ error: "Failed to retrieve email status" });
    }
  });

  // Manager dashboard - Get processing statistics
  app.get("/api/external-emails/stats", async (req, res) => {
    try {
      const { organizationId } = req.query;
      
      let query = db.select().from(externalEmails);
      if (organizationId) {
        query = query.where(eq(externalEmails.organizationId, organizationId as string)) as any;
      }
      
      const emails = await query;
      
      const stats = {
        total: emails.length,
        processed: emails.filter(e => e.processingStatus === 'processed').length,
        pending: emails.filter(e => e.processingStatus === 'pending').length,
        processing: emails.filter(e => e.processingStatus === 'processing').length,
        errors: emails.filter(e => e.processingStatus === 'error').length,
        matched: emails.filter(e => e.ticketId).length,
        unmatched: emails.filter(e => !e.ticketId).length,
        urgencyDistribution: {
          low: emails.filter(e => e.urgencyLevel === 'low').length,
          medium: emails.filter(e => e.urgencyLevel === 'medium').length,
          high: emails.filter(e => e.urgencyLevel === 'high').length,
          critical: emails.filter(e => e.urgencyLevel === 'critical').length
        },
        averageConfidenceScore: emails
          .filter(e => e.confidenceScore)
          .reduce((sum, e) => sum + (e.confidenceScore || 0), 0) / 
          emails.filter(e => e.confidenceScore).length || 0
      };
      
      res.json(stats);
      
    } catch (error) {
      console.error("Failed to get email processing stats:", error);
      res.status(500).json({ error: "Failed to retrieve statistics" });
    }
  });

  // ===========================================
  // JOTFORM WEBHOOK ENDPOINTS
  // ===========================================

  // Pre-employment form webhook
  app.post("/api/webhook/jotform", webhookSecurityMiddleware, async (req, res) => {
    try {
      console.log("Received Jotform webhook - processing pre-employment form");
      
      // Normalize Jotform payload before validation
      const normalizedData = normalizePreEmploymentData(req.body as JotformRawPayload);
      
      // Validate the form data
      const validationResult = preEmploymentFormSchema.safeParse(normalizedData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid form data", details: errorMessage });
      }

      const formData = validationResult.data;

      // Create worker record
      const worker = await storage.createWorker({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        phone: formData.phone,
        email: formData.email,
        roleApplied: formData.roleApplied,
        site: formData.site || null,
      });

      // Create ticket
      const ticket = await storage.createTicket({
        workerId: worker.id,
        caseType: "pre_employment",
        status: "NEW",
      });

      // Create form submission record
      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      // Perform automated analysis using centralized risk assessment service
      const riskInput: RiskInput = {
        type: 'form',
        content: formData,
        timestamp: new Date(),
        source: 'pre_employment_submission'
      };
      // Get organizationId for probation validation (critical for BDD compliance)
      const organizationId = (ticket as any).organizationId || (worker as any).organizationId || undefined;
      const analysisResult = await riskAssessmentService.assessRisk([riskInput], undefined, organizationId);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: `Automated analysis: ${analysisResult.triggerReasons.join('; ')}. Risk factors: ${analysisResult.riskFactors.join(', ')}. Confidence: ${analysisResult.confidence}%`,
      });

      // Update ticket status to AWAITING_REVIEW
      await storage.updateTicketStatus(ticket.id, "AWAITING_REVIEW");

      // Automatically create Freshdesk ticket if integration is available
      let freshdeskInfo = null;
      try {
        const { freshdeskService } = await import("./freshdeskService");
        
        if (freshdeskService.isAvailable()) {
          const updatedTicket = await storage.getTicket(ticket.id);
          
          if (updatedTicket) {
            const existingMapping = await storage.getFreshdeskTicketByGpnetId(ticket.id);
            
            if (!existingMapping) {
              const freshdeskTicket = await freshdeskService.createTicket(updatedTicket, worker);
            
              if (freshdeskTicket) {
                const mapping = await storage.createFreshdeskTicket({
                  gpnetTicketId: ticket.id,
                  freshdeskTicketId: freshdeskTicket.id,
                  freshdeskUrl: `https://${process.env.FRESHDESK_DOMAIN}.freshdesk.com/a/tickets/${freshdeskTicket.id}`,
                  syncStatus: 'synced',
                  freshdeskData: freshdeskTicket
                });

                await storage.createFreshdeskSyncLog(
                  freshdeskService.createSyncLog(
                    ticket.id,
                    freshdeskTicket.id,
                    'create',
                    'to_freshdesk',
                    'success',
                    { freshdeskTicket, trigger: 'auto_pre_employment' }
                  )
                );

                freshdeskInfo = {
                  freshdeskTicketId: freshdeskTicket.id,
                  freshdeskUrl: mapping.freshdeskUrl
                };

                console.log(`Auto-created Freshdesk ticket ${freshdeskTicket.id} for case ${ticket.id}`);
              }
            }
          }
        }
      } catch (freshdeskError) {
        console.error("Freshdesk auto-creation failed (non-blocking):", freshdeskError);
      }

      console.log(`Pre-employment case ${ticket.id} created with automated analysis`);

      res.json({
        success: true,
        ticketId: ticket.id,
        workerId: worker.id,
        caseType: "pre_employment",
        status: "AWAITING_REVIEW",
        analysis: {
          ragScore: analysisResult.ragScore,
          fitClassification: analysisResult.fitClassification,
          confidence: analysisResult.confidence
        },
        freshdeskInfo,
        message: "Pre-employment check processed successfully with automated analysis",
      });

    } catch (error) {
      console.error("Error processing pre-employment webhook:", error);
      res.status(500).json({ error: "Failed to process pre-employment form" });
    }
  });

  // Injury form webhook
  app.post("/api/webhook/injury", webhookSecurityMiddleware, async (req, res) => {
    try {
      console.log("Received injury webhook - processing injury form");
      
      const normalizedData = normalizeInjuryData(req.body as JotformRawPayload);
      
      const validationResult = injuryFormSchema.safeParse(normalizedData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid injury form data", details: errorMessage });
      }

      const formData = validationResult.data;

      const worker = await storage.createWorker({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: "",
        phone: formData.phone,
        email: formData.email,
        roleApplied: formData.position,
        site: formData.department || null,
      });

      const ticket = await storage.createTicket({
        workerId: worker.id,
        caseType: "injury",
        claimType: formData.claimType,
        status: "NEW",
        priority: formData.severity === "major" || formData.severity === "serious" ? "high" : "medium",
      });

      await storage.createInjury({
        ticketId: ticket.id,
        incidentDate: formData.incidentDate,
        incidentTime: formData.incidentTime || null,
        location: formData.location,
        description: formData.description,
        bodyPartsAffected: formData.bodyPartsAffected,
        injuryType: formData.injuryType,
        severity: formData.severity,
        witnessDetails: formData.witnessDetails || null,
        immediateAction: formData.immediateAction || null,
        medicalTreatment: formData.medicalTreatment,
        timeOffWork: formData.timeOffWork,
        estimatedRecovery: formData.estimatedRecovery || null,
      });

      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      // Perform automated analysis using centralized risk assessment service
      const riskInput: RiskInput = {
        type: 'form',
        content: formData,
        timestamp: new Date(),
        source: 'injury_form_submission'
      };
      // Note: Injury forms don't need probation validation, only pre-employment checks do
      const analysisResult = await riskAssessmentService.assessRisk([riskInput]);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: `Injury analysis: ${analysisResult.triggerReasons.join('; ')}. Risk factors: ${analysisResult.riskFactors.join(', ')}. Confidence: ${analysisResult.confidence}%`,
      });

      await storage.updateTicketStatus(ticket.id, "AWAITING_REVIEW");

      console.log(`Injury case ${ticket.id} created with automated analysis`);

      res.json({
        success: true,
        ticketId: ticket.id,
        caseType: "injury",
        status: "AWAITING_REVIEW",
        analysis: {
          ragScore: analysisResult.ragScore,
          fitClassification: analysisResult.fitClassification,
          confidence: analysisResult.confidence
        },
        message: "Injury case processed successfully with automated analysis",
      });

    } catch (error) {
      console.error("Error processing injury webhook:", error);
      res.status(500).json({ error: "Failed to process injury form" });
    }
  });

  // Mental health form webhook
  app.post("/api/webhook/mental-health", webhookSecurityMiddleware, async (req, res) => {
    try {
      console.log("Received mental health webhook - processing mental health form");
      
      const normalizedData = normalizeMentalHealthData(req.body as JotformRawPayload);
      
      const validationResult = mentalHealthFormSchema.safeParse(normalizedData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid mental health form data", details: errorMessage });
      }

      const formData = validationResult.data;

      const worker = await storage.createWorker({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth || "", 
        phone: formData.phone,
        email: formData.email,
        roleApplied: formData.position || "Unknown Position",
        site: formData.department || null,
      });

      const ticket = await storage.createTicket({
        workerId: worker.id,
        caseType: "mental_health",
        status: "NEW",
        priority: formData.urgencyLevel === "immediate" || formData.urgencyLevel === "high" ? "high" : "medium",
      });

      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      await storage.updateTicketStatus(ticket.id, "AWAITING_REVIEW");

      console.log(`Created mental health case ${ticket.id}`);

      res.json({
        success: true,
        ticketId: ticket.id,
        caseType: "mental_health",
        status: "AWAITING_REVIEW",
        message: "Mental health assessment processed successfully",
      });

    } catch (error) {
      console.error("Error processing mental health webhook:", error);
      res.status(500).json({ error: "Failed to process mental health form" });
    }
  });

  // ===========================================
  // DASHBOARD AND ANALYTICS ENDPOINTS
  // ===========================================

  // Dashboard statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ===========================================
  // MICHELLE AI ASSISTANT ENDPOINTS
  // ===========================================

  // Michelle chat endpoint removed - handled by michelleRoutes

  // ===========================================
  // MOUNT ADDITIONAL ROUTE MODULES
  // ===========================================

  // Mount additional routes modules
  app.use('/api/email-drafts', emailDraftRoutes);
  app.use('/api/company-matching', companyMatchingRoutes);
  app.use('/api/auto-allocation', autoAllocationRoutes);
  app.use('/api/cases', caseRoutes);
  
  // Mount critical missing routes for Michele and Admin
  app.use('/api/michelle', michelleRoutes);
  app.use('/api/admin', adminRoutes);

  // ===========================================
  // SERVER CREATION
  // ===========================================

  return createServer(app);
}
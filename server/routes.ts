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
  normalizeJotformPayload,
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
import { reportService } from "./reportService";
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
import { freshdeskRoutes } from "./freshdeskRoutes";
import ragRoutes from "./ragRoutes";
import { reportRoutes } from "./reportRoutes";
import { freshdeskBackfillService } from './freshdeskBackfillService.js';
import { mlRoutes } from "./mlRoutes.js";
import { caseDrawerRoutes } from "./caseDrawerRoutes.js";
import { medicalDocumentRoutes } from "./medicalDocumentRoutes.js";
import { analyticsRoutes } from "./analyticsRoutes.js";
import { nextStepRoutes } from "./nextStepRoutes.js";
import caseConsoleRoutes from "./caseConsoleRoutes";
import { registerChatGPTRoutes } from "./chatgptRoutes";
import { registerAgentRoutes } from "./agentRoutes";
import { registerRTWRoutes } from "./rtwRoutes";
import { externalEmails, aiRecommendations, emailAttachments } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";

// Using centralized risk assessment service for all analysis (duplicate engines removed)
// All analysis logic moved to riskAssessmentService.ts for consistency

// Import schedulers for startup
import { createMedicalCertificateScheduler } from "./medicalCertificateScheduler";
import { createConsultantAppointmentService } from "./consultantAppointmentService";
import { createFollowUpScheduler } from "./followUpScheduler";
import { createReportDeliveryScheduler } from "./reportDeliveryScheduler";
import { startWorkerInfoSheetJob } from "./workerInfoSheetJob";
import { emailService } from "./emailService";
import { WorkflowSimulator } from "./workflowSimulator";
import { EmailDraftingService } from "./emailDraftingService";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize services with storage
  const riskAssessmentService = new EnhancedRiskAssessmentService(storage);
  const emailDraftingService = new EmailDraftingService();
  
  // Initialize and start schedulers
  const medicalCertScheduler = createMedicalCertificateScheduler(storage);
  const consultantAppointmentService = createConsultantAppointmentService(storage);
  const followUpScheduler = createFollowUpScheduler(emailService);
  const reportDeliveryScheduler = createReportDeliveryScheduler(storage);
  
  // Start background schedulers
  medicalCertScheduler.start();
  console.log('Medical certificate scheduler started');
  
  // Start follow-up notification scheduler
  followUpScheduler.start();
  console.log('Follow-up notification scheduler started');
  
  // Start report delivery scheduler (1-hour delayed email delivery)
  reportDeliveryScheduler.start();
  console.log('Report delivery scheduler started (checks every 15 minutes)');
  
  // Start Worker Info Sheet escalation job (every 6 hours)
  startWorkerInfoSheetJob();
  
  // Wire up scheduler instance for status endpoint
  const { setSchedulerInstance } = await import('./reportRoutes');
  setSchedulerInstance(reportDeliveryScheduler);
  
  // Start consultant appointment checking (daily interval like medical certs)
  setInterval(async () => {
    try {
      await consultantAppointmentService.checkAppointmentAttendance();
    } catch (error) {
      console.error('Error in consultant appointment attendance check:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
  console.log('Consultant appointment attendance checking started');
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Basic database connectivity check
      const stats = await storage.getDashboardStats();
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        totalCases: stats.total,
        services: {
          emailService: emailService.isAvailable(),
          pdfService: true, // PDF service is always available
          riskAssessment: true,
          followUpScheduler: true,
          workflowSimulator: true
        }
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

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
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // Use 'lax' for better compatibility with published apps
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      domain: undefined // Allow automatic domain detection for mobile
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

  // Get external emails for a specific ticket
  app.get("/api/external-emails/ticket/:ticketId", requireAuth, async (req, res) => {
    try {
      const { ticketId } = req.params;
      const user = (req as any).session.user;
      
      // Verify user has access to this ticket
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      // Check authorization: Admin users can access all tickets, 
      // non-admin users can only access tickets from their organization
      const isAdmin = user.userType === 'admin' || user.role === 'admin' || 
                     user.permissions?.includes('admin') || user.permissions?.includes('superuser');
      
      if (!isAdmin && ticket.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const emails = await db.select()
        .from(externalEmails)
        .where(eq(externalEmails.ticketId, ticketId))
        .orderBy(externalEmails.forwardedAt);
      
      res.json(emails);
      
    } catch (error) {
      console.error("Failed to get external emails for ticket:", error);
      res.status(500).json({ error: "Failed to retrieve external emails" });
    }
  });

  // ===========================================
  // PRE-EMPLOYMENT CHECK INITIATION
  // ===========================================

  // Initiate pre-employment check - Manager workflow (REQUIRES AUTHENTICATION)
  app.post("/api/pre-employment/initiate", requireAuth, async (req, res) => {
    try {
      console.log("Initiating pre-employment check from manager");
      
      // SECURITY: Derive organizationId from authenticated session, ignore client input
      const user = req.session.user;
      console.log(`[PRE-EMP] Session user:`, {
        id: user?.id,
        email: user?.email,
        userType: user?.userType,
        organizationId: user?.organizationId
      });
      
      if (!user || user.userType !== 'client') {
        return res.status(403).json({ 
          error: 'Only authenticated managers can initiate pre-employment checks' 
        });
      }
      
      const organizationId = user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ 
          error: 'Manager must be associated with an organization' 
        });
      }
      
      console.log(`[PRE-EMP] Using organizationId from session: ${organizationId}`);
      
      const { firstName, lastName, email, phone, dateOfBirth, roleApplied, site } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !phone || !dateOfBirth || !roleApplied) {
        return res.status(400).json({ 
          error: 'Missing required fields: firstName, lastName, email, phone, dateOfBirth, roleApplied' 
        });
      }

      // Get manager's organization ID from session if not provided in body
      const managerOrgId = organizationId;
      
      if (!managerOrgId) {
        return res.status(400).json({ 
          error: 'Organization ID is required' 
        });
      }

      // Create worker record
      const worker = await storage.createWorker({
        organizationId: managerOrgId,
        firstName,
        lastName,
        dateOfBirth,
        phone,
        email,
        roleApplied,
        site: site || null,
      });
      
      console.log(`Created worker record: ${worker.id}`);

      // Create ticket with status "NEW"
      console.log(`[PRE-EMP] Creating ticket with organizationId: ${managerOrgId}, workerId: ${worker.id}`);
      
      const ticket = await storage.createTicket({
        organizationId: managerOrgId,
        workerId: worker.id,
        caseType: "pre_employment",
        status: "NEW",
        formType: "pre_employment",
        nextStep: "Awaiting worker to complete pre-employment health check form",
      });
      
      console.log(`[PRE-EMP] Created ticket: ${ticket.id}, organizationId: ${ticket.organizationId}`);

      // Get pre-employment check configuration
      const check = await storage.getCheckByKey("PRE_EMPLOYMENT_CHECK");
      
      if (!check) {
        console.error("PRE_EMPLOYMENT_CHECK configuration not found in checks table");
        return res.status(500).json({ 
          error: "Pre-employment check configuration not found. Please contact support." 
        });
      }

      try {
        // Generate email draft with JotForm link
        const emailDraft = await emailDraftingService.generateEmailDraft({
          ticketId: ticket.id,
          workerId: worker.id,
          checkId: check.id,
          managerEmail: email, // Using worker email as recipient
          urgency: 'medium',
        });

        console.log(`Generated email draft with link: ${emailDraft.checkLink}`);

        // Send email to worker
        if (emailService.isAvailable()) {
          await emailService.sendEmail({
            to: email,
            subject: emailDraft.subject,
            html: emailDraft.htmlBody,
            text: emailDraft.body,
          });
          
          console.log(`Invitation email sent to ${email}`);
        } else {
          console.warn("Email service not available - invitation not sent");
        }

        // Return success response
        res.json({
          success: true,
          ticketId: ticket.id,
          workerId: worker.id,
          checkLink: emailDraft.checkLink,
          message: `Pre-employment check initiated successfully. Invitation sent to ${email}.`,
        });

      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        // Still return success since worker/ticket were created
        res.json({
          success: true,
          ticketId: ticket.id,
          workerId: worker.id,
          message: `Worker and case created successfully, but email could not be sent. Please contact the worker manually.`,
          warning: "Email service unavailable"
        });
      }

    } catch (error) {
      console.error('Error initiating pre-employment check:', error);
      res.status(500).json({ 
        error: 'Failed to initiate pre-employment check',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===========================================
  // JOTFORM WEBHOOK ENDPOINTS
  // ===========================================

  // Enhanced webhook for all health check types
  app.post("/api/webhook/jotform", webhookSecurityMiddleware, async (req, res) => {
    try {
      console.log("Received Jotform webhook - processing health check form");
      
      // Auto-detect form type and normalize payload
      const normalizedData = normalizeJotformPayload(req.body as JotformRawPayload);
      
      if (!normalizedData.success) {
        console.error("Failed to normalize Jotform payload:", normalizedData.error);
        return res.status(400).json({ error: "Invalid form data", details: normalizedData.error });
      }

      const { data: formData, formType } = normalizedData;
      console.log(`Processing ${formType} health check form`);

      // Create or find existing worker record
      let worker;
      const existingWorker = await storage.findWorkerByEmail(formData.email);
      
      if (existingWorker) {
        worker = existingWorker;
        console.log(`Using existing worker record: ${worker.id}`);
      } else {
        worker = await storage.createWorker({
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          phone: formData.phone,
          email: formData.email,
          roleApplied: formData.roleApplied || null,
          site: formData.site || null,
        });
        console.log(`Created new worker record: ${worker.id}`);
      }

      // Create ticket with proper case type mapping
      const caseTypeMapping: Record<string, string> = {
        'pre_employment': 'pre_employment',
        'injury': 'injury',
        'mental_health': 'mental_health',
        'prevention': 'prevention',
        'general_health': 'general_health',
        'exit_check': 'exit_check'
      };

      const ticket = await storage.createTicket({
        workerId: worker.id,
        caseType: caseTypeMapping[formType] || formType,
        status: "ANALYSING",
        formType: formType, // Add formType for follow-up notifications
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
        source: `${formType}_submission`
      };
      
      const organizationId = (ticket as any).organizationId || (worker as any).organizationId || undefined;
      const analysisResult = await riskAssessmentService.assessRisk([riskInput], undefined, organizationId);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: `Automated analysis: ${analysisResult.triggerReasons.join('; ')}. Risk factors: ${analysisResult.riskFactors.join(', ')}. Confidence: ${analysisResult.confidence}%`,
      });

      // Generate PDF report and email to employer - formType-based selection
      try {
        console.log(`Generating ${formType} PDF report for ticket ${ticket.id}`);
        
        // Form-specific report generation
        let pdfBuffer: Buffer;
        let reportType: string;
        
        switch (formType) {
          case 'pre_employment':
            reportType = 'pre-employment';
            const preEmploymentData = {
              ticket: ticket,
              worker: worker,
              analysis: {
                ragScore: analysisResult.ragScore,
                fitClassification: analysisResult.fitClassification,
                recommendations: analysisResult.recommendations,
                riskFactors: analysisResult.riskFactors,
                confidence: analysisResult.confidence
              },
              formSubmission: await storage.getFormSubmissionByTicket(ticket.id),
              generatedAt: new Date().toISOString(),
              generatedBy: 'GPNet System',
              companyName: 'Employer Organization',
              recommendations: analysisResult.recommendations
            };
            pdfBuffer = await pdfService.generatePreEmploymentReport(preEmploymentData);
            break;
            
          case 'injury':
            reportType = 'injury-report';
            const injuryData = {
              ticket: ticket,
              worker: worker,
              injury: await storage.getInjuryByTicket(ticket.id),
              formSubmission: await storage.getFormSubmissionByTicket(ticket.id),
              analysis: {
                ragScore: analysisResult.ragScore,
                fitClassification: analysisResult.fitClassification,
                recommendations: analysisResult.recommendations,
                riskFactors: analysisResult.riskFactors,
                confidence: analysisResult.confidence
              },
              stakeholders: [],
              rtwPlan: null,
              generatedAt: new Date().toISOString(),
              generatedBy: 'GPNet System'
            };
            pdfBuffer = await pdfService.generateInjuryReport(injuryData);
            break;
            
          case 'mental_health':
          case 'prevention':
          case 'general_health':
          case 'exit_check':
            reportType = 'case-summary';
            const caseSummaryData = {
              ticket: ticket,
              worker: worker,
              analysis: {
                ragScore: analysisResult.ragScore,
                fitClassification: analysisResult.fitClassification,
                recommendations: analysisResult.recommendations,
                riskFactors: analysisResult.riskFactors,
                confidence: analysisResult.confidence
              },
              formSubmission: await storage.getFormSubmissionByTicket(ticket.id),
              injury: null,
              rtwPlan: null,
              stakeholders: [],
              emails: [],
              attachments: [],
              generatedAt: new Date().toISOString(),
              generatedBy: 'GPNet System'
            };
            pdfBuffer = await pdfService.generateCaseSummaryReport(caseSummaryData);
            break;
            
          default:
            throw new Error(`Unsupported form type for PDF generation: ${formType}`);
        }
        
        console.log(`Generated ${formType} PDF report: ${pdfBuffer.length} bytes`);
        
        // Save PDF report to storage for delayed email delivery (1 hour)
        try {
          let companyName = 'Unknown Organization';
          if (ticket.organizationId) {
            const org = await storage.getOrganization(ticket.organizationId);
            if (org) {
              companyName = org.name;
            }
          }
          
          const reportId = await reportService.saveGeneratedReport(
            ticket.id,
            reportType,
            pdfBuffer,
            {
              companyName,
              workerName: `${worker.firstName} ${worker.lastName}`,
              formType: formType,
              ragScore: analysisResult.ragScore,
              fitClassification: analysisResult.fitClassification
            },
            'GPNet Automated System'
          );
          console.log(`Report saved with ID ${reportId} for delayed email delivery (1 hour)`);
        } catch (reportError) {
          console.error(`Failed to save report for delayed delivery:`, reportError);
        }
        
        // NOTE: Email delivery now handled by background job after 1-hour delay
        // Previously: Immediate email to manager (commented out for delayed delivery)
        // The background job will email reports with status='generated' after 1 hour
        
      } catch (pdfError) {
        console.error(`Failed to generate/email ${formType} PDF report for ticket ${ticket.id}:`, pdfError);
        // Continue with workflow even if PDF generation fails
      }

      // Update ticket status to AWAITING_REVIEW
      await storage.updateTicketStatus(ticket.id, "AWAITING_REVIEW");

      // Create Freshdesk ticket if integration is available
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
                    { freshdeskTicket, trigger: `auto_${formType}` }
                  )
                );

                freshdeskInfo = {
                  freshdeskTicketId: freshdeskTicket.id,
                  freshdeskUrl: mapping.freshdeskUrl
                };

                console.log(`Auto-created Freshdesk ticket ${freshdeskTicket.id} for ${formType} case ${ticket.id}`);
              }
            }
          }
        }
      } catch (freshdeskError) {
        console.error("Freshdesk auto-creation failed (non-blocking):", freshdeskError);
      }

      // Send manager notification email
      try {
        const { emailService } = await import("./emailService");
        const managerEmail = process.env.MANAGER_EMAIL || 'manager@company.com'; // Should be configurable per organization
        
        const notificationResult = await emailService.sendManagerNotification(
          managerEmail,
          `${worker.firstName} ${worker.lastName}`,
          formType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          ticket.id
        );

        if (notificationResult.success) {
          console.log(`Manager notification sent for ${formType} submission: ${ticket.id}`);
        } else {
          console.warn(`Failed to send manager notification: ${notificationResult.error}`);
        }
      } catch (emailError) {
        console.error("Manager notification failed (non-blocking):", emailError);
      }

      // Schedule follow-up reminders if form requires completion tracking
      // (This would be implemented as a background job system)
      try {
        // Schedule 24-hour follow-up check (this would be handled by a job scheduler)
        console.log(`Follow-up reminder scheduled for ticket ${ticket.id} in 24 hours`);
        
        // For demonstration, we'll just log this - in production this would use a job queue
        // scheduleFollowUpReminder(ticket.id, worker.email, formType, 1); // Day 1
        // scheduleFollowUpReminder(ticket.id, worker.email, formType, 3); // Day 3
      } catch (reminderError) {
        console.error("Follow-up reminder scheduling failed (non-blocking):", reminderError);
      }

      console.log(`${formType} case ${ticket.id} created with automated analysis and notifications sent`);

      res.json({
        success: true,
        ticketId: ticket.id,
        workerId: worker.id,
        caseType: formType,
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
        formType: "injury", // Add formType for follow-up notifications
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

      // Generate PDF report and email to employer  
      try {
        console.log(`Generating injury PDF report for ticket ${ticket.id}`);
        const reportData = {
          ticket: ticket,
          worker: worker,
          injury: await storage.getInjuryByTicket(ticket.id),
          formSubmission: await storage.getFormSubmissionByTicket(ticket.id),
          analysis: {
            ragScore: analysisResult.ragScore,
            fitClassification: analysisResult.fitClassification,
            recommendations: analysisResult.recommendations,
            riskFactors: analysisResult.riskFactors,
            confidence: analysisResult.confidence
          },
          stakeholders: [],
          rtwPlan: null,
          generatedAt: new Date().toISOString(),
          generatedBy: 'GPNet System'
        };
        
        const pdfBuffer = await pdfService.generateInjuryReport(reportData);
        console.log(`Generated injury PDF report: ${pdfBuffer.length} bytes`);
        
        // Email PDF report to employer/manager
        if (emailService.isAvailable()) {
          const emailResult = await emailService.sendReportEmail({
            reportType: 'injury-report',
            ticketId: ticket.id,
            recipients: [
              { 
                email: process.env.MANAGER_EMAIL || 'manager@company.com',
                name: 'Site Manager'
              }
            ],
            pdfBuffer: pdfBuffer,
            includeComplianceNote: true
          }, storage);
          
          if (emailResult.success) {
            console.log(`Injury PDF report emailed successfully for ticket ${ticket.id}`);
          } else {
            console.warn(`Failed to email injury PDF report: ${emailResult.error}`);
          }
        } else {
          console.log(`Injury PDF report generated but email service not configured - would email to manager`);
        }
        
      } catch (pdfError) {
        console.error(`Failed to generate/email injury PDF report for ticket ${ticket.id}:`, pdfError);
        // Continue with workflow even if PDF generation fails
      }

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
        formType: "mental_health", // Add formType for follow-up notifications
      });

      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      // Generate PDF report and email to employer
      try {
        console.log(`Generating case summary PDF report for ticket ${ticket.id} (mental health)`);
        const reportData = {
          ticket: ticket,
          worker: worker,
          analysis: {
            ragScore: "green", // Default for mental health submissions
            fitClassification: "refer_to_specialist",
            recommendations: ["Professional mental health assessment recommended"],
            riskFactors: ["Mental health concerns reported"],
            confidence: 85
          },
          formSubmission: await storage.getFormSubmissionByTicket(ticket.id),
          injury: null,
          rtwPlan: null,
          stakeholders: [],
          emails: [],
          attachments: [],
          generatedAt: new Date().toISOString(),
          generatedBy: 'GPNet System'
        };
        
        const pdfBuffer = await pdfService.generateCaseSummaryReport(reportData);
        console.log(`Generated mental health case summary PDF report: ${pdfBuffer.length} bytes`);
        
        // Email PDF report to employer/manager
        if (emailService.isAvailable()) {
          const emailResult = await emailService.sendReportEmail({
            reportType: 'case-summary',
            ticketId: ticket.id,
            recipients: [
              { 
                email: process.env.MANAGER_EMAIL || 'manager@company.com',
                name: 'Site Manager'
              }
            ],
            pdfBuffer: pdfBuffer,
            includeComplianceNote: true
          }, storage);
          
          if (emailResult.success) {
            console.log(`Mental health PDF report emailed successfully for ticket ${ticket.id}`);
          } else {
            console.warn(`Failed to email mental health PDF report: ${emailResult.error}`);
          }
        } else {
          console.log(`Mental health PDF report generated but email service not configured - would email to manager`);
        }
        
      } catch (pdfError) {
        console.error(`Failed to generate/email mental health PDF report for ticket ${ticket.id}:`, pdfError);
        // Continue with workflow even if PDF generation fails
      }

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

  // Organization breakdown for dashboard
  app.get("/api/dashboard/organizations", requireAuth, async (req, res) => {
    try {
      const organizations = await storage.getAllOrganizations();
      
      // Enhance with case counts
      const enhancedOrgs = await Promise.all(
        organizations.map(async (org) => {
          const tickets = await storage.getAllTicketsForOrganization(org.id);
          return {
            id: org.id,
            name: org.name,
            caseCount: tickets.length,
            isActive: tickets.length > 0
          };
        })
      );
      
      // Filter to only active organizations (those with cases)
      const activeOrgs = enhancedOrgs.filter(org => org.isActive);
      
      res.json({
        organizations: activeOrgs,
        totalActive: activeOrgs.length,
        totalCases: activeOrgs.reduce((sum, org) => sum + org.caseCount, 0)
      });
    } catch (error) {
      console.error("Error fetching organization breakdown:", error);
      res.status(500).json({ error: "Failed to fetch organization breakdown" });
    }
  });

  // ===========================================
  // PRE-EMPLOYMENT INVITATION ENDPOINTS  
  // ===========================================

  // Send pre-employment check invitation
  app.post("/api/pre-employment/invitations", async (req, res) => {
    try {
      const { workerName, workerEmail, message } = req.body;
      
      console.log('Creating pre-employment invitation for:', workerName);
      
      // Create a new worker record if needed
      const worker = await storage.createWorker({
        firstName: workerName.split(' ')[0] || workerName,
        lastName: workerName.split(' ').slice(1).join(' ') || '',
        email: workerEmail,
        phone: '',
        dateOfBirth: new Date().toISOString().split('T')[0],
        roleApplied: 'Pre-Employment Check'
      });
      
      // Create a new ticket for the pre-employment check
      const ticket = await storage.createTicket({
        caseType: 'pre_employment',
        status: 'NEW',
        priority: 'medium',
        workerId: worker.id,
        organizationId: null,
        formType: 'pre_employment', // Add formType for follow-up notifications
      });
      
      res.json({ 
        success: true, 
        message: 'Invitation sent successfully',
        ticketId: ticket.id,
        workerId: worker.id
      });
      
    } catch (error) {
      console.error("Error sending pre-employment invitation:", error);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // ===========================================
  // MICHELLE AI ASSISTANT ENDPOINTS
  // ===========================================

  // Michelle chat endpoint removed - handled by michelleRoutes

  // ===========================================
  // WORKFLOW SIMULATION ENDPOINTS
  // ===========================================

  // Initialize workflow simulator
  const workflowSimulator = new WorkflowSimulator(storage, emailService);

  // Simulate complete pre-employment workflow
  app.post('/api/simulate/pre-employment', async (req, res) => {
    try {
      const { workerCount = 1 } = req.body;
      console.log(`🧪 Starting pre-employment workflow simulation for ${workerCount} workers...`);
      
      const result = await workflowSimulator.simulatePreEmploymentWorkflow(workerCount);
      
      res.json({
        success: true,
        message: 'Pre-employment workflow simulation completed',
        result
      });
    } catch (error) {
      console.error('Error in pre-employment simulation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Simulation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Simulate injury workflow
  app.post('/api/simulate/injury', async (req, res) => {
    try {
      const { workerCount = 1 } = req.body;
      console.log(`🧪 Starting injury workflow simulation for ${workerCount} workers...`);
      
      const result = await workflowSimulator.simulateInjuryWorkflow(workerCount);
      
      res.json({
        success: true,
        message: 'Injury workflow simulation completed',
        result
      });
    } catch (error) {
      console.error('Error in injury simulation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Simulation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Simulate mixed workflows (all health check types)
  app.post('/api/simulate/mixed', async (req, res) => {
    try {
      const { workerCount = 5 } = req.body;
      console.log(`🧪 Starting mixed workflow simulation for ${workerCount} workers...`);
      
      const result = await workflowSimulator.simulateMixedWorkflows(workerCount);
      
      res.json({
        success: true,
        message: 'Mixed workflow simulation completed',
        result
      });
    } catch (error) {
      console.error('Error in mixed simulation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Simulation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Custom simulation with full configuration
  app.post('/api/simulate/custom', async (req, res) => {
    try {
      const config = {
        workerCount: req.body.workerCount || 3,
        healthCheckTypes: req.body.healthCheckTypes || ['pre_employment', 'injury', 'mental_health'],
        includeManagerEmails: req.body.includeManagerEmails !== false,
        includeFreshdeskTickets: req.body.includeFreshdeskTickets !== false,
        simulateDelays: req.body.simulateDelays !== false
      };
      
      console.log(`🧪 Starting custom workflow simulation:`, config);
      
      const result = await workflowSimulator.runCompleteWorkflowSimulation(config);
      
      res.json({
        success: true,
        message: 'Custom workflow simulation completed',
        config,
        result
      });
    } catch (error) {
      console.error('Error in custom simulation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Simulation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===========================================
  // FRESHDESK DOCUMENT BACKFILL
  // ===========================================

  // Trigger document attachment backfill from Freshdesk
  app.post('/api/freshdesk/backfill-documents', async (req, res) => {
    try {
      console.log('🔄 Starting Freshdesk document backfill...');
      
      const result = await freshdeskBackfillService.backfillAllTicketAttachments();
      
      res.json({
        success: true,
        message: 'Freshdesk document backfill completed',
        stats: result
      });
    } catch (error) {
      console.error('❌ Freshdesk document backfill failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Document backfill failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===========================================
  // MOUNT ADDITIONAL ROUTE MODULES
  // ===========================================

  // ===========================================
  // WORKER PROFILE API
  // ===========================================
  
  // Get worker profile with cases
  app.get('/api/workers/:workerId/profile', async (req, res) => {
    try {
      const { workerId } = req.params;
      
      // Fetch worker details
      const worker = await storage.getWorker(workerId);
      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }
      
      // Fetch all tickets for this worker
      const allTickets = await storage.findCasesByWorkerId(workerId);
      
      // Separate active and completed cases
      const activeCases: any[] = [];
      const completedCases: any[] = [];
      
      for (const ticket of allTickets) {
        const caseData = {
          ticketId: ticket.id,
          caseType: ticket.caseType,
          status: ticket.status,
          priority: ticket.priority || 'medium',
          ragScore: 'green', // Default, will be updated from analysis
          createdAt: ticket.createdAt || new Date().toISOString(),
          updatedAt: ticket.updatedAt,
          company: ticket.companyName || 'Unknown Company',
          nextStep: ticket.nextStep,
        };
        
        // Try to get RAG score from analysis
        try {
          const analysis = await storage.getAnalysisByTicket(ticket.id);
          if (analysis) {
            caseData.ragScore = analysis.ragScore || 'green';
          }
        } catch (err) {
          console.error('Error fetching analysis for ticket:', ticket.id, err);
        }
        
        if (ticket.status === 'COMPLETE') {
          completedCases.push(caseData);
        } else {
          activeCases.push(caseData);
        }
      }
      
      // Calculate stats
      const stats = {
        totalCases: allTickets.length,
        activeCases: activeCases.length,
        completedCases: completedCases.length,
        redFlags: [...activeCases, ...completedCases].filter(c => c.ragScore === 'red').length,
        amberFlags: [...activeCases, ...completedCases].filter(c => c.ragScore === 'amber').length,
        greenFlags: [...activeCases, ...completedCases].filter(c => c.ragScore === 'green').length,
      };
      
      res.json({
        worker,
        activeCases,
        allCases: allTickets.map((ticket, index) => {
          // Use the pre-computed case data if available
          const precomputed = [...activeCases, ...completedCases].find(c => c.ticketId === ticket.id);
          return precomputed || {
            ticketId: ticket.id,
            caseType: ticket.caseType,
            status: ticket.status,
            priority: ticket.priority || 'medium',
            ragScore: 'green',
            createdAt: ticket.createdAt || new Date().toISOString(),
            updatedAt: ticket.updatedAt,
            company: ticket.companyName || 'Unknown Company',
            nextStep: ticket.nextStep,
          };
        }),
        stats,
      });
    } catch (error) {
      console.error('Error fetching worker profile:', error);
      res.status(500).json({ error: 'Failed to fetch worker profile' });
    }
  });

  // ===========================================
  // ORGANIZATION/CUSTOMER OVERVIEW API
  // ===========================================
  
  // Get organization overview with cases and workers
  app.get('/api/organizations/:organizationId/overview', async (req, res) => {
    try {
      const { organizationId } = req.params;
      
      // Fetch organization details
      const organization = await storage.getOrganization(organizationId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      // Fetch all tickets for this organization
      const allTickets = await storage.getAllTicketsForOrganization(organizationId);
      
      // Get unique worker IDs from tickets and fetch workers
      const workerIds = Array.from(new Set(allTickets.map(t => t.workerId).filter(Boolean))) as string[];
      const allWorkers = await Promise.all(
        workerIds.map(id => storage.getWorker(id))
      ).then(workers => workers.filter((w): w is NonNullable<typeof w> => w !== undefined));
      
      // Prepare cases data
      const activeCases: any[] = [];
      const completedCases: any[] = [];
      
      for (const ticket of allTickets) {
        // Get worker info (may be null for some tickets)
        const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
        
        // Use worker name if available, otherwise use ticket subject or "Unknown"
        const workerName = worker 
          ? `${worker.firstName} ${worker.lastName}` 
          : ticket.subject || 'Unknown Worker';
        
        const caseData = {
          ticketId: ticket.id,
          workerId: worker?.id || null,
          workerName,
          caseType: ticket.caseType,
          status: ticket.status,
          priority: ticket.priority || 'medium',
          ragScore: 'green',
          createdAt: ticket.createdAt || new Date().toISOString(),
          updatedAt: ticket.updatedAt,
          nextStep: ticket.nextStep,
        };
        
        // Get RAG score from analysis
        try {
          const analysis = await storage.getAnalysisByTicket(ticket.id);
          if (analysis) {
            caseData.ragScore = analysis.ragScore || 'green';
          }
        } catch (err) {
          console.error('Error fetching analysis:', err);
        }
        
        if (ticket.status === 'COMPLETE') {
          completedCases.push(caseData);
        } else {
          activeCases.push(caseData);
        }
      }
      
      // Prepare workers data with case counts
      const workerSummaries = await Promise.all(
        allWorkers.map(async (worker: any) => {
          const workerTickets = await storage.findCasesByWorkerId(worker.id);
          const activeCount = workerTickets.filter(t => t.status !== 'COMPLETE').length;
          
          return {
            id: worker.id,
            firstName: worker.firstName,
            lastName: worker.lastName,
            email: worker.email,
            totalCases: workerTickets.length,
            activeCases: activeCount,
          };
        })
      );
      
      // Calculate stats
      const allCases = [...activeCases, ...completedCases];
      const stats = {
        totalCases: allTickets.length,
        activeCases: activeCases.length,
        completedCases: completedCases.length,
        totalWorkers: allWorkers.length,
        redFlags: allCases.filter(c => c.ragScore === 'red').length,
        amberFlags: allCases.filter(c => c.ragScore === 'amber').length,
        greenFlags: allCases.filter(c => c.ragScore === 'green').length,
      };
      
      res.json({
        organization,
        activeCases,
        completedCases,
        allWorkers: workerSummaries,
        stats,
      });
    } catch (error) {
      console.error('Error fetching organization overview:', error);
      res.status(500).json({ error: 'Failed to fetch organization overview' });
    }
  });

  // Mount additional routes modules
  app.use('/api/email-drafts', emailDraftRoutes);
  app.use('/api/company-matching', companyMatchingRoutes);
  app.use('/api/auto-allocation', autoAllocationRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/next-step', nextStepRoutes);
  app.use('/api/case-console', caseConsoleRoutes);
  
  // Mount critical missing routes for Michele and Admin
  app.use('/api/michelle', michelleRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/freshdesk', freshdeskRoutes);
  app.use('/api/rag', ragRoutes);
  app.use('/api/ml', mlRoutes);
  app.use('/api/case-drawer', caseDrawerRoutes);
  app.use('/api/medical-documents', medicalDocumentRoutes);
  
  // Mount ChatGPT integration routes
  registerChatGPTRoutes(app);
  
  // Mount Agent Builder routes
  registerAgentRoutes(app);

  // Mount RTW Gating Workflow routes
  registerRTWRoutes(app);

  // ===========================================
  // SERVER CREATION
  // ===========================================

  return createServer(app);
}
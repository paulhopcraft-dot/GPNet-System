import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import authRoutes from "./authRoutes";
import { 
  preEmploymentFormSchema, type PreEmploymentFormData, 
  injuryFormSchema, type InjuryFormData, 
  rtwPlanSchema, insertStakeholderSchema,
  emailRiskAssessmentSchema, manualRiskUpdateSchema, stepUpdateSchema 
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { pdfService } from "./pdfService";
import { riskAssessmentService, type RiskInput } from "./riskAssessmentService";
import { michelle, type MichelleContext, type ConversationResponse } from "./michelle";
import { requireAuth } from "./authRoutes";
import { requireAdmin } from "./adminRoutes";
import { createEmailProcessingService, type EmailProcessingResult } from "./emailProcessingService";
import { type RawEmailData } from "./emailParsingService";
import { emailDraftRoutes } from "./emailDraftRoutes";
import { companyMatchingRoutes } from "./companyMatchingRoutes";
import { externalEmails, aiRecommendations, emailAttachments } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";

// Analysis engine for RAG scoring and fit classification
class AnalysisEngine {
  analyzeSubmission(formData: PreEmploymentFormData) {
    const risks: string[] = [];
    let ragScore: "green" | "amber" | "red" = "green";
    let fitClassification = "fit";
    const recommendations: string[] = [];

    // Lifting capacity assessment
    if (formData.liftingKg < 15) {
      risks.push("Low lifting capacity");
      ragScore = "amber";
      recommendations.push("Consider ergonomic assessment for lifting tasks");
    }

    // Repetitive tasks assessment
    if (formData.repetitiveTasks === "yes") {
      risks.push("Repetitive task concerns");
      if (ragScore === "green") ragScore = "amber";
      recommendations.push("Provide training on repetitive strain injury prevention");
    }

    // Musculoskeletal assessments
    const mskFields = [
      { field: formData.mskBack, name: "back", details: formData.mskBackDetails },
      { field: formData.mskNeck, name: "neck", details: formData.mskNeckDetails },
      { field: formData.mskShoulders, name: "shoulders", details: formData.mskShouldersDetails },
      { field: formData.mskElbows, name: "elbows", details: formData.mskElbowsDetails },
      { field: formData.mskWrists, name: "wrists", details: formData.mskWristsDetails },
      { field: formData.mskHips, name: "hips", details: formData.mskHipsDetails },
      { field: formData.mskKnees, name: "knees", details: formData.mskKneesDetails },
      { field: formData.mskAnkles, name: "ankles", details: formData.mskAnklesDetails },
    ];

    let currentIssues = 0;
    let pastIssues = 0;

    mskFields.forEach(({ field, name, details }) => {
      if (field === "current") {
        currentIssues++;
        risks.push(`Current ${name} issue: ${details || "Not specified"}`);
        recommendations.push(`Seek medical clearance for ${name} condition`);
      } else if (field === "past") {
        pastIssues++;
        recommendations.push(`Monitor ${name} for any recurring symptoms`);
      }
    });

    // Determine RAG score based on issues
    if (currentIssues >= 2) {
      ragScore = "red";
      fitClassification = "not_fit";
      recommendations.push("Comprehensive medical assessment required before employment");
    } else if (currentIssues === 1 || pastIssues >= 2) {
      ragScore = "amber";
      fitClassification = "fit_with_restrictions";
      recommendations.push("Regular monitoring and ergonomic support recommended");
    }

    // Psychosocial screening
    if (formData.stressRating >= 4 || formData.sleepRating <= 2 || formData.supportRating <= 2) {
      if (ragScore === "green") ragScore = "amber";
      recommendations.push("Consider workplace wellness program referral");
    }

    // Set final fit classification
    if (ragScore === "red") {
      fitClassification = "not_fit";
    } else if (ragScore === "amber") {
      fitClassification = "fit_with_restrictions";
    } else {
      fitClassification = "fit";
    }

    // Default recommendations if none identified
    if (recommendations.length === 0) {
      recommendations.push("No specific restrictions identified - standard workplace safety protocols apply");
    }

    return {
      ragScore,
      fitClassification,
      recommendations,
      notes: risks.length > 0 ? `Identified risks: ${risks.join(", ")}` : "No significant health risks identified",
    };
  }
}

// Enhanced Injury Analysis Engine for comprehensive workplace injury assessments
class InjuryAnalysisEngine {
  analyzeInjury(formData: InjuryFormData) {
    const risks: string[] = [];
    const riskFactors: string[] = [];
    let ragScore: "green" | "amber" | "red" = "green";
    let fitClassification = "fit";
    const recommendations: string[] = [];
    const workCapacityAssessment: string[] = [];
    const medicalRecommendations: string[] = [];
    const workplaceModifications: string[] = [];

    // Severity assessment
    if (formData.severity === "major" || formData.severity === "serious") {
      ragScore = "red";
      fitClassification = "not_fit";
      risks.push(`${formData.severity} injury requiring comprehensive assessment`);
      recommendations.push("Immediate medical assessment required before return to work");
      recommendations.push("Development of comprehensive return-to-work plan necessary");
    } else if (formData.severity === "moderate") {
      ragScore = "amber";
      fitClassification = "fit_with_restrictions";
      risks.push("Moderate injury requiring monitoring");
      recommendations.push("Modified duties may be required during recovery");
    }

    // Time off work assessment
    if (formData.timeOffWork) {
      if (ragScore === "green") ragScore = "amber";
      recommendations.push("Return-to-work planning and medical clearance required");
      risks.push("Time off work required for recovery");
    }

    // Work capacity assessment
    if (formData.canReturnToWork === "no") {
      ragScore = "red";
      fitClassification = "not_fit";
      risks.push("Unable to return to work at this time");
      recommendations.push("Medical treatment and recovery period required");
      recommendations.push("Regular medical review to assess fitness for work");
    } else if (formData.canReturnToWork === "with_restrictions") {
      if (ragScore === "green") ragScore = "amber";
      fitClassification = "fit_with_restrictions";
      recommendations.push("Return to work with medical restrictions and modified duties");
      
      // Add specific restrictions
      if (formData.workRestrictions && formData.workRestrictions.length > 0) {
        risks.push(`Work restrictions required: ${formData.workRestrictions.join(", ")}`);
      }
    }

    // Body parts affected analysis
    if (formData.bodyPartsAffected && formData.bodyPartsAffected.length > 0) {
      const criticalAreas = ["Back", "Neck", "Head", "Chest"];
      const affectedCritical = formData.bodyPartsAffected.filter(part => 
        criticalAreas.some(critical => part.toLowerCase().includes(critical.toLowerCase()))
      );
      
      if (affectedCritical.length > 0) {
        if (ragScore === "green") ragScore = "amber";
        risks.push(`Critical body areas affected: ${affectedCritical.join(", ")}`);
        recommendations.push("Specialist medical assessment recommended for critical body areas");
      }

      if (formData.bodyPartsAffected.length >= 3) {
        ragScore = "red";
        risks.push("Multiple body parts affected indicating complex injury");
        recommendations.push("Comprehensive medical evaluation for multi-site injury");
      }
    }

    // Injury type assessment
    const highRiskInjuries = ["Fracture/Break", "Burn", "Chemical Exposure", "Crush"];
    if (highRiskInjuries.includes(formData.injuryType)) {
      ragScore = "red";
      fitClassification = "not_fit";
      risks.push(`High-risk injury type: ${formData.injuryType}`);
      recommendations.push("Specialist medical treatment and extended recovery period required");
    }

    // WorkCover claim assessment
    if (formData.claimType === "workcover") {
      recommendations.push("WorkCover claim processing required");
      recommendations.push("Case manager assignment and claim documentation necessary");
      risks.push("WorkCover claim - formal injury management process required");
    }

    // Recovery time assessment
    if (formData.estimatedRecovery) {
      const recoveryLower = formData.estimatedRecovery.toLowerCase();
      if (recoveryLower.includes("month") || recoveryLower.includes("week")) {
        if (ragScore === "green") ragScore = "amber";
        medicalRecommendations.push("Extended recovery period - regular medical review required");
        workCapacityAssessment.push("Extended recovery may affect return-to-work timeline");
      }
      if (recoveryLower.includes("unknown") || recoveryLower.includes("unclear")) {
        if (ragScore === "green") ragScore = "amber";
        medicalRecommendations.push("Uncertain recovery timeline - close medical monitoring required");
        riskFactors.push("Unpredictable recovery timeline increases case complexity");
      }
    }

    // Enhanced injury type-specific assessments
    this.analyzeInjuryTypeSpecific(formData, riskFactors, workCapacityAssessment, medicalRecommendations, workplaceModifications);
    
    // Position and department-specific risk assessment
    this.analyzeWorkplaceFactors(formData, workplaceModifications, workCapacityAssessment);
    
    // Recovery timeline and RTW planning
    this.generateRTWRecommendations(formData, medicalRecommendations, workCapacityAssessment);

    // Set final fit classification based on RAG score
    if (ragScore === "red") {
      fitClassification = "not_fit";
    } else if (ragScore === "amber") {
      fitClassification = "fit_with_restrictions";
    } else {
      fitClassification = "fit";
    }

    // Default recommendations if none identified
    if (recommendations.length === 0) {
      recommendations.push("Monitor for symptom changes and ensure proper workplace safety protocols");
    }

    return {
      ragScore,
      fitClassification,
      recommendations: [...recommendations, ...medicalRecommendations, ...workCapacityAssessment, ...workplaceModifications],
      notes: risks.length > 0 ? `Identified risks: ${risks.join("; ")}` : "Minor injury with standard recovery expected",
      riskFactors,
      workCapacityAssessment,
      medicalRecommendations,
      workplaceModifications,
    };
  }

  // Analyze injury type-specific factors and implications
  analyzeInjuryTypeSpecific(formData: InjuryFormData, riskFactors: string[], workCapacity: string[], medical: string[], workplace: string[]) {
    const injuryTypeAssessments = {
      "Strain/Sprain": {
        risks: ["Potential for re-injury", "Recurring pain patterns"],
        capacity: ["May require lifting restrictions", "Gradual return to full duties"],
        medical: ["Physiotherapy assessment recommended", "Pain management strategies"],
        workplace: ["Ergonomic workstation assessment", "Manual handling training"]
      },
      "Cut/Laceration": {
        risks: ["Infection risk", "Scarring affecting function"],
        capacity: ["Hand/finger dexterity may be affected", "Possible tool restrictions"],
        medical: ["Wound care management", "Tetanus status verification"],
        workplace: ["Safety equipment review", "Sharp object handling protocols"]
      },
      "Fracture/Break": {
        risks: ["Long recovery period", "Potential permanent impairment"],
        capacity: ["Extended reduced capacity", "Significant work modifications required"],
        medical: ["Orthopedic specialist referral", "X-ray monitoring schedule"],
        workplace: ["Major duty modifications", "Temporary alternative roles"]
      },
      "Burn": {
        risks: ["Scarring and contractures", "Psychological impact"],
        capacity: ["Skin sensitivity to temperature", "Possible mobility restrictions"],
        medical: ["Burn specialist assessment", "Scar management therapy"],
        workplace: ["Heat source exposure elimination", "Personal protective equipment review"]
      },
      "Chemical Exposure": {
        risks: ["Systemic health effects", "Respiratory complications"],
        capacity: ["Chemical sensitivity development", "Breathing restrictions"],
        medical: ["Toxicology consultation", "Ongoing health monitoring"],
        workplace: ["Chemical safety protocols review", "Ventilation system assessment"]
      },
      "Crush": {
        risks: ["Permanent tissue damage", "Complex recovery"],
        capacity: ["Severe functional limitations", "Long-term disability risk"],
        medical: ["Immediate specialist care", "Reconstructive surgery consideration"],
        workplace: ["Machinery safety audit", "Comprehensive training review"]
      }
    };

    const assessment = injuryTypeAssessments[formData.injuryType as keyof typeof injuryTypeAssessments];
    if (assessment) {
      riskFactors.push(...assessment.risks);
      workCapacity.push(...assessment.capacity);
      medical.push(...assessment.medical);
      workplace.push(...assessment.workplace);
    }
  }

  // Analyze workplace factors based on position and department
  analyzeWorkplaceFactors(formData: InjuryFormData, workplace: string[], workCapacity: string[]) {
    // Department-specific assessments
    const departmentRisks = {
      "warehouse": ["Heavy lifting requirements", "Forklift operation", "Standing for extended periods"],
      "office": ["Ergonomic workstation setup", "Computer use duration", "Minimal physical demands"],
      "production": ["Machine operation safety", "Repetitive motions", "Manufacturing environment"],
      "maintenance": ["Tool usage requirements", "Physical accessibility", "Safety equipment needs"],
      "customer service": ["Voice strain considerations", "Sitting/standing options", "Stress management"]
    };

    const dept = formData.department.toLowerCase();
    const relevantRisks = Object.entries(departmentRisks).find(([key]) => 
      dept.includes(key)
    );

    if (relevantRisks) {
      workplace.push(`Department-specific considerations: ${relevantRisks[1].join(", ")}`);
    }

    // Position-specific capacity requirements
    const position = formData.position.toLowerCase();
    if (position.includes("manager") || position.includes("supervisor")) {
      workCapacity.push("Leadership responsibilities may be maintained with physical restrictions");
      workplace.push("Consider delegation of physical oversight tasks");
    }
    
    if (position.includes("driver") || position.includes("operator")) {
      workCapacity.push("Operating licenses and certifications may be affected");
      workplace.push("Medical clearance required for safety-sensitive position");
    }
  }

  // Generate comprehensive RTW recommendations
  generateRTWRecommendations(formData: InjuryFormData, medical: string[], workCapacity: string[]) {
    // Graduated return-to-work planning
    if (formData.canReturnToWork === "with_restrictions") {
      medical.push("Develop graduated return-to-work plan with medical oversight");
      workCapacity.push("Start with reduced hours and gradually increase capacity");
      
      // Specific restriction planning
      if (formData.workRestrictions) {
        formData.workRestrictions.forEach(restriction => {
          switch (restriction.toLowerCase()) {
            case "no lifting":
              workCapacity.push("Alternative duties for all lifting tasks required");
              medical.push("Regular assessment of lifting capacity progression");
              break;
            case "no standing":
              workCapacity.push("Seated work arrangement mandatory");
              medical.push("Monitor for circulation and mobility improvements");
              break;
            case "limited hours":
              workCapacity.push("Flexible scheduling to accommodate medical appointments");
              medical.push("Fatigue management strategies implementation");
              break;
            case "light duties only":
              workCapacity.push("Comprehensive light duty program development");
              medical.push("Regular capacity assessments for duty progression");
              break;
          }
        });
      }
    }

    // Timeline-based recommendations
    if (formData.estimatedRecovery) {
      const recovery = formData.estimatedRecovery.toLowerCase();
      if (recovery.includes("week")) {
        medical.push("Weekly medical reviews during initial recovery phase");
        workCapacity.push("Short-term modified duties with weekly progression assessment");
      } else if (recovery.includes("month")) {
        medical.push("Bi-weekly medical reviews with functional capacity evaluations");
        workCapacity.push("Medium-term rehabilitation program with monthly milestones");
      }
    }

    // WorkCover-specific RTW planning
    if (formData.claimType === "workcover") {
      medical.push("Coordinate with WorkCover case manager for treatment approvals");
      workCapacity.push("Document all capacity changes for WorkCover reporting");
      medical.push("Ensure all treating practitioners are WorkCover approved");
    }
  }
}

const analysisEngine = new AnalysisEngine();
const injuryAnalysisEngine = new InjuryAnalysisEngine();

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration for authentication
  const PgSession = connectPgSimple(session);
  
  app.use(session({
    store: new PgSession({
      // Use the same DATABASE_URL environment variable
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions', // Session table name  
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
  // EXTERNAL EMAIL PROCESSING ENDPOINTS
  // ===========================================
  
  // Process external email forwarded by manager
  app.post("/api/external-emails/process", async (req, res) => {
    try {
      console.log("Processing external email from manager");
      
      // Validate required fields
      const { email, organizationId, forwardedBy } = req.body;
      
      if (!email || !organizationId || !forwardedBy) {
        return res.status(400).json({ 
          error: "Missing required fields", 
          required: ["email", "organizationId", "forwardedBy"] 
        });
      }
      
      // Validate email structure
      const emailSchema = z.object({
        messageId: z.string().min(1, "Message ID is required"),
        subject: z.string().min(1, "Subject is required"),
        body: z.string().min(1, "Body is required"),
        htmlBody: z.string().optional(),
        originalSender: z.string().email("Valid sender email required"),
        originalSenderName: z.string().optional(),
        forwardedAt: z.string().optional(),
        attachments: z.array(z.object({
          filename: z.string(),
          contentType: z.string(),
          size: z.number(),
          content: z.string() // base64 encoded
        })).optional().default([])
      });
      
      const validationResult = emailSchema.safeParse(email);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid email data", details: errorMessage });
      }
      
      // Convert base64 attachments to RawAttachment format
      const rawAttachments = (validationResult.data.attachments || []).map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        content: Buffer.from(att.content, 'base64')
      }));
      
      const emailData: RawEmailData = {
        messageId: validationResult.data.messageId,
        from: validationResult.data.originalSender,
        to: '', // Will be filled by parsing service
        subject: validationResult.data.subject,
        body: validationResult.data.body,
        htmlBody: validationResult.data.htmlBody,
        date: validationResult.data.forwardedAt ? new Date(validationResult.data.forwardedAt) : new Date(),
        attachments: rawAttachments
      };
      
      // Process the email through the workflow
      const result = await emailProcessingService.processIncomingEmail(
        emailData,
        organizationId,
        forwardedBy
      );
      
      if (result.success) {
        res.json({
          success: true,
          externalEmailId: result.externalEmailId,
          ticketId: result.ticketId,
          isDuplicate: result.isDuplicate,
          processingTime: result.processingTime,
          matchResult: result.matchResult ? {
            matched: !!result.matchResult.bestMatch,
            confidenceScore: result.matchResult.bestMatch?.confidenceScore,
            matchType: result.matchResult.bestMatch?.matchType
          } : null,
          aiAnalysis: result.aiAnalysis ? {
            summary: result.aiAnalysis.summary,
            urgencyLevel: result.aiAnalysis.urgencyLevel,
            extractedActions: result.aiAnalysis.extractedActions,
            sentiment: result.aiAnalysis.sentiment
          } : null,
          recommendationCount: result.aiRecommendations?.recommendations.length || 0
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          processingTime: result.processingTime
        });
      }
      
    } catch (error) {
      console.error("External email processing failed:", error);
      res.status(500).json({ 
        error: "Failed to process external email", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
  
  // Get external email processing status
  app.get("/api/external-emails/:emailId/status", async (req, res) => {
    try {
      const { emailId } = req.params;
      
      const [emailRecord] = await db
        .select()
        .from(externalEmails)
        .where(eq(externalEmails.id, emailId))
        .limit(1);
      
      if (!emailRecord) {
        return res.status(404).json({ error: "External email not found" });
      }
      
      res.json({
        id: emailRecord.id,
        processingStatus: emailRecord.processingStatus,
        ticketId: emailRecord.ticketId,
        urgencyLevel: emailRecord.urgencyLevel,
        aiSummary: emailRecord.aiSummary,
        confidenceScore: emailRecord.confidenceScore,
        matchType: emailRecord.matchType,
        matchReasoning: emailRecord.matchReasoning,
        errorMessage: emailRecord.errorMessage,
        createdAt: emailRecord.createdAt,
        updatedAt: emailRecord.updatedAt
      });
      
    } catch (error) {
      console.error("Failed to get email status:", error);
      res.status(500).json({ error: "Failed to retrieve email status" });
    }
  });
  
  // Get AI recommendations for an external email
  app.get("/api/external-emails/:emailId/recommendations", async (req, res) => {
    try {
      const { emailId } = req.params;
      
      const recommendations = await db
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.externalEmailId, emailId))
        .orderBy(desc(aiRecommendations.createdAt));
      
      res.json({
        recommendations: recommendations.map(rec => ({
          id: rec.id,
          type: rec.recommendationType,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          suggestedAction: rec.suggestedAction,
          actionDetails: rec.actionDetails,
          estimatedTimeframe: rec.estimatedTimeframe,
          confidence: rec.confidenceScore,
          reasoning: rec.reasoning,
          status: rec.status,
          createdAt: rec.createdAt
        }))
      });
      
    } catch (error) {
      console.error("Failed to get email recommendations:", error);
      res.status(500).json({ error: "Failed to retrieve recommendations" });
    }
  });
  
  // Get external emails for a specific case/ticket
  app.get("/api/tickets/:ticketId/external-emails", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const emails = await db
        .select()
        .from(externalEmails)
        .where(eq(externalEmails.ticketId, ticketId))
        .orderBy(desc(externalEmails.createdAt));
      
      res.json({
        emails: emails.map(email => ({
          id: email.id,
          subject: email.subject,
          originalSender: email.originalSender,
          originalSenderName: email.originalSenderName,
          forwardedBy: email.forwardedBy,
          forwardedAt: email.forwardedAt,
          processingStatus: email.processingStatus,
          urgencyLevel: email.urgencyLevel,
          aiSummary: email.aiSummary,
          confidenceScore: email.confidenceScore,
          matchType: email.matchType,
          createdAt: email.createdAt
        }))
      });
      
    } catch (error) {
      console.error("Failed to get case external emails:", error);
      res.status(500).json({ error: "Failed to retrieve case emails" });
    }
  });
  
  // Get email attachments
  app.get("/api/external-emails/:emailId/attachments", async (req, res) => {
    try {
      const { emailId } = req.params;
      
      const attachments = await db
        .select()
        .from(emailAttachments)
        .where(eq(emailAttachments.externalEmailId, emailId))
        .orderBy(desc(emailAttachments.uploadedAt));
      
      res.json({
        attachments: attachments.map(att => ({
          id: att.id,
          filename: att.filename,
          contentType: att.mimeType,
          fileSize: att.fileSize,
          uploadedAt: att.uploadedAt
        }))
      });
      
    } catch (error) {
      console.error("Failed to get email attachments:", error);
      res.status(500).json({ error: "Failed to retrieve attachments" });
    }
  });
  
  // Manager dashboard - Get processing statistics
  app.get("/api/external-emails/stats", async (req, res) => {
    try {
      const { organizationId } = req.query;
      
      let query = db.select().from(externalEmails);
      if (organizationId) {
        query = query.where(eq(externalEmails.organizationId, organizationId as string));
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
  // END EXTERNAL EMAIL PROCESSING ENDPOINTS
  // ===========================================
  
  // Admin routes
  const adminRoutes = (await import('./adminRoutes.js')).default;
  app.use('/api/admin', adminRoutes);
  
  // Freshdesk integration routes
  const { freshdeskRoutes } = await import('./freshdeskRoutes.js');
  app.use('/api/freshdesk', freshdeskRoutes);
  
  // Initialize medical document processing services
  const { initDocumentProcessingService } = await import('./documentProcessingService.js');
  const { initFreshdeskWebhookService } = await import('./freshdeskWebhookService.js');
  const { initBackgroundJobQueue } = await import('./backgroundJobQueue.js');
  
  // Initialize services with storage
  initDocumentProcessingService(storage);
  initFreshdeskWebhookService(storage);
  
  // Initialize background job queue for async processing
  const jobQueue = initBackgroundJobQueue(storage);
  console.log('Background job queue initialized and started');
  
  // Medical document processing routes
  const { medicalDocumentRoutes } = await import('./medicalDocumentRoutes.js');
  app.use('/api/medical-documents', medicalDocumentRoutes);
  
  // Check management routes
  const { checkManagementRoutes } = await import('./checkManagementRoutes.js');
  app.use('/api/check-management', checkManagementRoutes);
  
  // Michelle dialogue routes
  const { michelleRoutes } = await import('./michelleRoutes.js');
  app.use('/api/michelle', michelleRoutes);
  
  // Email drafting routes
  app.use('/api/email-drafts', emailDraftRoutes);
  
  // Company matching routes
  app.use('/api/company-matching', companyMatchingRoutes);
  
  // Create email processing service instance
  const emailProcessingService = createEmailProcessingService(storage);
  
  // Jotform webhook endpoint for receiving form submissions
  app.post("/api/webhook/jotform", async (req, res) => {
    try {
      console.log("Received Jotform webhook - processing pre-employment form");
      
      // Validate the form data
      const validationResult = preEmploymentFormSchema.safeParse(req.body);
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

      // Perform automated analysis
      const analysisResult = analysisEngine.analyzeSubmission(formData);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: analysisResult.notes,
      });

      // Update ticket status to AWAITING_REVIEW
      await storage.updateTicketStatus(ticket.id, "AWAITING_REVIEW");

      // Automatically create Freshdesk ticket if integration is available
      let freshdeskInfo = null;
      try {
        const { freshdeskService } = await import("./freshdeskService");
        
        if (freshdeskService.isAvailable()) {
          // Check for existing Freshdesk mapping to prevent duplicates
          const existingMapping = await storage.getFreshdeskTicketByGpnetId(ticket.id);
          if (existingMapping) {
            console.log(`Freshdesk ticket already exists for case ${ticket.id}, skipping creation`);
            freshdeskInfo = {
              freshdeskTicketId: existingMapping.freshdeskTicketId,
              freshdeskUrl: existingMapping.freshdeskUrl
            };
            
            // Log idempotent skip
            await storage.createFreshdeskSyncLog(
              freshdeskService.createSyncLog(
                ticket.id,
                existingMapping.freshdeskTicketId,
                'create',
                'to_freshdesk',
                'skipped',
                { trigger: 'auto_pre_employment', reason: 'idempotent_skip' }
              )
            );
          } else {
            // Get updated ticket 
            const updatedTicket = await storage.getTicket(ticket.id);
            if (updatedTicket) {
              const freshdeskTicket = await freshdeskService.createTicket(updatedTicket, worker);
            
              if (freshdeskTicket) {
                // Store mapping in database
                const mapping = await storage.createFreshdeskTicket({
                  gpnetTicketId: ticket.id,
                  freshdeskTicketId: freshdeskTicket.id,
                  freshdeskUrl: `https://${process.env.FRESHDESK_DOMAIN}.freshdesk.com/a/tickets/${freshdeskTicket.id}`,
                  syncStatus: 'synced',
                  freshdeskData: freshdeskTicket
                });

                // Log successful sync
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
        } else {
          // Log that Freshdesk integration is not configured
          await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              ticket.id,
              null,
              'create',
              'to_freshdesk',
              'skipped',
              { trigger: 'auto_pre_employment', reason: 'Freshdesk integration not configured' }
            )
          );
        }
      } catch (freshdeskError) {
        console.error("Failed to auto-create Freshdesk ticket:", freshdeskError);
        
        // Log failed attempt
        try {
          const { freshdeskService } = await import("./freshdeskService");
          await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              ticket.id,
              null,
              'create',
              'to_freshdesk',
              'failed',
              { trigger: 'auto_pre_employment' },
              freshdeskError instanceof Error ? freshdeskError.message : 'Unknown error'
            )
          );
        } catch (logError) {
          console.error("Failed to log Freshdesk error:", logError);
        }
      }

      console.log(`Created pre-employment case ${ticket.id}`);

      res.json({
        success: true,
        ticketId: ticket.id,
        status: "AWAITING_REVIEW",
        message: "Form processed successfully",
        freshdeskInfo
      });

    } catch (error) {
      console.error("Error processing form submission:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to process form submission" 
      });
    }
  });

  // Injury webhook endpoint for receiving injury form submissions
  app.post("/api/webhook/injury", async (req, res) => {
    try {
      console.log("Received injury webhook - processing injury form");
      
      // Validate the injury form data
      const validationResult = injuryFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid injury form data", details: errorMessage });
      }

      const formData = validationResult.data;

      // Create worker record
      const worker = await storage.createWorker({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: "", // Not captured in injury form
        phone: formData.phone,
        email: formData.email,
        roleApplied: formData.position, // Use position as role applied
        site: formData.department || null,
      });

      // Create ticket for injury case
      const ticket = await storage.createTicket({
        workerId: worker.id,
        caseType: "injury",
        claimType: formData.claimType,
        status: "NEW",
        priority: formData.severity === "major" || formData.severity === "serious" ? "high" : "medium",
      });

      // Create injury record with incident details
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

      // Create form submission record
      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      // Create doctor stakeholder if provided
      if (formData.doctorName && formData.clinicName) {
        await storage.createStakeholder({
          ticketId: ticket.id,
          role: "doctor",
          name: formData.doctorName,
          email: null,
          phone: formData.clinicPhone || null,
          organization: formData.clinicName,
          notes: "Primary treating doctor",
        });
      }

      // Perform automated injury analysis
      const analysisResult = injuryAnalysisEngine.analyzeInjury(formData);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: analysisResult.notes,
      });

      // Update ticket status to ANALYSING
      await storage.updateTicketStatus(ticket.id, "ANALYSING");

      // Automatically create Freshdesk ticket if integration is available
      let freshdeskInfo = null;
      try {
        const { freshdeskService } = await import("./freshdeskService");
        
        if (freshdeskService.isAvailable()) {
          // Check for existing Freshdesk mapping to prevent duplicates
          const existingMapping = await storage.getFreshdeskTicketByGpnetId(ticket.id);
          if (existingMapping) {
            console.log(`Freshdesk ticket already exists for injury case ${ticket.id}, skipping creation`);
            freshdeskInfo = {
              freshdeskTicketId: existingMapping.freshdeskTicketId,
              freshdeskUrl: existingMapping.freshdeskUrl
            };
            
            // Log idempotent skip
            await storage.createFreshdeskSyncLog(
              freshdeskService.createSyncLog(
                ticket.id,
                existingMapping.freshdeskTicketId,
                'create',
                'to_freshdesk',
                'skipped',
                { trigger: 'auto_injury', reason: 'idempotent_skip' }
              )
            );
          } else {
            // Get updated ticket
            const updatedTicket = await storage.getTicket(ticket.id);
            if (updatedTicket) {
              const freshdeskTicket = await freshdeskService.createTicket(updatedTicket, worker);
            
              if (freshdeskTicket) {
                // Store mapping in database
                const mapping = await storage.createFreshdeskTicket({
                  gpnetTicketId: ticket.id,
                  freshdeskTicketId: freshdeskTicket.id,
                  freshdeskUrl: `https://${process.env.FRESHDESK_DOMAIN}.freshdesk.com/a/tickets/${freshdeskTicket.id}`,
                  syncStatus: 'synced',
                  freshdeskData: freshdeskTicket
                });

                // Log successful sync
                await storage.createFreshdeskSyncLog(
                  freshdeskService.createSyncLog(
                    ticket.id,
                    freshdeskTicket.id,
                    'create',
                    'to_freshdesk',
                    'success',
                    { 
                      freshdeskTicket, 
                      trigger: 'auto_injury',
                      claimType: formData.claimType,
                      severity: formData.severity 
                    }
                  )
                );

                freshdeskInfo = {
                  freshdeskTicketId: freshdeskTicket.id,
                  freshdeskUrl: mapping.freshdeskUrl
                };

                console.log(`Auto-created Freshdesk ticket ${freshdeskTicket.id} for injury case ${ticket.id}`);
              }
            }
          }
        } else {
          // Log that Freshdesk integration is not configured
          await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              ticket.id,
              null,
              'create',
              'to_freshdesk',
              'skipped',
              { 
                trigger: 'auto_injury', 
                claimType: formData.claimType,
                reason: 'Freshdesk integration not configured' 
              }
            )
          );
        }
      } catch (freshdeskError) {
        console.error("Failed to auto-create Freshdesk ticket for injury:", freshdeskError);
        
        // Log failed attempt
        try {
          const { freshdeskService } = await import("./freshdeskService");
          await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              ticket.id,
              null,
              'create',
              'to_freshdesk',
              'failed',
              { 
                trigger: 'auto_injury',
                claimType: formData.claimType 
              },
              freshdeskError instanceof Error ? freshdeskError.message : 'Unknown error'
            )
          );
        } catch (logError) {
          console.error("Failed to log Freshdesk error:", logError);
        }
      }

      console.log(`Created injury case ${ticket.id}`);

      res.json({
        success: true,
        ticketId: ticket.id,
        caseType: "injury",
        claimType: formData.claimType,
        status: "ANALYSING",
        message: `Injury report processed successfully. ${formData.claimType === 'workcover' ? 'WorkCover claim processing initiated.' : 'Standard claim processing initiated.'}`,
        freshdeskInfo
      });

    } catch (error) {
      console.error("Error processing injury submission:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to process injury report" 
      });
    }
  });

  // Dashboard API - Get statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Enhanced Analytics endpoints
  app.get("/api/analytics/trends", async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const analytics = await storage.getTrendAnalytics(days);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching trend analytics:", error);
      res.status(500).json({ error: "Failed to fetch trend analytics" });
    }
  });

  app.get("/api/analytics/performance", async (req, res) => {
    try {
      const metrics = await storage.getPerformanceMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ error: "Failed to fetch performance metrics" });
    }
  });

  // Advanced Analytics for Admin Users - Cross-tenant insights
  app.get("/api/analytics/cross-tenant", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      
      // Only allow admin users with superuser permissions
      if (user.role !== 'admin' || !user.permissions?.includes('superuser')) {
        return res.status(403).json({ error: "Insufficient permissions for cross-tenant analytics" });
      }

      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      
      // Get all organizations for cross-tenant analysis
      const organizations = await storage.getAllOrganizations();
      
      // Collect analytics for each organization
      const organizationMetrics = await Promise.all(
        organizations.map(async (org) => {
          // Temporarily switch storage context to each organization
          const orgStorage = storage; // In a real implementation, this would switch context
          
          try {
            const trendAnalytics = await storage.getTrendAnalyticsForOrganization(org.id, days);
            const performanceMetrics = await storage.getPerformanceMetricsForOrganization(org.id);
            const dashboardStats = await storage.getDashboardStatsForOrganization(org.id);
            
            return {
              organizationId: org.id,
              organizationName: org.name,
              status: org.status,
              trends: trendAnalytics,
              performance: performanceMetrics,
              dashboard: dashboardStats,
              employeeCount: org.employeeCount || 0,
              industryType: org.industryType || 'Unknown'
            };
          } catch (error) {
            console.error(`Failed to get analytics for org ${org.id}:`, error);
            return {
              organizationId: org.id,
              organizationName: org.name,
              status: org.status,
              error: 'Failed to fetch analytics',
              employeeCount: org.employeeCount || 0,
              industryType: org.industryType || 'Unknown'
            };
          }
        })
      );

      // Calculate cross-tenant aggregate metrics
      const validMetrics = organizationMetrics.filter(m => !m.error);
      const totalCases = validMetrics.reduce((sum, m) => sum + (m.dashboard?.total || 0), 0);
      const totalOrganizations = organizations.length;
      const activeOrganizations = organizations.filter(org => org.status === 'active').length;
      
      // Risk distribution across all organizations
      const aggregateRiskDistribution = validMetrics.reduce((acc, m) => {
        if (m.trends?.risk_distribution) {
          acc.green += m.trends.risk_distribution.green;
          acc.amber += m.trends.risk_distribution.amber;
          acc.red += m.trends.risk_distribution.red;
        }
        return acc;
      }, { green: 0, amber: 0, red: 0 });

      // Calculate average completion rate across organizations
      const avgCompletionRate = validMetrics.length > 0 
        ? validMetrics.reduce((sum, m) => sum + (m.trends?.case_completion_rate || 0), 0) / validMetrics.length
        : 0;

      // Calculate average processing time across organizations
      const avgProcessingTime = validMetrics.length > 0
        ? validMetrics.reduce((sum, m) => sum + (m.trends?.avg_processing_time_days || 0), 0) / validMetrics.length
        : 0;

      // Industry benchmarking
      const industryBenchmarks = {};
      validMetrics.forEach(m => {
        const industry = m.industryType;
        if (!industryBenchmarks[industry]) {
          industryBenchmarks[industry] = {
            organizationCount: 0,
            totalCases: 0,
            avgCompletionRate: 0,
            avgProcessingTime: 0,
            riskDistribution: { green: 0, amber: 0, red: 0 }
          };
        }
        
        industryBenchmarks[industry].organizationCount++;
        industryBenchmarks[industry].totalCases += m.dashboard?.total || 0;
        industryBenchmarks[industry].avgCompletionRate += m.trends?.case_completion_rate || 0;
        industryBenchmarks[industry].avgProcessingTime += m.trends?.avg_processing_time_days || 0;
        
        if (m.trends?.risk_distribution) {
          industryBenchmarks[industry].riskDistribution.green += m.trends.risk_distribution.green;
          industryBenchmarks[industry].riskDistribution.amber += m.trends.risk_distribution.amber;
          industryBenchmarks[industry].riskDistribution.red += m.trends.risk_distribution.red;
        }
      });

      // Calculate industry averages
      Object.keys(industryBenchmarks).forEach(industry => {
        const benchmark = industryBenchmarks[industry];
        benchmark.avgCompletionRate = benchmark.avgCompletionRate / benchmark.organizationCount;
        benchmark.avgProcessingTime = benchmark.avgProcessingTime / benchmark.organizationCount;
      });

      // Top performing organizations
      const topPerformers = validMetrics
        .filter(m => m.trends && m.performance)
        .sort((a, b) => {
          // Sort by completion rate and processing efficiency
          const scoreA = (a.trends.case_completion_rate * 0.6) + ((10 - a.trends.avg_processing_time_days) * 0.4);
          const scoreB = (b.trends.case_completion_rate * 0.6) + ((10 - b.trends.avg_processing_time_days) * 0.4);
          return scoreB - scoreA;
        })
        .slice(0, 10);

      // Organizations needing attention (high risk cases, low completion rates)
      const needsAttention = validMetrics
        .filter(m => m.trends && (
          m.trends.case_completion_rate < 80 || 
          m.trends.avg_processing_time_days > 7 ||
          (m.trends.risk_distribution.red / (m.dashboard?.total || 1)) > 0.2
        ))
        .sort((a, b) => {
          const riskScoreA = (a.trends.risk_distribution.red / (a.dashboard?.total || 1)) * 100;
          const riskScoreB = (b.trends.risk_distribution.red / (b.dashboard?.total || 1)) * 100;
          return riskScoreB - riskScoreA;
        });

      res.json({
        summary: {
          totalOrganizations,
          activeOrganizations,
          totalCases,
          avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
          avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
          riskDistribution: aggregateRiskDistribution
        },
        organizationMetrics: validMetrics,
        industryBenchmarks,
        topPerformers: topPerformers.slice(0, 5),
        needsAttention: needsAttention.slice(0, 5),
        trends: {
          periodDays: days,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error("Error fetching cross-tenant analytics:", error);
      res.status(500).json({ error: "Failed to fetch cross-tenant analytics" });
    }
  });

  // Advanced Organization Comparison Analytics
  app.get("/api/analytics/organization-comparison", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      
      // Only allow admin users with superuser permissions
      if (user.role !== 'admin' || !user.permissions?.includes('superuser')) {
        return res.status(403).json({ error: "Insufficient permissions for organization comparison" });
      }

      const { organizationIds, metric = 'completion_rate', period = '30' } = req.query;
      const days = parseInt(period as string);
      
      if (!organizationIds) {
        return res.status(400).json({ error: "Organization IDs are required for comparison" });
      }

      const orgIds = Array.isArray(organizationIds) ? organizationIds : [organizationIds];
      
      const comparisonData = await Promise.all(
        orgIds.map(async (orgId) => {
          try {
            const organization = await storage.getOrganization(orgId as string);
            if (!organization) {
              return { organizationId: orgId, error: 'Organization not found' };
            }

            // Get analytics for this organization
            const trends = await storage.getTrendAnalytics(days);
            const performance = await storage.getPerformanceMetrics();
            const stats = await storage.getDashboardStats();
            
            return {
              organizationId: orgId,
              organizationName: organization.name,
              industryType: organization.industryType,
              employeeCount: organization.employeeCount,
              metrics: {
                completionRate: trends.case_completion_rate,
                processingTime: trends.avg_processing_time_days,
                totalCases: stats.total,
                riskDistribution: trends.risk_distribution,
                complianceStatus: trends.compliance_status,
                monthlyGrowth: performance.cases_this_month > 0 && performance.cases_last_month > 0 
                  ? ((performance.cases_this_month - performance.cases_last_month) / performance.cases_last_month) * 100 
                  : 0
              },
              period: {
                days,
                from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                to: new Date().toISOString()
              }
            };
          } catch (error) {
            console.error(`Failed to get comparison data for org ${orgId}:`, error);
            return { organizationId: orgId, error: 'Failed to fetch data' };
          }
        })
      );

      // Calculate benchmarks and rankings
      const validData = comparisonData.filter(d => !d.error);
      if (validData.length === 0) {
        return res.status(400).json({ error: "No valid organization data found" });
      }

      // Rank organizations by different metrics
      const rankings = {
        completionRate: [...validData].sort((a, b) => b.metrics.completionRate - a.metrics.completionRate),
        processingTime: [...validData].sort((a, b) => a.metrics.processingTime - b.metrics.processingTime),
        caseVolume: [...validData].sort((a, b) => b.metrics.totalCases - a.metrics.totalCases),
        riskManagement: [...validData].sort((a, b) => {
          const aRiskScore = a.metrics.riskDistribution.green / (a.metrics.totalCases || 1);
          const bRiskScore = b.metrics.riskDistribution.green / (b.metrics.totalCases || 1);
          return bRiskScore - aRiskScore;
        })
      };

      res.json({
        comparisonData: validData,
        rankings,
        benchmarks: {
          avgCompletionRate: validData.reduce((sum, d) => sum + d.metrics.completionRate, 0) / validData.length,
          avgProcessingTime: validData.reduce((sum, d) => sum + d.metrics.processingTime, 0) / validData.length,
          totalCasesAcrossOrgs: validData.reduce((sum, d) => sum + d.metrics.totalCases, 0)
        },
        metadata: {
          period: days,
          organizationsCompared: validData.length,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error("Error fetching organization comparison:", error);
      res.status(500).json({ error: "Failed to fetch organization comparison" });
    }
  });

  // Get all cases with optional filtering
  app.get("/api/cases", async (req, res) => {
    try {
      // Extract query parameters for filtering and searching
      const {
        status,
        caseType,
        claimType,
        priority,
        ragScore,
        fitClassification,
        search,
        dateFrom,
        dateTo,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        limit,
        offset = '0'
      } = req.query;

      const tickets = await storage.getAllTickets();
      
      // For each ticket, get associated worker and analysis data
      let cases = await Promise.all(
        tickets.map(async (ticket) => {
          const submission = await storage.getFormSubmissionByTicket(ticket.id);
          const analysis = await storage.getAnalysisByTicket(ticket.id);
          
          let worker = null;
          if (submission) {
            worker = await storage.getWorker(submission.workerId);
          }

          return {
            ticketId: ticket.id,
            caseType: ticket.caseType,
            claimType: ticket.claimType || null,
            priority: ticket.priority || null,
            status: ticket.status,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            workerName: worker ? `${worker.firstName} ${worker.lastName}` : "Unknown",
            email: worker?.email || "",
            phone: worker?.phone || "",
            roleApplied: worker?.roleApplied || "",
            company: "", // To be implemented with company data
            ragScore: analysis?.ragScore || "green",
            fitClassification: analysis?.fitClassification || "",
            recommendations: analysis?.recommendations || [],
            notes: analysis?.notes || "",
            // Step tracking fields
            nextStep: ticket.nextStep || null,
            lastStep: ticket.lastStep || null,
            lastStepCompletedAt: ticket.lastStepCompletedAt || null,
            assignedTo: ticket.assignedTo || null,
          };
        })
      );

      // Apply server-side filtering
      cases = cases.filter(caseItem => {
        // Status filter
        if (status && status !== 'all' && caseItem.status !== status) {
          return false;
        }

        // Case type filter
        if (caseType && caseType !== 'all' && caseItem.caseType !== caseType) {
          return false;
        }

        // Claim type filter
        if (claimType && claimType !== 'all' && caseItem.claimType !== claimType) {
          return false;
        }

        // Priority filter
        if (priority && priority !== 'all' && caseItem.priority !== priority) {
          return false;
        }

        // RAG score filter
        if (ragScore && ragScore !== 'all' && caseItem.ragScore !== ragScore) {
          return false;
        }

        // Fit classification filter
        if (fitClassification && fitClassification !== 'all' && caseItem.fitClassification !== fitClassification) {
          return false;
        }

        // Date range filter
        if (dateFrom || dateTo) {
          if (!caseItem.createdAt) return true; // Skip filtering if no date
          const caseDate = new Date(caseItem.createdAt);
          if (dateFrom) {
            const fromDate = new Date(dateFrom as string);
            if (caseDate < fromDate) {
              return false;
            }
          }
          if (dateTo) {
            const toDate = new Date(dateTo as string);
            if (caseDate > toDate) {
              return false;
            }
          }
        }

        // Text search across multiple fields
        if (search && search !== '') {
          const searchTerm = (search as string).toLowerCase();
          const recommendations = Array.isArray(caseItem.recommendations) ? caseItem.recommendations : [];
          const searchableText = [
            caseItem.ticketId,
            caseItem.workerName,
            caseItem.email,
            caseItem.phone,
            caseItem.roleApplied,
            caseItem.company,
            caseItem.notes,
            ...recommendations
          ].join(' ').toLowerCase();

          if (!searchableText.includes(searchTerm)) {
            return false;
          }
        }

        return true;
      });

      // Apply sorting
      cases.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'createdAt':
          case 'updatedAt':
            aValue = new Date(a[sortBy as keyof typeof a] as string);
            bValue = new Date(b[sortBy as keyof typeof b] as string);
            break;
          case 'workerName':
          case 'status':
          case 'priority':
          case 'ragScore':
            aValue = (a[sortBy as keyof typeof a] as string)?.toLowerCase() || '';
            bValue = (b[sortBy as keyof typeof b] as string)?.toLowerCase() || '';
            break;
          default:
            aValue = a[sortBy as keyof typeof a] || '';
            bValue = b[sortBy as keyof typeof b] || '';
        }

        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });

      // Apply pagination
      const total = cases.length;
      if (limit) {
        const limitNum = parseInt(limit as string);
        const offsetNum = parseInt(offset as string);
        cases = cases.slice(offsetNum, offsetNum + limitNum);
      }

      res.json({
        cases,
        total,
        page: Math.floor(parseInt(offset as string) / parseInt(limit as string || '20')) + 1,
        hasMore: limit ? (parseInt(offset as string) + parseInt(limit as string)) < total : false
      });
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  // Get specific case details
  app.get("/api/cases/:ticketId", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      const submission = await storage.getFormSubmissionByTicket(ticketId);
      const analysis = await storage.getAnalysisByTicket(ticketId);
      
      let worker = null;
      if (submission) {
        worker = await storage.getWorker(submission.workerId);
      }

      const caseDetails = {
        ticketId: ticket.id,
        caseType: ticket.caseType,
        claimType: ticket.claimType || null,
        priority: ticket.priority || null,
        status: ticket.status,
        createdAt: ticket.createdAt,
        workerName: worker ? `${worker.firstName} ${worker.lastName}` : "Unknown",
        email: worker?.email || "",
        phone: worker?.phone || "",
        roleApplied: worker?.roleApplied || "",
        company: "", // To be implemented
        ragScore: analysis?.ragScore || "green",
        fitClassification: analysis?.fitClassification || "",
        recommendations: analysis?.recommendations || [],
        notes: analysis?.notes || "",
        formData: submission?.rawData || null,
      };

      res.json(caseDetails);
    } catch (error) {
      console.error("Error fetching case details:", error);
      res.status(500).json({ error: "Failed to fetch case details" });
    }
  });

  // Update case recommendations (consultant review)
  app.put("/api/cases/:ticketId/recommendations", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { recommendations } = req.body;

      if (!Array.isArray(recommendations)) {
        return res.status(400).json({ error: "Recommendations must be an array" });
      }

      await storage.updateAnalysis(ticketId, { recommendations });

      res.json({ success: true, message: "Recommendations updated" });
    } catch (error) {
      console.error("Error updating recommendations:", error);
      res.status(500).json({ error: "Failed to update recommendations" });
    }
  });

  // Update case risk level (RAG score) - Enhanced with risk assessment service
  app.put("/api/cases/:ticketId/risk-level", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate request body with Zod
      const parseResult = manualRiskUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(parseResult.error).toString() 
        });
      }
      
      const { ragScore, reason } = parseResult.data;

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Use enhanced risk assessment service for manual updates
      const riskInputs: RiskInput[] = [{
        type: 'manual_update',
        content: { ragScore, reason: reason || 'Manual override' },
        timestamp: new Date(),
        source: 'consultant'
      }];

      const existingAnalysis = await storage.getAnalysisByTicket(ticketId);
      const assessmentResult = await riskAssessmentService.assessRisk(
        riskInputs, 
        existingAnalysis?.ragScore as "green" | "amber" | "red" | undefined
      );

      // History entry will be created automatically by updateAnalysis

      // Check if analysis exists
      let analysis = existingAnalysis;
      if (!analysis) {
        // Create new analysis with enhanced assessment
        analysis = await storage.createAnalysis({
          ticketId,
          ragScore: assessmentResult.ragScore,
          fitClassification: assessmentResult.fitClassification,
          recommendations: assessmentResult.recommendations,
          notes: `Manual risk level assignment: ${reason || 'No reason provided'}. Confidence: ${assessmentResult.confidence}%`
        });
      } else {
        // Update existing analysis with enhanced results
        analysis = await storage.updateAnalysis(ticketId, {
          ragScore: assessmentResult.ragScore,
          fitClassification: assessmentResult.fitClassification,
          recommendations: assessmentResult.recommendations,
          notes: `${analysis.notes || ''}. Manual override: ${reason || 'No reason provided'}`
        }, {
          changeSource: 'manual',
          changeReason: reason || 'Manual risk level override',
          triggeredBy: 'consultant',
          confidence: assessmentResult.confidence
        });
      }

      res.json({ 
        success: true, 
        ragScore: assessmentResult.ragScore, 
        confidence: assessmentResult.confidence,
        riskFactors: assessmentResult.riskFactors,
        message: "Risk level updated successfully with enhanced assessment" 
      });
    } catch (error) {
      console.error("Error updating risk level:", error);
      res.status(500).json({ error: "Failed to update risk level" });
    }
  });

  // Automatic risk reassessment based on email content
  app.post("/api/cases/:ticketId/assess-email-risk", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate request body with Zod
      const parseResult = emailRiskAssessmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(parseResult.error).toString() 
        });
      }
      
      const { emailContent, subject, sender } = parseResult.data;

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Analyze email content for risk indicators
      const emailAnalysis = riskAssessmentService.analyzeEmailContent(emailContent, subject);
      
      // Create risk input for assessment
      const riskInputs: RiskInput[] = [{
        type: 'email',
        content: { content: emailContent, subject },
        timestamp: new Date(),
        source: sender || 'unknown'
      }];

      // Get current analysis
      const existingAnalysis = await storage.getAnalysisByTicket(ticketId);
      const currentRagScore = existingAnalysis?.ragScore as "green" | "amber" | "red" | undefined;

      // Only reassess if email indicates risk change
      let shouldUpdate = false;
      let assessmentResult = null;

      if (emailAnalysis.urgencyLevel === 'high' || emailAnalysis.urgencyLevel === 'medium') {
        assessmentResult = await riskAssessmentService.assessRisk(riskInputs, currentRagScore);
        
        // Update if risk level changed
        if (!currentRagScore || assessmentResult.ragScore !== currentRagScore) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate && assessmentResult) {
        // Update the analysis (history entry will be created automatically)
        await storage.updateAnalysis(ticketId, {
          ragScore: assessmentResult.ragScore,
          recommendations: [
            ...(existingAnalysis?.recommendations || [] as any[]),
            ...assessmentResult.recommendations
          ],
          notes: `${existingAnalysis?.notes || ''}. Email risk assessment (${emailAnalysis.urgencyLevel} urgency): ${emailAnalysis.suggestedAction}`
        }, {
          changeSource: 'email',
          changeReason: `Email analysis detected ${emailAnalysis.urgencyLevel} urgency: ${emailAnalysis.suggestedAction}`,
          triggeredBy: sender || 'unknown',
          confidence: assessmentResult.confidence
        });

        console.log(`Updated risk level for case ${ticketId} based on email analysis: ${currentRagScore} -> ${assessmentResult.ragScore}`);
      }

      res.json({
        success: true,
        emailAnalysis,
        riskUpdated: shouldUpdate,
        newRiskLevel: assessmentResult?.ragScore || currentRagScore,
        suggestedAction: emailAnalysis.suggestedAction
      });

    } catch (error) {
      console.error("Error assessing email risk:", error);
      res.status(500).json({ error: "Failed to assess email risk" });
    }
  });

  // Comprehensive risk evaluation that checks if reassessment is needed
  app.post("/api/cases/:ticketId/evaluate-risk", async (req, res) => {
    try {
      const { ticketId } = req.params;

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Get current analysis and form data
      const existingAnalysis = await storage.getAnalysisByTicket(ticketId);
      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);

      if (!existingAnalysis) {
        return res.status(404).json({ error: "No analysis found for case" });
      }

      // Check if reassessment is needed
      const lastAssessment = existingAnalysis.createdAt || new Date();
      const shouldReassess = riskAssessmentService.shouldReassess(
        lastAssessment,
        [], // No new inputs for this check
        existingAnalysis.ragScore
      );

      // Prepare comprehensive risk inputs
      const riskInputs: RiskInput[] = [];

      if (formSubmission) {
        riskInputs.push({
          type: 'form',
          content: formSubmission.rawData,
          timestamp: formSubmission.createdAt || new Date(),
          source: 'form_submission'
        });
      }

      // Perform comprehensive assessment
      const assessmentResult = await riskAssessmentService.assessRisk(
        riskInputs,
        existingAnalysis.ragScore as "green" | "amber" | "red"
      );

      // Update analysis if needed
      if (shouldReassess || assessmentResult.ragScore !== existingAnalysis.ragScore) {
        await storage.updateAnalysis(ticketId, {
          ragScore: assessmentResult.ragScore,
          fitClassification: assessmentResult.fitClassification,
          recommendations: assessmentResult.recommendations,
          notes: `${existingAnalysis.notes || ''}. Comprehensive risk evaluation completed. Confidence: ${assessmentResult.confidence}%`
        }, {
          changeSource: 'auto_reassessment',
          changeReason: 'Comprehensive risk evaluation completed',
          triggeredBy: 'system',
          confidence: assessmentResult.confidence
        });
      }

      res.json({
        success: true,
        currentRisk: assessmentResult.ragScore,
        confidence: assessmentResult.confidence,
        riskFactors: assessmentResult.riskFactors,
        recommendations: assessmentResult.recommendations,
        reassessmentNeeded: shouldReassess,
        assessmentUpdated: shouldReassess || assessmentResult.ragScore !== existingAnalysis.ragScore
      });

    } catch (error) {
      console.error("Error evaluating risk:", error);
      res.status(500).json({ error: "Failed to evaluate risk" });
    }
  });

  // Get risk history for a case
  app.get("/api/cases/:ticketId/risk-history", async (req, res) => {
    try {
      const { ticketId } = req.params;

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Get risk history
      const riskHistory = await storage.getRiskHistoryByTicket(ticketId);
      
      res.json({
        success: true,
        ticketId,
        history: riskHistory
      });

    } catch (error) {
      console.error("Error fetching risk history:", error);
      res.status(500).json({ error: "Failed to fetch risk history" });
    }
  });

  // Update case status
  app.put("/api/cases/:ticketId/status", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;

      const validStatuses = ["NEW", "ANALYSING", "AWAITING_REVIEW", "REVISIONS_REQUIRED", "READY_TO_SEND", "COMPLETE"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await storage.updateTicketStatus(ticketId, status);

      res.json({ success: true, message: "Status updated" });
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Update case next step
  app.put("/api/cases/:ticketId/next-step", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate request body with Zod
      const parseResult = stepUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(parseResult.error).toString() 
        });
      }
      
      const { nextStep, assignedTo, completePreviousStep, completionNotes } = parseResult.data;

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      let updatedTicket;
      if (completePreviousStep) {
        // Complete current step and set new next step
        updatedTicket = await storage.updateTicketStepAndComplete(ticketId, nextStep, assignedTo, completionNotes);
      } else {
        // Just update the next step
        updatedTicket = await storage.updateTicketStep(ticketId, nextStep, assignedTo);
      }

      res.json({ 
        success: true, 
        message: "Next step updated successfully",
        ticket: updatedTicket
      });
    } catch (error) {
      console.error("Error updating next step:", error);
      res.status(500).json({ error: "Failed to update next step" });
    }
  });

  // Complete current step and set new next step (ALWAYS requires next step)
  app.put("/api/cases/:ticketId/complete-step", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate request body - MUST include nextStep to maintain invariant
      const completeStepSchema = z.object({
        nextStep: z.string().min(1, "Next step is required - workers must always have a next step"),
        assignedTo: z.string().optional(),
        completionNotes: z.string().optional()
      });
      
      const parseResult = completeStepSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(parseResult.error).toString() 
        });
      }
      
      const { nextStep, assignedTo, completionNotes } = parseResult.data;

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      if (!ticket.nextStep) {
        return res.status(400).json({ error: "No current step to complete" });
      }

      // Complete current step AND set new next step to maintain invariant
      const updatedTicket = await storage.updateTicketStepAndComplete(ticketId, nextStep, assignedTo, completionNotes);

      res.json({ 
        success: true, 
        message: "Step completed and new step assigned successfully",
        ticket: updatedTicket
      });
    } catch (error) {
      console.error("Error completing step:", error);
      res.status(500).json({ error: "Failed to complete step" });
    }
  });

  // Regenerate injury analysis
  app.post("/api/cases/:ticketId/regenerate-analysis", async (req, res) => {
    try {
      const { ticketId } = req.params;

      // Get the original form submission
      const submission = await storage.getFormSubmissionByTicket(ticketId);
      if (!submission) {
        return res.status(404).json({ error: "Form submission not found" });
      }

      // Check if this is an injury case
      const ticket = await storage.getTicket(ticketId);
      if (!ticket || ticket.caseType !== "injury") {
        return res.status(400).json({ error: "Analysis regeneration only available for injury cases" });
      }

      // Re-run injury analysis with enhanced engine
      const formData = submission.rawData as any;
      const analysisResult = injuryAnalysisEngine.analyzeInjury(formData);

      // Update the analysis with enhanced results
      await storage.updateAnalysis(ticketId, {
        ragScore: analysisResult.ragScore,
        fitClassification: analysisResult.fitClassification,
        recommendations: analysisResult.recommendations,
        notes: analysisResult.notes,
      });

      console.log(`Regenerated analysis for case ${ticketId}`);
      res.json({ success: true, analysis: analysisResult });

    } catch (error) {
      console.error("Error regenerating analysis:", error);
      res.status(500).json({ error: "Failed to regenerate analysis" });
    }
  });

  // Update assessment notes
  app.put("/api/cases/:ticketId/assessment-notes", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { notes } = req.body;

      // Validate notes
      if (typeof notes !== "string") {
        return res.status(400).json({ error: "Notes must be a string" });
      }

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Update analysis notes
      await storage.updateAnalysis(ticketId, { notes });

      console.log(`Updated assessment notes for case ${ticketId}`);
      res.json({ success: true, message: "Assessment notes updated" });

    } catch (error) {
      console.error("Error updating assessment notes:", error);
      res.status(500).json({ error: "Failed to update assessment notes" });
    }
  });

  // Stakeholder API endpoints
  
  // Get stakeholders for a case
  app.get("/api/cases/:ticketId/stakeholders", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const stakeholders = await storage.getStakeholdersByTicket(ticketId);
      res.json(stakeholders);
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
      res.status(500).json({ error: "Failed to fetch stakeholders" });
    }
  });

  // Get specific stakeholder
  app.get("/api/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const { stakeholderId } = req.params;
      const stakeholder = await storage.getStakeholder(stakeholderId);
      
      if (!stakeholder) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      
      res.json(stakeholder);
    } catch (error) {
      console.error("Error fetching stakeholder:", error);
      res.status(500).json({ error: "Failed to fetch stakeholder" });
    }
  });

  // Create new stakeholder
  app.post("/api/stakeholders", async (req, res) => {
    try {
      const stakeholderData = req.body;
      
      // Validate stakeholder data
      const validationResult = insertStakeholderSchema.safeParse(stakeholderData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid stakeholder data", details: errorMessage });
      }

      const stakeholder = await storage.createStakeholder(validationResult.data);
      
      console.log(`Created stakeholder ${stakeholder.id} for case ${stakeholder.ticketId}`);
      res.json({ success: true, stakeholder });
      
    } catch (error) {
      console.error("Error creating stakeholder:", error);
      res.status(500).json({ error: "Failed to create stakeholder" });
    }
  });

  // Update stakeholder
  app.put("/api/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const { stakeholderId } = req.params;
      const updates = req.body;
      
      // Validate partial stakeholder updates
      const partialSchema = insertStakeholderSchema.partial();
      const validationResult = partialSchema.safeParse(updates);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid stakeholder update data", details: errorMessage });
      }

      const stakeholder = await storage.updateStakeholder(stakeholderId, validationResult.data);
      
      console.log(`Updated stakeholder ${stakeholderId}`);
      res.json({ success: true, stakeholder });
      
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      res.status(500).json({ error: "Failed to update stakeholder" });
    }
  });

  // Delete stakeholder
  app.delete("/api/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const { stakeholderId } = req.params;
      
      await storage.deleteStakeholder(stakeholderId);
      
      console.log(`Deleted stakeholder ${stakeholderId}`);
      res.json({ success: true, message: "Stakeholder deleted successfully" });
      
    } catch (error) {
      console.error("Error deleting stakeholder:", error);
      res.status(500).json({ error: "Failed to delete stakeholder" });
    }
  });

  // RTW Plan API endpoints
  
  // Get RTW plans for a ticket
  app.get("/api/cases/:ticketId/rtw-plans", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const plans = await storage.getRtwPlansByTicket(ticketId);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching RTW plans:", error);
      res.status(500).json({ error: "Failed to fetch RTW plans" });
    }
  });

  // Get specific RTW plan
  app.get("/api/rtw-plans/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      const plan = await storage.getRtwPlan(planId);
      
      if (!plan) {
        return res.status(404).json({ error: "RTW plan not found" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Error fetching RTW plan:", error);
      res.status(500).json({ error: "Failed to fetch RTW plan" });
    }
  });

  // Create new RTW plan
  app.post("/api/cases/:ticketId/rtw-plans", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const planData = { ...req.body, ticketId };
      
      // Validate RTW plan data
      const validationResult = rtwPlanSchema.safeParse(planData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid RTW plan data", details: errorMessage });
      }

      const plan = await storage.createRtwPlan(validationResult.data);
      
      console.log(`Created RTW plan ${plan.id} for case ${ticketId}`);
      res.json({ success: true, plan });
      
    } catch (error) {
      console.error("Error creating RTW plan:", error);
      res.status(500).json({ error: "Failed to create RTW plan" });
    }
  });

  // Update RTW plan
  app.put("/api/rtw-plans/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      const updates = req.body;
      
      // Validate partial RTW plan updates
      const partialSchema = rtwPlanSchema.partial();
      const validationResult = partialSchema.safeParse(updates);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid RTW plan update data", details: errorMessage });
      }

      const plan = await storage.updateRtwPlan(planId, validationResult.data);
      
      console.log(`Updated RTW plan ${planId}`);
      res.json({ success: true, plan });
      
    } catch (error) {
      console.error("Error updating RTW plan:", error);
      res.status(500).json({ error: "Failed to update RTW plan" });
    }
  });

  // Update RTW plan status
  app.patch("/api/rtw-plans/:planId/status", async (req, res) => {
    try {
      const { planId } = req.params;
      const { status } = req.body;
      
      if (!["draft", "pending_approval", "approved", "active", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      const plan = await storage.updateRtwPlanStatus(planId, status);
      
      console.log(`Updated RTW plan ${planId} status to ${status}`);
      res.json({ success: true, plan });
      
    } catch (error) {
      console.error("Error updating RTW plan status:", error);
      res.status(500).json({ error: "Failed to update RTW plan status" });
    }
  });

  // Delete RTW plan
  app.delete("/api/rtw-plans/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      await storage.deleteRtwPlan(planId);
      
      console.log(`Deleted RTW plan ${planId}`);
      res.json({ success: true });
      
    } catch (error) {
      console.error("Error deleting RTW plan:", error);
      res.status(500).json({ error: "Failed to delete RTW plan" });
    }
  });

  // Block legacy report endpoints to prevent type errors
  app.use(/^\/api\/cases\/[^/]+\/reports(\/.*)?$/, (_req, res) => {
    res.status(410).json({ error: "Legacy reports removed. Use /api/reports/* endpoints instead." });
  });

  // ===============================================
  // PDF REPORT GENERATION API - LEGACY (TO BE REMOVED)
  // ===============================================
  
  // Generate case summary report
  app.get("/api/cases/:ticketId/reports/case-summary", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Fetch all necessary data for the case summary
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      // Get worker from ticket workerId or form submission
      let worker = null;
      if (ticket.workerId) {
        worker = await storage.getWorker(ticket.workerId);
      }
      
      // If no worker found from ticket, try to get from form submission
      if (!worker) {
        const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
        if (formSubmission && formSubmission.workerId) {
          worker = await storage.getWorker(formSubmission.workerId);
        }
      }
      
      // Create a default worker object if none found
      if (!worker) {
        worker = {
          id: "unknown",
          firstName: "Unknown",
          lastName: "Worker",
          email: "unknown@example.com",
          phone: "",
          roleApplied: "Unknown Role",
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
      const analysis = await storage.getAnalysisByTicket(ticketId);
      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
      const injury = await storage.getInjuryByTicket(ticketId);
      const stakeholders = await storage.getStakeholdersByTicket(ticketId);
      // TODO: Add getEmailsByTicket and getAttachmentsByTicket methods to storage
      const emails: any[] = [];
      const attachments: any[] = [];
      const rtwPlans = await storage.getRtwPlansByTicket(ticketId);
      const rtwPlan = rtwPlans.length > 0 ? rtwPlans[0] : null;
      
      const reportData = {
        ticket,
        worker,
        analysis: analysis || null,
        formSubmission: formSubmission || null,
        injury,
        rtwPlan,
        stakeholders,
        emails,
        attachments,
        generatedAt: new Date().toISOString(),
        generatedBy: "GPNet System"
      };
      
      const pdfBuffer = await pdfService.generateCaseSummaryReport(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="case-summary-${ticketId}.pdf"`);
      res.send(pdfBuffer);
      
      console.log(`Generated case summary report for case ${ticketId}`);
      
    } catch (error) {
      console.error("Error generating case summary report:", error);
      res.status(500).json({ error: "Failed to generate case summary report" });
    }
  });

  // Generate pre-employment assessment report
  app.get("/api/cases/:ticketId/reports/pre-employment", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      if (ticket.caseType !== "pre_employment") {
        return res.status(400).json({ error: "This report is only available for pre-employment cases" });
      }
      
      // Get worker from ticket workerId or form submission
      let worker = null;
      if (ticket.workerId) {
        worker = await storage.getWorker(ticket.workerId);
      }
      
      // If no worker found from ticket, try to get from form submission
      if (!worker) {
        const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
        if (formSubmission && formSubmission.workerId) {
          worker = await storage.getWorker(formSubmission.workerId);
        }
      }
      
      // Create a default worker object if none found
      if (!worker) {
        worker = {
          id: "unknown",
          firstName: "Unknown",
          lastName: "Worker", 
          email: "unknown@example.com",
          phone: "",
          roleApplied: "Unknown Role",
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
      const analysis = await storage.getAnalysisByTicket(ticketId);
      if (!analysis) {
        return res.status(400).json({ error: "Analysis not found. Please complete the assessment first." });
      }
      
      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
      if (!formSubmission) {
        return res.status(400).json({ error: "Form submission not found. Please complete the pre-employment form first." });
      }
      
      const reportData = {
        ticket,
        worker,
        analysis: analysis,
        formSubmission: formSubmission,
        generatedAt: new Date().toISOString(),
        generatedBy: "GPNet System",
        companyName: ticket.companyName || "Company Name Not Specified",
        recommendations: analysis.recommendations || []
      };
      
      const pdfBuffer = await pdfService.generatePreEmploymentReport(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="pre-employment-assessment-${worker.firstName}-${worker.lastName}.pdf"`);
      res.send(pdfBuffer);
      
      console.log(`Generated pre-employment assessment report for case ${ticketId}`);
      
    } catch (error) {
      console.error("Error generating pre-employment assessment report:", error);
      res.status(500).json({ error: "Failed to generate pre-employment assessment report" });
    }
  });

  // Generate injury report
  app.get("/api/cases/:ticketId/reports/injury", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      if (ticket.caseType !== "injury") {
        return res.status(400).json({ error: "This report is only available for injury cases" });
      }
      
      const worker = await storage.getWorker(ticket.workerId!);
      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }
      
      const injury = await storage.getInjuryByTicket(ticketId);
      if (!injury) {
        return res.status(400).json({ error: "Injury details not found. Please complete the injury report first." });
      }
      
      const analysis = await storage.getAnalysisByTicket(ticketId);
      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
      const stakeholders = await storage.getStakeholdersByTicket(ticketId);
      const rtwPlans = await storage.getRtwPlansByTicket(ticketId);
      const rtwPlan = rtwPlans.length > 0 ? rtwPlans[0] : null;
      
      const reportData = {
        ticket,
        worker,
        injury,
        formSubmission: formSubmission || null,
        analysis: analysis || null,
        stakeholders,
        rtwPlan,
        generatedAt: new Date().toISOString(),
        generatedBy: "GPNet System"
      };
      
      const pdfBuffer = await pdfService.generateInjuryReport(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="injury-report-${worker.firstName}-${worker.lastName}.pdf"`);
      res.send(pdfBuffer);
      
      console.log(`Generated injury report for case ${ticketId}`);
      
    } catch (error) {
      console.error("Error generating injury report:", error);
      res.status(500).json({ error: "Failed to generate injury report" });
    }
  });

  // Generate compliance audit report
  app.get("/api/cases/:ticketId/reports/compliance-audit", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      const worker = await storage.getWorker(ticket.workerId!);
      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }
      
      // Fetch compliance data
      const auditTrail = await storage.getComplianceAuditByTicket(ticketId);
      const workflowSteps = await storage.getRtwWorkflowStepsByTicket(ticketId);
      const participationEvents = await storage.getWorkerParticipationEventsByTicket(ticketId);
      const generatedLetters = await storage.getGeneratedLettersByTicket(ticketId);
      
      const reportData = {
        ticket,
        worker,
        auditTrail,
        workflowSteps,
        participationEvents,
        generatedLetters,
        generatedAt: new Date().toISOString(),
        generatedBy: "GPNet System"
      };
      
      const pdfBuffer = await pdfService.generateComplianceAuditReport(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-audit-${ticketId}.pdf"`);
      res.send(pdfBuffer);
      
      console.log(`Generated compliance audit report for case ${ticketId}`);
      
    } catch (error) {
      console.error("Error generating compliance audit report:", error);
      res.status(500).json({ error: "Failed to generate compliance audit report" });
    }
  });

  // Get available reports for a case
  app.get("/api/cases/:ticketId/reports", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      const availableReports = [
        {
          type: "case-summary",
          name: "Case Summary Report",
          description: "Comprehensive overview of the case including all details, analysis, and stakeholders",
          url: `/api/cases/${ticketId}/reports/case-summary`,
          available: true
        }
      ];
      
      if (ticket.caseType === "pre_employment") {
        const analysis = await storage.getAnalysisByTicket(ticketId);
        const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
        
        availableReports.push({
          type: "pre-employment",
          name: "Pre-Employment Assessment Report",
          description: "Professional report for employers with fitness classification and recommendations",
          url: `/api/cases/${ticketId}/reports/pre-employment`,
          available: !!analysis && !!formSubmission
        });
      }
      
      if (ticket.caseType === "injury") {
        const injury = await storage.getInjuryByTicket(ticketId);
        
        availableReports.push({
          type: "injury",
          name: "Workplace Injury Report",
          description: "Comprehensive injury documentation for compliance and case management",
          url: `/api/cases/${ticketId}/reports/injury`,
          available: !!injury
        });
      }
      
      // Compliance audit report is available for all cases
      availableReports.push({
        type: "compliance-audit",
        name: "Compliance Audit Report",
        description: "Legal compliance documentation with full audit trail for defense purposes",
        url: `/api/cases/${ticketId}/reports/compliance-audit`,
        available: true
      });
      
      res.json({
        caseId: ticketId,
        caseType: ticket.caseType,
        availableReports
      });
      
    } catch (error) {
      console.error("Error fetching available reports:", error);
      res.status(500).json({ error: "Failed to fetch available reports" });
    }
  });

  // ===============================================
  // RTW COMPLEX CLAIMS - LEGISLATION COMPLIANCE API
  // ===============================================

  // Import legislation data from JSON
  app.post("/api/legislation/import", async (req, res) => {
    try {
      const { jsonData } = req.body;
      let importCount = 0;

      // Import WIRC Act sections
      if (jsonData.WIRC) {
        for (const [sectionId, details] of Object.entries(jsonData.WIRC)) {
          const sectionDetails = details as any;
          const legislationData = {
            source: "WIRC",
            sectionId,
            title: sectionDetails.title,
            summary: sectionDetails.summary,
            sourceUrl: sectionDetails.url,
            version: jsonData.source_version || "2025-09-19",
            checksum: jsonData.checksum || "pending",
            documentType: "act",
            jurisdiction: "VIC"
          };

          await storage.createLegislationDocument(legislationData);
          importCount++;
        }
      }

      // Import Claims Manual sections
      if (jsonData.CLAIMS_MANUAL) {
        for (const [sectionId, details] of Object.entries(jsonData.CLAIMS_MANUAL)) {
          const sectionDetails = details as any;
          const legislationData = {
            source: "CLAIMS_MANUAL",
            sectionId,
            title: sectionDetails.title,
            summary: sectionDetails.summary || "",
            sourceUrl: sectionDetails.url,
            version: jsonData.source_version || "2025-09-19",
            checksum: jsonData.checksum || "pending",
            documentType: "manual",
            jurisdiction: "VIC"
          };

          await storage.createLegislationDocument(legislationData);
          importCount++;
        }
      }

      console.log(`Imported ${importCount} legislation sections`);
      res.json({ 
        success: true, 
        message: `Successfully imported ${importCount} legislation sections`,
        importCount 
      });

    } catch (error) {
      console.error("Error importing legislation data:", error);
      res.status(500).json({ error: "Failed to import legislation data" });
    }
  });

  // Get all legislation
  app.get("/api/legislation", async (req, res) => {
    try {
      const legislation = await storage.getAllLegislation();
      res.json(legislation);
    } catch (error) {
      console.error("Error fetching legislation:", error);
      res.status(500).json({ error: "Failed to fetch legislation" });
    }
  });

  // Get legislation by source (WIRC, CLAIMS_MANUAL)
  app.get("/api/legislation/:source", async (req, res) => {
    try {
      const { source } = req.params;
      const legislation = await storage.getLegislationBySource(source);
      res.json(legislation);
    } catch (error) {
      console.error("Error fetching legislation by source:", error);
      res.status(500).json({ error: "Failed to fetch legislation" });
    }
  });

  // Get specific legislation section
  app.get("/api/legislation/:source/:sectionId", async (req, res) => {
    try {
      const { source, sectionId } = req.params;
      const legislation = await storage.getLegislationBySourceAndSection(source, sectionId);
      
      if (!legislation) {
        return res.status(404).json({ error: "Legislation section not found" });
      }
      
      res.json(legislation);
    } catch (error) {
      console.error("Error fetching legislation section:", error);
      res.status(500).json({ error: "Failed to fetch legislation section" });
    }
  });

  // RTW Workflow Management
  app.post("/api/tickets/:ticketId/rtw-workflow", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const workflowData = req.body;

      // Remove ticketId from body and ensure route param takes precedence
      const { ticketId: bodyTicketId, ...cleanWorkflowData } = workflowData;
      
      const stepData = {
        ticketId, // Route parameter always takes precedence
        ...cleanWorkflowData
      };

      const step = await storage.createRtwWorkflowStep(stepData);

      // Update ticket RTW status
      await storage.updateTicketRtwStatus(
        ticketId, 
        workflowData.stepId, 
        "compliant"
      );

      console.log(`Created RTW workflow step for ticket ${ticketId}`);
      res.json({ success: true, step });

    } catch (error) {
      console.error("Error creating RTW workflow step:", error);
      res.status(500).json({ error: "Failed to create RTW workflow step" });
    }
  });

  // Get RTW workflow steps for a ticket
  app.get("/api/tickets/:ticketId/rtw-workflow", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const steps = await storage.getRtwWorkflowStepsByTicket(ticketId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching RTW workflow steps:", error);
      res.status(500).json({ error: "Failed to fetch RTW workflow steps" });
    }
  });

  // Update RTW workflow step
  app.patch("/api/rtw-workflow/:stepId", async (req, res) => {
    try {
      const { stepId } = req.params;
      const updates = req.body;

      const step = await storage.updateRtwWorkflowStep(stepId, updates);

      console.log(`Updated RTW workflow step ${stepId}`);
      res.json({ success: true, step });

    } catch (error) {
      console.error("Error updating RTW workflow step:", error);
      res.status(500).json({ error: "Failed to update RTW workflow step" });
    }
  });

  // Compliance Audit
  app.post("/api/tickets/:ticketId/compliance-audit", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const auditData = req.body;

      // Remove ticketId from body and ensure route param takes precedence
      const { ticketId: bodyTicketId, ...cleanAuditData } = auditData;
      
      const audit = await storage.createComplianceAudit({
        ticketId, // Route parameter always takes precedence
        ...cleanAuditData
      });

      console.log(`Created compliance audit for ticket ${ticketId}`);
      res.json({ success: true, audit });

    } catch (error) {
      console.error("Error creating compliance audit:", error);
      res.status(500).json({ error: "Failed to create compliance audit" });
    }
  });

  // Get compliance audit trail for a ticket
  app.get("/api/tickets/:ticketId/compliance-audit", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const auditTrail = await storage.getComplianceAuditByTicket(ticketId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Error fetching compliance audit:", error);
      res.status(500).json({ error: "Failed to fetch compliance audit" });
    }
  });

  // Worker Participation Events
  app.post("/api/tickets/:ticketId/participation-events", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const eventData = req.body;

      // Remove ticketId from body and ensure route param takes precedence
      const { ticketId: bodyTicketId, ...cleanEventData } = eventData;
      
      const event = await storage.createWorkerParticipationEvent({
        ticketId, // Route parameter always takes precedence
        ...cleanEventData
      });

      console.log(`Created participation event for ticket ${ticketId}`);
      res.json({ success: true, event });

    } catch (error) {
      console.error("Error creating participation event:", error);
      res.status(500).json({ error: "Failed to create participation event" });
    }
  });

  // Get worker participation events for a ticket
  app.get("/api/tickets/:ticketId/participation-events", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const events = await storage.getWorkerParticipationEventsByTicket(ticketId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching participation events:", error);
      res.status(500).json({ error: "Failed to fetch participation events" });
    }
  });

  // ===============================================
  // RTW WORKFLOW ENGINE API
  // ===============================================

  // Initialize RTW workflow for a new case
  app.post("/api/tickets/:ticketId/rtw-workflow/initialize", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate input
      const initSchema = z.object({
        injuryDate: z.string().min(1, "Injury date is required").refine(
          (date) => !isNaN(Date.parse(date)), 
          "Invalid date format"
        )
      });
      
      const { injuryDate } = initSchema.parse(req.body);

      // Import workflow engine
      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      const workflowStep = await workflowEngine.initializeWorkflow(ticketId, new Date(injuryDate));

      console.log(`Initialized RTW workflow for ticket ${ticketId}`);
      res.json({ success: true, workflowStep });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error initializing RTW workflow:", error);
      res.status(500).json({ error: "Failed to initialize RTW workflow" });
    }
  });

  // Complete a workflow step
  app.patch("/api/rtw-workflow/:stepId/complete", async (req, res) => {
    try {
      const { stepId } = req.params;
      
      // Validate input
      const completeSchema = z.object({
        outcome: z.enum(["completed", "escalated", "terminated", "withdrawn"], {
          errorMap: () => ({ message: "Invalid outcome value" })
        }),
        completedBy: z.string().min(1, "Completed by is required"),
        notes: z.string().optional()
      });
      
      const { outcome, completedBy, notes } = completeSchema.parse(req.body);

      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      await workflowEngine.completeWorkflowStep(stepId, outcome, completedBy, notes);

      console.log(`Completed workflow step ${stepId} with outcome: ${outcome}`);
      res.json({ success: true });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error completing workflow step:", error);
      res.status(500).json({ error: "Failed to complete workflow step" });
    }
  });

  // Record worker participation event
  app.post("/api/tickets/:ticketId/worker-participation", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate input
      const participationSchema = z.object({
        eventType: z.string().min(1, "Event type is required"),
        participationLevel: z.enum(["full", "partial", "none", "refused"], {
          errorMap: () => ({ message: "Invalid participation level" })
        }),
        notes: z.string().optional()
      });
      
      const { eventType, participationLevel, notes } = participationSchema.parse(req.body);

      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      await workflowEngine.recordWorkerParticipation(ticketId, eventType, participationLevel, notes);

      console.log(`Recorded worker participation for ticket ${ticketId}`);
      res.json({ success: true });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error recording worker participation:", error);
      res.status(500).json({ error: "Failed to record worker participation" });
    }
  });

  // Get workflow summary for a ticket
  app.get("/api/tickets/:ticketId/rtw-workflow/summary", async (req, res) => {
    try {
      const { ticketId } = req.params;

      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      const summary = await workflowEngine.getWorkflowSummary(ticketId);

      res.json(summary);

    } catch (error) {
      console.error("Error getting workflow summary:", error);
      res.status(500).json({ error: "Failed to get workflow summary" });
    }
  });

  // Process workflow progression (for scheduled tasks)
  app.post("/api/rtw-workflow/process-progression", async (req, res) => {
    try {
      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      await workflowEngine.processWorkflowProgression();

      console.log("Processed RTW workflow progression for all active cases");
      res.json({ success: true, message: "Workflow progression processed" });

    } catch (error) {
      console.error("Error processing workflow progression:", error);
      res.status(500).json({ error: "Failed to process workflow progression" });
    }
  });

  // ===============================================
  // LETTER TEMPLATE API - FOR MICHELLE INTEGRATION
  // ===============================================

  // Get all letter templates
  app.get("/api/letter-templates", async (req, res) => {
    try {
      const templates = await storage.getAllLetterTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching letter templates:", error);
      res.status(500).json({ error: "Failed to fetch letter templates" });
    }
  });

  // Get templates by type
  app.get("/api/letter-templates/type/:templateType", async (req, res) => {
    try {
      const { templateType } = req.params;
      const templates = await storage.getLetterTemplatesByType(templateType);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching letter templates by type:", error);
      res.status(500).json({ error: "Failed to fetch letter templates" });
    }
  });

  // Get specific letter template
  app.get("/api/letter-templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;
      const template = await storage.getLetterTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Letter template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching letter template:", error);
      res.status(500).json({ error: "Failed to fetch letter template" });
    }
  });

  // Create new letter template
  app.post("/api/letter-templates", async (req, res) => {
    try {
      const templateData = req.body;
      
      const template = await storage.createLetterTemplate(templateData);
      
      console.log(`Created letter template: ${template.name}`);
      res.json({ success: true, template });
    } catch (error) {
      console.error("Error creating letter template:", error);
      res.status(500).json({ error: "Failed to create letter template" });
    }
  });

  // Generate letter from template for a ticket
  app.post("/api/tickets/:ticketId/letters/generate", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { templateId, recipientType, recipientEmail, recipientName, tokens } = req.body;
      
      // Get the template
      const template = await storage.getLetterTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Letter template not found" });
      }
      
      // Get ticket and related data for token replacement
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      // Basic token replacement (extend this with more sophisticated engine)
      let content = template.content;
      let subject = template.title;
      
      // Replace common tokens
      const allTokens = {
        ticketId: ticket.id,
        workerName: tokens?.workerName || "Worker", 
        companyName: ticket.companyName || "Company",
        currentDate: new Date().toLocaleDateString(),
        deadlineDate: tokens?.deadlineDate || "",
        ...tokens
      };
      
      // Simple token replacement
      Object.entries(allTokens).forEach(([key, value]) => {
        const tokenPattern = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(tokenPattern, String(value));
        subject = subject.replace(tokenPattern, String(value));
      });
      
      // Create generated letter record
      const generatedLetter = await storage.createGeneratedLetter({
        ticketId,
        templateId,
        recipientType,
        recipientEmail: recipientEmail || "",
        recipientName: recipientName || "",
        subject,
        content,
        tokens: allTokens,
        legislationRefs: template.legislationRefs || null,
        deadlineDate: tokens?.deadlineDate,
        status: "draft",
        generatedBy: "Michelle AI"
      });
      
      console.log(`Generated letter ${generatedLetter.id} for ticket ${ticketId}`);
      res.json({ success: true, letter: generatedLetter });
      
    } catch (error) {
      console.error("Error generating letter:", error);
      res.status(500).json({ error: "Failed to generate letter" });
    }
  });

  // Get generated letters for a ticket
  app.get("/api/tickets/:ticketId/letters", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const letters = await storage.getGeneratedLettersByTicket(ticketId);
      res.json(letters);
    } catch (error) {
      console.error("Error fetching generated letters:", error);
      res.status(500).json({ error: "Failed to fetch generated letters" });
    }
  });

  // Update letter status (when sent, etc.)
  app.patch("/api/letters/:letterId/status", async (req, res) => {
    try {
      const { letterId } = req.params;
      const { status } = req.body;
      
      const letter = await storage.updateGeneratedLetterStatus(letterId, status);
      
      console.log(`Updated letter ${letterId} status to ${status}`);
      res.json({ success: true, letter });
    } catch (error) {
      console.error("Error updating letter status:", error);
      res.status(500).json({ error: "Failed to update letter status" });
    }
  });

  // LLM Adapter Service endpoints per CR-GPNet-LLM-001 specification
  const { llmChat, llmReport, llmClassify, llmLookup, ChatRequest, ReportRequest, ClassifyRequest, LookupRequest } = await import('./llmAdapter.js');

  // Michelle chat endpoint - uses gpt-4o-mini
  app.post("/api/llm/chat", async (req, res) => {
    try {
      const validationResult = ChatRequest.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid chat request", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const result = await llmChat(validationResult.data);
      res.json(result);
    } catch (error) {
      console.error("Error in LLM chat:", error);
      res.status(500).json({ error: "Chat service temporarily unavailable" });
    }
  });

  // Report generation endpoint - uses gpt-4.1
  app.post("/api/llm/report", async (req, res) => {
    try {
      const validationResult = ReportRequest.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid report request", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const result = await llmReport(validationResult.data);
      res.json(result);
    } catch (error) {
      console.error("Error in LLM report:", error);
      res.status(500).json({ error: "Report generation temporarily unavailable" });
    }
  });

  // Classification endpoint - uses gpt-4o-mini
  app.post("/api/llm/classify", async (req, res) => {
    try {
      const validationResult = ClassifyRequest.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid classify request", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const result = await llmClassify(validationResult.data);
      res.json(result);
    } catch (error) {
      console.error("Error in LLM classify:", error);
      res.status(500).json({ error: "Classification service temporarily unavailable" });
    }
  });

  // Legislation lookup endpoint - uses gpt-4o-mini  
  app.post("/api/llm/lookup", async (req, res) => {
    try {
      const validationResult = LookupRequest.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid lookup request", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const result = await llmLookup(validationResult.data);
      res.json(result);
    } catch (error) {
      console.error("Error in LLM lookup:", error);
      res.status(500).json({ error: "Lookup service temporarily unavailable" });
    }
  });

  app.post("/api/test/submit-form", async (req, res) => {
    try {
      // This endpoint simulates a form submission for testing
      const testFormData: PreEmploymentFormData = {
        firstName: "John",
        lastName: "Smith",
        dateOfBirth: "1990-01-01",
        phone: "+1-555-123-4567",
        email: "john.smith@test.com",
        roleApplied: "Warehouse Operator",
        site: "Main Site",
        previousInjuries: "Minor back strain 2 years ago",
        conditions: [],
        medications: "None",
        allergies: "None",
        mskBack: "past",
        mskBackDetails: "Previous minor strain, fully recovered",
        mskNeck: "none",
        mskShoulders: "none",
        mskElbows: "none",
        mskWrists: "none",
        mskHips: "none",
        mskKnees: "none",
        mskAnkles: "none",
        liftingKg: 25,
        standingMins: 120,
        walkingMins: 60,
        repetitiveTasks: "no",
        sleepRating: 4,
        stressRating: 2,
        supportRating: 4,
        psychosocialComments: "Generally feeling good about work-life balance",
        consentToShare: true,
        signature: "John Smith",
        signatureDate: new Date().toISOString().split('T')[0],
      };

      // Process through the same workflow as the webhook
      const response = await fetch(`${req.protocol}://${req.get('host')}/api/webhook/jotform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testFormData),
      });

      const result = await response.json();
      res.json({ success: true, result });

    } catch (error) {
      console.error("Error in test submission:", error);
      res.status(500).json({ error: "Test submission failed" });
    }
  });

  // ===============================================
  // FRESHDESK INTEGRATION API ENDPOINTS
  // ===============================================

  // Import Freshdesk service at top of file (will be handled separately)
  const { freshdeskService } = await import("./freshdeskService");

  /**
   * FRESHDESK WEBHOOK ENDPOINTS
   * Handle incoming webhooks from Freshdesk for bidirectional sync
   */

  // Freshdesk webhook handler - receives updates from Freshdesk
  app.post("/api/freshdesk/webhook", async (req, res) => {
    console.log("Received Freshdesk webhook - processing ticket update");
    
    // Basic webhook authentication check
    const webhookSecret = process.env.FRESHDESK_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = req.headers['x-freshdesk-secret'] || req.headers['authorization'];
      if (!providedSecret || providedSecret !== webhookSecret) {
        console.log("Unauthorized webhook request - invalid secret");
        return res.status(401).json({ error: "Unauthorized webhook request" });
      }
    }
    
    try {
      const webhookData = req.body;
      
      // Extract ticket data from webhook payload
      const { ticket_id, ticket_status, ticket_priority, ticket_notes } = webhookData;
      
      if (!ticket_id) {
        return res.status(400).json({ error: "Missing ticket_id in webhook payload" });
      }

      // Find the corresponding GPNet ticket
      const freshdeskMapping = await storage.getFreshdeskTicketByFreshdeskId(ticket_id);
      if (!freshdeskMapping) {
        console.log(`No GPNet mapping found for Freshdesk ticket ${ticket_id}, skipping`);
        return res.status(200).json({ message: "No mapping found, webhook ignored" });
      }

      const gpnetTicketId = freshdeskMapping.gpnetTicketId;
      const gpnetTicket = await storage.getTicket(gpnetTicketId);
      
      if (!gpnetTicket) {
        console.error(`GPNet ticket ${gpnetTicketId} not found for Freshdesk ticket ${ticket_id}`);
        return res.status(404).json({ error: "GPNet ticket not found" });
      }

      let syncUpdates = false;
      let updateLog: any = { trigger: 'freshdesk_webhook', freshdeskTicketId: ticket_id };

      // Sync status changes from Freshdesk to GPNet
      if (ticket_status && webhookData.changes?.status) {
        const freshdeskToGpnetStatus = {
          2: 'NEW',           // Open -> New
          3: 'PENDING',       // Pending -> Pending  
          4: 'COMPLETE',      // Resolved -> Complete
          5: 'COMPLETE'       // Closed -> Complete
        };

        const newGpnetStatus = freshdeskToGpnetStatus[ticket_status as keyof typeof freshdeskToGpnetStatus] || gpnetTicket.status;
        
        if (newGpnetStatus !== gpnetTicket.status) {
          await storage.updateTicketStatus(gpnetTicketId, newGpnetStatus);
          updateLog.statusSync = { from: gpnetTicket.status, to: newGpnetStatus };
          syncUpdates = true;
          console.log(`Synced status from Freshdesk: ${gpnetTicket.status} -> ${newGpnetStatus}`);
        }
      }

      // Sync priority changes from Freshdesk to GPNet
      if (ticket_priority && webhookData.changes?.priority) {
        const freshdeskToGpnetPriority = {
          1: 'low',
          2: 'medium', 
          3: 'high',
          4: 'urgent'
        };

        const newGpnetPriority = freshdeskToGpnetPriority[ticket_priority as keyof typeof freshdeskToGpnetPriority] || gpnetTicket.priority;
        
        if (newGpnetPriority !== gpnetTicket.priority && newGpnetPriority) {
          await storage.updateTicketPriority(gpnetTicketId, newGpnetPriority);
          updateLog.prioritySync = { from: gpnetTicket.priority, to: newGpnetPriority };
          syncUpdates = true;
          console.log(`Synced priority from Freshdesk: ${gpnetTicket.priority} -> ${newGpnetPriority}`);
        }
      }

      // Handle note/comment sync from Freshdesk to GPNet
      if (ticket_notes && Array.isArray(ticket_notes)) {
        let syncedCount = 0;
        for (const note of ticket_notes) {
          if (note.body && !note.private) { // Only sync public notes
            // Create correspondence entry in GPNet with deduplication
            const result = await storage.createCorrespondence({
              ticketId: gpnetTicketId,
              direction: 'inbound',
              type: 'note',
              subject: 'Freshdesk Update',
              content: note.body,
              senderName: note.user_name || 'Freshdesk User',
              senderEmail: note.user_email || '',
              source: 'freshdesk',
              externalId: note.id?.toString()
            });
            
            if (result) {
              syncedCount++;
              syncUpdates = true;
              console.log(`Synced note from Freshdesk ticket ${ticket_id} to GPNet`);
            }
          }
        }
        if (syncedCount > 0) {
          updateLog.noteSync = { count: syncedCount };
        }
      }

      // Update sync mapping status and log all webhook events
      if (syncUpdates) {
        await storage.updateFreshdeskTicketStatus(freshdeskMapping.id, 'synced');
      }
      
      // Always log webhook events for audit trail
      await storage.createFreshdeskSyncLog(
        freshdeskService.createSyncLog(
          gpnetTicketId,
          ticket_id,
          'webhook_update',
          'from_freshdesk',
          syncUpdates ? 'success' : 'skipped',
          updateLog
        )
      );

      res.status(200).json({ 
        success: true, 
        gpnetTicketId,
        syncUpdates,
        message: syncUpdates ? 'Updates synced successfully' : 'No changes to sync'
      });

    } catch (error) {
      console.error("Freshdesk webhook processing failed:", error);
      
      // Log failed webhook processing
      try {
        if (req.body.ticket_id) {
          const mapping = await storage.getFreshdeskTicketByFreshdeskId(req.body.ticket_id);
          if (mapping) {
            await storage.createFreshdeskSyncLog(
              freshdeskService.createSyncLog(
                mapping.gpnetTicketId,
                req.body.ticket_id,
                'update',
                'from_freshdesk',
                'failed',
                { trigger: 'freshdesk_webhook' },
                error instanceof Error ? error.message : 'Unknown error'
              )
            );
          }
        }
      } catch (logError) {
        console.error("Failed to log webhook error:", logError);
      }

      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Create Freshdesk ticket for a GPNet case
  app.post("/api/freshdesk/tickets", async (req, res) => {
    try {
      const { gpnetTicketId } = req.body;
      
      if (!gpnetTicketId) {
        return res.status(400).json({ error: "GPNet ticket ID is required" });
      }

      // Check if Freshdesk ticket already exists
      const existingMapping = await storage.getFreshdeskTicketByGpnetId(gpnetTicketId);
      if (existingMapping) {
        return res.status(409).json({ 
          error: "Freshdesk ticket already exists for this case",
          freshdeskTicketId: existingMapping.freshdeskTicketId 
        });
      }

      // Get GPNet ticket details
      const gpnetTicket = await storage.getTicket(gpnetTicketId);
      if (!gpnetTicket) {
        return res.status(404).json({ error: "GPNet ticket not found" });
      }

      // Get worker data if available
      let workerData = null;
      if (gpnetTicket.workerId) {
        workerData = await storage.getWorker(gpnetTicket.workerId);
      }

      let freshdeskTicket = null;
      let syncLog;

      if (freshdeskService.isAvailable()) {
        try {
          // Create ticket in Freshdesk
          freshdeskTicket = await freshdeskService.createTicket(gpnetTicket, workerData);
          
          if (freshdeskTicket) {
            // Store mapping in database
            const mapping = await storage.createFreshdeskTicket({
              gpnetTicketId,
              freshdeskTicketId: freshdeskTicket.id,
              freshdeskUrl: `https://${process.env.FRESHDESK_DOMAIN}.freshdesk.com/a/tickets/${freshdeskTicket.id}`,
              syncStatus: 'synced',
              freshdeskData: freshdeskTicket
            });

            // Log successful sync
            syncLog = await storage.createFreshdeskSyncLog(
              freshdeskService.createSyncLog(
                gpnetTicketId,
                freshdeskTicket.id,
                'create',
                'to_freshdesk',
                'success',
                { freshdeskTicket }
              )
            );

            res.status(201).json({
              success: true,
              mapping,
              freshdeskTicket,
              freshdeskUrl: mapping.freshdeskUrl
            });
          } else {
            throw new Error('Failed to create Freshdesk ticket');
          }
        } catch (error) {
          console.error('Freshdesk ticket creation failed:', error);
          
          // Log failed sync
          syncLog = await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              gpnetTicketId,
              null,
              'create',
              'to_freshdesk',
              'failed',
              { gpnetTicket },
              error instanceof Error ? error.message : 'Unknown error'
            )
          );

          res.status(500).json({ 
            error: "Failed to create Freshdesk ticket",
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        // Freshdesk not available, log skip
        syncLog = await storage.createFreshdeskSyncLog(
          freshdeskService.createSyncLog(
            gpnetTicketId,
            null,
            'create',
            'to_freshdesk',
            'skipped',
            { reason: 'Freshdesk integration not configured' }
          )
        );

        res.status(200).json({
          success: true,
          message: "Freshdesk integration not configured, ticket creation skipped",
          gpnetTicketId
        });
      }
    } catch (error) {
      console.error("Error creating Freshdesk ticket:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sync GPNet ticket status to Freshdesk
  app.put("/api/freshdesk/tickets/:gpnetTicketId/sync", async (req, res) => {
    try {
      const { gpnetTicketId } = req.params;

      // Get GPNet ticket
      const gpnetTicket = await storage.getTicket(gpnetTicketId);
      if (!gpnetTicket) {
        return res.status(404).json({ error: "GPNet ticket not found" });
      }

      // Get Freshdesk mapping
      const mapping = await storage.getFreshdeskTicketByGpnetId(gpnetTicketId);
      if (!mapping) {
        return res.status(404).json({ error: "Freshdesk ticket mapping not found" });
      }

      let syncLog;

      if (freshdeskService.isAvailable()) {
        try {
          // Sync status to Freshdesk
          const updatedTicket = await freshdeskService.syncTicketStatus(
            gpnetTicket, 
            mapping.freshdeskTicketId
          );

          if (updatedTicket) {
            // Update mapping
            await storage.updateFreshdeskTicket(mapping.id, {
              syncStatus: 'synced',
              freshdeskData: updatedTicket
            });

            // Log successful sync
            syncLog = await storage.createFreshdeskSyncLog(
              freshdeskService.createSyncLog(
                gpnetTicketId,
                mapping.freshdeskTicketId,
                'sync_status',
                'to_freshdesk',
                'success',
                { updatedTicket }
              )
            );

            res.json({
              success: true,
              syncedAt: new Date().toISOString(),
              freshdeskTicket: updatedTicket
            });
          } else {
            throw new Error('Failed to sync ticket status');
          }
        } catch (error) {
          console.error('Freshdesk sync failed:', error);

          // Update mapping status
          await storage.updateFreshdeskTicket(mapping.id, {
            syncStatus: 'failed'
          });

          // Log failed sync
          syncLog = await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              gpnetTicketId,
              mapping.freshdeskTicketId,
              'sync_status',
              'to_freshdesk',
              'failed',
              { gpnetTicket },
              error instanceof Error ? error.message : 'Unknown error'
            )
          );

          res.status(500).json({ 
            error: "Failed to sync ticket status",
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        // Freshdesk not available, log skip
        syncLog = await storage.createFreshdeskSyncLog(
          freshdeskService.createSyncLog(
            gpnetTicketId,
            mapping.freshdeskTicketId,
            'sync_status',
            'to_freshdesk',
            'skipped',
            { reason: 'Freshdesk integration not configured' }
          )
        );

        res.json({
          success: true,
          message: "Freshdesk integration not configured, sync skipped"
        });
      }
    } catch (error) {
      console.error("Error syncing to Freshdesk:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get Freshdesk ticket mapping and sync logs
  app.get("/api/freshdesk/tickets/:gpnetTicketId", async (req, res) => {
    try {
      const { gpnetTicketId } = req.params;

      // Get mapping
      const mapping = await storage.getFreshdeskTicketByGpnetId(gpnetTicketId);
      if (!mapping) {
        return res.status(404).json({ error: "Freshdesk ticket mapping not found" });
      }

      // Get sync logs
      const syncLogs = await storage.getFreshdeskSyncLogsByTicket(gpnetTicketId);

      res.json({
        mapping,
        syncLogs,
        freshdeskUrl: mapping.freshdeskUrl,
        isIntegrationAvailable: freshdeskService.isAvailable()
      });
    } catch (error) {
      console.error("Error getting Freshdesk ticket info:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all Freshdesk mappings and sync status
  app.get("/api/freshdesk/tickets", async (req, res) => {
    try {
      const mappings = await storage.getAllFreshdeskTickets();
      const failedSyncs = await storage.getFailedFreshdeskSyncLogs();

      res.json({
        mappings,
        failedSyncs: failedSyncs.slice(0, 10), // Last 10 failed syncs
        totalMappings: mappings.length,
        totalFailedSyncs: failedSyncs.length,
        isIntegrationAvailable: freshdeskService.isAvailable()
      });
    } catch (error) {
      console.error("Error getting Freshdesk mappings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add note to Freshdesk ticket
  app.post("/api/freshdesk/tickets/:gpnetTicketId/notes", async (req, res) => {
    try {
      const { gpnetTicketId } = req.params;
      const { note, isPrivate = false } = req.body;

      if (!note) {
        return res.status(400).json({ error: "Note content is required" });
      }

      // Get Freshdesk mapping
      const mapping = await storage.getFreshdeskTicketByGpnetId(gpnetTicketId);
      if (!mapping) {
        return res.status(404).json({ error: "Freshdesk ticket mapping not found" });
      }

      if (freshdeskService.isAvailable()) {
        try {
          const noteResponse = await freshdeskService.addNote(
            mapping.freshdeskTicketId,
            note,
            isPrivate
          );

          // Log successful note addition
          await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              gpnetTicketId,
              mapping.freshdeskTicketId,
              'add_note',
              'to_freshdesk',
              'success',
              { note, isPrivate, noteResponse }
            )
          );

          res.json({
            success: true,
            noteId: noteResponse?.id,
            addedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to add note to Freshdesk:', error);

          // Log failed note addition
          await storage.createFreshdeskSyncLog(
            freshdeskService.createSyncLog(
              gpnetTicketId,
              mapping.freshdeskTicketId,
              'add_note',
              'to_freshdesk',
              'failed',
              { note, isPrivate },
              error instanceof Error ? error.message : 'Unknown error'
            )
          );

          res.status(500).json({ 
            error: "Failed to add note to Freshdesk",
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        // Log skip
        await storage.createFreshdeskSyncLog(
          freshdeskService.createSyncLog(
            gpnetTicketId,
            mapping.freshdeskTicketId,
            'add_note',
            'to_freshdesk',
            'skipped',
            { note, isPrivate, reason: 'Freshdesk integration not configured' }
          )
        );

        res.json({
          success: true,
          message: "Freshdesk integration not configured, note addition skipped"
        });
      }
    } catch (error) {
      console.error("Error adding note to Freshdesk:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check Freshdesk integration status
  app.get("/api/freshdesk/status", async (req, res) => {
    try {
      const isAvailable = freshdeskService.isAvailable();
      const stats = await storage.getAllFreshdeskTickets();
      const failedSyncs = await storage.getFailedFreshdeskSyncLogs();

      res.json({
        isAvailable,
        hasApiKey: !!process.env.FRESHDESK_API_KEY,
        hasDomain: !!process.env.FRESHDESK_DOMAIN,
        totalMappings: stats.length,
        failedSyncs: failedSyncs.length,
        configuration: {
          domain: process.env.FRESHDESK_DOMAIN || null,
          // Never expose the actual API key
          apiKeyConfigured: !!process.env.FRESHDESK_API_KEY
        }
      });
    } catch (error) {
      console.error("Error getting Freshdesk status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PDF Report Generation Endpoints with Authorization
  app.get("/api/reports/:ticketId/types", requireAuth, async (req, res) => {
    try {
      const { ticketId } = req.params;
      const user = req.session.user!;

      // Verify user has access to this ticket
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Check authorization - user must belong to the ticket's organization or be impersonating
      const isImpersonating = user.isImpersonating || false;
      const userOrgId = isImpersonating ? user.impersonationTarget : user.organizationId;
      const isAdmin = user.role === 'admin' && !isImpersonating;
      
      if (!isAdmin && ticket.organizationId !== userOrgId) {
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }

      // Get available report types for the ticket
      const { reportDataService } = await import('./reportDataService');
      const reportTypes = await reportDataService.getAvailableReportTypes(ticketId);

      res.json({ reportTypes });
    } catch (error) {
      console.error("Error getting available report types:", error);
      res.status(500).json({ error: "Failed to get available report types" });
    }
  });

  app.post("/api/reports/generate", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const ReportGenerateSchema = z.object({
        ticketId: z.string().min(1, "Ticket ID is required"),
        reportType: z.enum(["pre-employment", "case-summary", "injury-report", "compliance-audit"], {
          errorMap: () => ({ message: "Invalid report type" })
        }),
        options: z.object({
          includeConfidentialInfo: z.boolean().optional(),
          customFooter: z.string().optional(),
          letterhead: z.boolean().optional()
        }).optional()
      });

      const validationResult = ReportGenerateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const { ticketId, reportType, options } = validationResult.data;
      const user = req.session.user!;

      // Verify user has access to this ticket
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Check authorization - user must belong to the ticket's organization or be impersonating
      const isImpersonating = user.isImpersonating || false;
      const userOrgId = isImpersonating ? user.impersonationTarget : user.organizationId;
      const isAdmin = user.role === 'admin' && !isImpersonating;
      
      if (!isAdmin && ticket.organizationId !== userOrgId) {
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }

      // Import services dynamically to avoid circular dependencies
      const { reportDataService } = await import('./reportDataService');
      const { pdfService } = await import('./pdfService');

      let pdfBuffer: Buffer;
      const generatedBy = `${user.firstName} ${user.lastName} (${user.email})`;

      // Generate the appropriate report based on type
      switch (reportType) {
        case 'pre-employment':
          const preEmploymentData = await reportDataService.getPreEmploymentReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generatePreEmploymentReport(preEmploymentData, options);
          break;
          
        case 'case-summary':
          const caseSummaryData = await reportDataService.getCaseSummaryReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generateCaseSummaryReport(caseSummaryData, options);
          break;
          
        case 'injury-report':
          const injuryData = await reportDataService.getInjuryReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generateInjuryReport(injuryData, options);
          break;
          
        case 'compliance-audit':
          const auditData = await reportDataService.getComplianceAuditReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generateComplianceAuditReport(auditData, options);
          break;
          
        default:
          return res.status(400).json({ error: `Unsupported report type: ${reportType}` });
      }

      // Set appropriate headers for PDF download
      const fileName = `${reportType}-report-${ticketId}-${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

    } catch (error) {
      console.error("Error generating PDF report:", error);
      res.status(500).json({ 
        error: "Failed to generate PDF report", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/reports/preview", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const ReportPreviewSchema = z.object({
        ticketId: z.string().min(1, "Ticket ID is required"),
        reportType: z.enum(["pre-employment", "case-summary", "injury-report", "compliance-audit"], {
          errorMap: () => ({ message: "Invalid report type" })
        })
      });

      const validationResult = ReportPreviewSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const { ticketId, reportType } = validationResult.data;
      const user = req.session.user!;

      // Verify user has access to this ticket
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Check authorization - user must belong to the ticket's organization or be impersonating
      const isImpersonating = user.isImpersonating || false;
      const userOrgId = isImpersonating ? user.impersonationTarget : user.organizationId;
      const isAdmin = user.role === 'admin' && !isImpersonating;
      
      if (!isAdmin && ticket.organizationId !== userOrgId) {
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }

      const { reportDataService } = await import('./reportDataService');
      const generatedBy = `${user.firstName} ${user.lastName} (${user.email})`;

      // Get report data for preview (without generating PDF)
      let reportData: any;
      switch (reportType) {
        case 'pre-employment':
          reportData = await reportDataService.getPreEmploymentReportData(ticketId, generatedBy);
          break;
        case 'case-summary':
          reportData = await reportDataService.getCaseSummaryReportData(ticketId, generatedBy);
          break;
        case 'injury-report':
          reportData = await reportDataService.getInjuryReportData(ticketId, generatedBy);
          break;
        case 'compliance-audit':
          reportData = await reportDataService.getComplianceAuditReportData(ticketId, generatedBy);
          break;
        default:
          return res.status(400).json({ error: `Unsupported report type: ${reportType}` });
      }

      // Return structured data for preview
      const preview = {
        reportType,
        ticketId,
        generatedAt: reportData.generatedAt,
        generatedBy: reportData.generatedBy,
        worker: reportData.worker,
        ticket: reportData.ticket,
        analysis: reportData.analysis,
        hasFormSubmission: !!reportData.formSubmission,
        hasRecommendations: !!(reportData.recommendations && reportData.recommendations.length > 0),
        companyName: reportData.companyName
      };

      res.json({ preview });

    } catch (error) {
      console.error("Error generating report preview:", error);
      res.status(500).json({ 
        error: "Failed to generate report preview", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Email Report Delivery Endpoints
  app.post("/api/reports/email", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const EmailReportSchema = z.object({
        ticketId: z.string().min(1, "Ticket ID is required"),
        reportType: z.enum(["pre-employment", "case-summary", "injury-report", "compliance-audit"], {
          errorMap: () => ({ message: "Invalid report type" })
        }),
        recipients: z.array(z.object({
          email: z.string().email("Invalid email address"),
          name: z.string().optional(),
          role: z.string().optional()
        })).min(1, "At least one recipient is required"),
        customMessage: z.string().optional(),
        includeComplianceNote: z.boolean().optional().default(true),
        options: z.object({
          includeConfidentialInfo: z.boolean().optional(),
          customFooter: z.string().optional(),
          letterhead: z.boolean().optional()
        }).optional()
      });

      const validationResult = EmailReportSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const { ticketId, reportType, recipients, customMessage, includeComplianceNote, options } = validationResult.data;
      const user = req.session.user!;

      // Verify user has access to this ticket
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Check authorization
      const isImpersonating = user.isImpersonating || false;
      const userOrgId = isImpersonating ? user.impersonationTarget : user.organizationId;
      const isAdmin = user.role === 'admin' && !isImpersonating;
      
      if (!isAdmin && ticket.organizationId !== userOrgId) {
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }

      // Import services dynamically
      const { reportDataService } = await import('./reportDataService');
      const { pdfService } = await import('./pdfService');
      const { emailService } = await import('./emailService');

      // Check if email service is available
      if (!emailService.isAvailable()) {
        return res.status(503).json({ 
          error: "Email service not configured", 
          details: "Please configure SMTP settings to enable email delivery"
        });
      }

      const generatedBy = `${user.firstName} ${user.lastName} (${user.email})`;

      // Generate PDF report
      let pdfBuffer: Buffer;
      switch (reportType) {
        case 'pre-employment':
          const preEmploymentData = await reportDataService.getPreEmploymentReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generatePreEmploymentReport(preEmploymentData, options);
          break;
        case 'case-summary':
          const caseSummaryData = await reportDataService.getCaseSummaryReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generateCaseSummaryReport(caseSummaryData, options);
          break;
        case 'injury-report':
          const injuryData = await reportDataService.getInjuryReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generateInjuryReport(injuryData, options);
          break;
        case 'compliance-audit':
          const auditData = await reportDataService.getComplianceAuditReportData(ticketId, generatedBy);
          pdfBuffer = await pdfService.generateComplianceAuditReport(auditData, options);
          break;
        default:
          return res.status(400).json({ error: `Unsupported report type: ${reportType}` });
      }

      // Send email with PDF attachment
      const emailResult = await emailService.sendReportEmail({
        ticketId,
        reportType,
        recipients,
        pdfBuffer,
        customMessage,
        includeComplianceNote
      }, storage);

      if (emailResult.success) {
        res.json({ 
          success: true, 
          message: "Report sent successfully via email",
          messageId: emailResult.messageId,
          recipients: recipients.length
        });
      } else {
        res.status(500).json({ 
          error: "Failed to send report via email", 
          details: emailResult.error 
        });
      }

    } catch (error) {
      console.error("Error sending report via email:", error);
      res.status(500).json({ 
        error: "Failed to send report via email", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Check email service status
  app.get("/api/email/status", requireAuth, async (req, res) => {
    try {
      const { emailService } = await import('./emailService');
      
      res.json({
        isAvailable: emailService.isAvailable(),
        configured: {
          host: !!process.env.EMAIL_HOST || !!process.env.SMTP_HOST,
          user: !!process.env.EMAIL_USER || !!process.env.SMTP_USER,
          fromAddress: process.env.EMAIL_FROM_ADDRESS || 'reports@gpnet.com.au'
        }
      });
    } catch (error) {
      console.error("Error checking email status:", error);
      res.status(500).json({ error: "Failed to check email status" });
    }
  });

  // ===============================================
  // MICHELLE AI ESCALATION & SPECIALIST MANAGEMENT
  // ===============================================

  // Get all specialists
  app.get("/api/specialists", requireAdmin, async (req, res) => {
    try {
      const allSpecialists = await storage.getAllSpecialists();
      res.json(allSpecialists);
    } catch (error) {
      console.error("Error fetching specialists:", error);
      res.status(500).json({ error: "Failed to fetch specialists" });
    }
  });

  // Get specialist by ID
  app.get("/api/specialists/:specialistId", requireAdmin, async (req, res) => {
    try {
      const { specialistId } = req.params;
      const specialist = await storage.getSpecialist(specialistId);
      
      if (!specialist) {
        return res.status(404).json({ error: "Specialist not found" });
      }
      
      res.json(specialist);
    } catch (error) {
      console.error("Error fetching specialist:", error);
      res.status(500).json({ error: "Failed to fetch specialist" });
    }
  });

  // Get all escalations
  app.get("/api/escalations", requireAdmin, async (req, res) => {
    try {
      const { status, priority, specialistId } = req.query;
      
      const escalations = await storage.getEscalations({
        status: status as string,
        priority: priority as string,
        specialistId: specialistId as string
      });
      
      res.json(escalations);
    } catch (error) {
      console.error("Error fetching escalations:", error);
      res.status(500).json({ error: "Failed to fetch escalations" });
    }
  });

  // Get escalation by ID with full context
  app.get("/api/escalations/:escalationId", requireAdmin, async (req, res) => {
    try {
      const { escalationId } = req.params;
      const escalation = await storage.getEscalationWithContext(escalationId);
      
      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      
      res.json(escalation);
    } catch (error) {
      console.error("Error fetching escalation:", error);
      res.status(500).json({ error: "Failed to fetch escalation" });
    }
  });

  // Update escalation status
  app.patch("/api/escalations/:escalationId/status", requireAdmin, async (req, res) => {
    try {
      const { escalationId } = req.params;
      // Validate request body
      const statusUpdateSchema = z.object({
        status: z.enum(["pending", "assigned", "in_progress", "resolved", "cancelled"]),
        resolutionNotes: z.string().optional()
      });
      
      const validatedData = statusUpdateSchema.parse(req.body);
      const { status, resolutionNotes } = validatedData;

      const updatedEscalation = await storage.updateEscalationStatus(escalationId, status, resolutionNotes);
      
      if (!updatedEscalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }

      console.log(`Updated escalation ${escalationId} status to ${status}`);
      res.json(updatedEscalation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error updating escalation status:", error);
      res.status(500).json({ error: "Failed to update escalation status" });
    }
  });

  // Assign escalation to specialist
  app.post("/api/escalations/:escalationId/assign", requireAdmin, async (req, res) => {
    try {
      const { escalationId } = req.params;
      // Validate request body
      const assignmentSchema = z.object({
        specialistId: z.string().min(1, "Specialist ID is required"),
        assignmentReason: z.string().optional(),
        assignmentType: z.string().optional().default("primary")
      });
      
      const validatedData = assignmentSchema.parse(req.body);
      const { specialistId, assignmentReason, assignmentType } = validatedData;

      const assignment = await storage.assignEscalationToSpecialist({
        escalationId,
        specialistId,
        assignmentReason: assignmentReason || "Manual assignment",
        assignmentType
      });

      console.log(`Assigned escalation ${escalationId} to specialist ${specialistId}`);
      res.json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Error assigning escalation:", error);
      res.status(500).json({ error: "Failed to assign escalation" });
    }
  });

  // Get escalations dashboard data
  app.get("/api/escalations/dashboard", requireAdmin, async (req, res) => {
    try {
      const dashboardData = await storage.getEscalationDashboardData();
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching escalation dashboard data:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Seed default specialists (development only)
  app.post("/api/specialists/seed", requireAdmin, async (req, res) => {
    try {
      // Check if specialists already exist
      const existingSpecialists = await storage.getAllSpecialists();
      if (existingSpecialists.length > 0) {
        return res.json({ message: "Specialists already exist", count: existingSpecialists.length });
      }

      // Create default specialists
      const defaultSpecialists = [
        {
          name: "Natalie Chen",
          email: "natalie.chen@gpnet.com.au",
          role: "coordinator",
          specialization: "complex_claims",
          phone: "+61 3 9999 1234",
          preferredContactMethod: "email",
          workingHours: {
            monday: { start: "09:00", end: "17:00" },
            tuesday: { start: "09:00", end: "17:00" },
            wednesday: { start: "09:00", end: "17:00" },
            thursday: { start: "09:00", end: "17:00" },
            friday: { start: "09:00", end: "16:00" },
            timezone: "Australia/Melbourne"
          },
          timezone: "Australia/Melbourne",
          maxCaseload: 15,
          expertiseRating: 9,
          averageResponseTime: 25,
          caseResolutionRate: 94
        },
        {
          name: "Dr. Sarah Mitchell",
          email: "s.mitchell@gpnet.com.au",
          role: "medical_reviewer",
          specialization: "occupational_health",
          phone: "+61 3 9999 2345",
          preferredContactMethod: "email",
          workingHours: {
            monday: { start: "08:00", end: "16:00" },
            tuesday: { start: "08:00", end: "16:00" },
            wednesday: { start: "08:00", end: "16:00" },
            thursday: { start: "08:00", end: "16:00" },
            friday: { start: "08:00", end: "15:00" },
            timezone: "Australia/Melbourne"
          },
          timezone: "Australia/Melbourne",
          maxCaseload: 8,
          expertiseRating: 10,
          averageResponseTime: 45,
          caseResolutionRate: 98
        },
        {
          name: "Michael Torres",
          email: "m.torres@gpnet.com.au", 
          role: "legal_advisor",
          specialization: "legal_compliance",
          phone: "+61 3 9999 3456",
          preferredContactMethod: "phone",
          workingHours: {
            monday: { start: "09:00", end: "18:00" },
            tuesday: { start: "09:00", end: "18:00" },
            wednesday: { start: "09:00", end: "18:00" },
            thursday: { start: "09:00", end: "18:00" },
            friday: { start: "09:00", end: "17:00" },
            timezone: "Australia/Melbourne"
          },
          timezone: "Australia/Melbourne",
          maxCaseload: 12,
          expertiseRating: 8,
          averageResponseTime: 60,
          caseResolutionRate: 92
        },
        {
          name: "Emma Davis",
          email: "e.davis@gpnet.com.au",
          role: "senior_analyst",
          specialization: "workers_compensation",
          phone: "+61 3 9999 4567",
          preferredContactMethod: "email",
          workingHours: {
            monday: { start: "08:30", end: "17:30" },
            tuesday: { start: "08:30", end: "17:30" },
            wednesday: { start: "08:30", end: "17:30" },
            thursday: { start: "08:30", end: "17:30" },
            friday: { start: "08:30", end: "16:30" },
            timezone: "Australia/Melbourne"
          },
          timezone: "Australia/Melbourne",
          maxCaseload: 20,
          expertiseRating: 7,
          averageResponseTime: 35,
          caseResolutionRate: 89
        }
      ];

      const createdSpecialists = [];
      for (const specialistData of defaultSpecialists) {
        const specialist = await storage.createSpecialist(specialistData);
        createdSpecialists.push(specialist);
      }

      console.log(`Created ${createdSpecialists.length} default specialists`);
      res.json({ 
        message: "Default specialists created successfully", 
        specialists: createdSpecialists 
      });

    } catch (error) {
      console.error("Error seeding specialists:", error);
      res.status(500).json({ error: "Failed to seed specialists" });
    }
  });

  // Send test email
  app.post("/api/email/test", requireAuth, async (req, res) => {
    try {
      const TestEmailSchema = z.object({
        email: z.string().email("Invalid email address")
      });

      const validationResult = TestEmailSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid email address", 
          details: fromZodError(validationResult.error).toString() 
        });
      }

      const { email } = validationResult.data;
      const { emailService } = await import('./emailService');

      if (!emailService.isAvailable()) {
        return res.status(503).json({ 
          error: "Email service not configured"
        });
      }

      const result = await emailService.sendTestEmail(email);

      if (result.success) {
        res.json({ 
          success: true, 
          message: "Test email sent successfully",
          messageId: result.messageId
        });
      } else {
        res.status(500).json({ 
          error: "Failed to send test email", 
          details: result.error 
        });
      }

    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ 
        error: "Failed to send test email", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Michelle AI Chat Endpoints with dual mode support
  app.post("/api/michelle/chat", requireAuth, async (req, res) => {
    try {
      const { conversationId, message, context } = req.body;
      
      if (!message?.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Build Michelle context from session with impersonation handling
      const isImpersonating = req.session.user!.isImpersonating || false;
      const michelleContext: MichelleContext = {
        conversationType: context?.mode === "universal" ? "universal_admin" : 
                         context?.ticketId ? "case_specific" : "client_scoped",
        organizationId: isImpersonating ? req.session.user!.impersonationTarget : req.session.user!.organizationId,
        ticketId: context?.ticketId || undefined,
        workerId: context?.workerId || undefined,
        userRole: req.session.user!.role as 'admin' | 'client_user',
        isImpersonating
      };

      let currentConversationId = conversationId;
      
      // Start new conversation if none provided
      if (!currentConversationId) {
        currentConversationId = await michelle.startConversation(michelleContext);
      }

      const response = await michelle.sendMessage(
        currentConversationId,
        message.trim(),
        michelleContext,
        req.ip,
        req.get('User-Agent')
      );

      res.json(response);
    } catch (error) {
      console.error("Michelle chat error:", error);
      res.status(500).json({ error: "Chat service temporarily unavailable" });
    }
  });

  app.delete("/api/michelle/conversation/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      await michelle.archiveConversation(conversationId);
      res.json({ success: true, message: "Conversation archived" });
    } catch (error) {
      console.error("Archive conversation error:", error);
      res.status(500).json({ error: "Failed to archive conversation" });
    }
  });

  app.get("/api/michelle/conversation/:conversationId/history", requireAuth, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const history = await michelle.getConversationHistory(conversationId);
      res.json({ history });
    } catch (error) {
      console.error("Get conversation history error:", error);
      res.status(500).json({ error: "Failed to get conversation history" });
    }
  });

  // Michelle Data Context API - provides mode-specific data
  app.get("/api/michelle/context", requireAuth, async (req, res) => {
    try {
      const isImpersonating = req.session.user!.isImpersonating || false;
      const userRole = isImpersonating ? 'client_user' : req.session.user!.role;
      const organizationId = isImpersonating ? req.session.user!.impersonationTarget : req.session.user!.organizationId;
      const isSuperuser = !isImpersonating && req.session.user!.role === 'admin' && (req.session.user!.permissions?.includes('superuser') || false);
      
      const michelleContext = {
        userId: req.session.user!.id,
        userRole,
        organizationId,
        isImpersonating,
        isSuperuser,
        mode: userRole === 'admin' && isSuperuser ? 'universal' : 'client-scoped',
        capabilities: userRole === 'admin' && isSuperuser 
          ? ['cross-tenant-analytics', 'phi-access', 'system-administration', 'platform-insights']
          : ['organization-analytics', 'case-management', 'worker-tracking'],
        availableConversationTypes: userRole === 'admin' && isSuperuser 
          ? ['universal_admin', 'client_scoped', 'case_specific']
          : ['client_scoped', 'case_specific']
      };

      res.json(michelleContext);
    } catch (error) {
      console.error("Michelle context error:", error);
      res.status(500).json({ error: "Failed to get Michelle context" });
    }
  });

  // Michelle Mode Status API - returns current user's Michelle mode
  app.get("/api/michelle/mode", requireAuth, async (req, res) => {
    try {
      const isImpersonating = req.session.user!.isImpersonating || false;
      const userType = isImpersonating ? 'client' : req.session.user!.role;
      const organizationId = isImpersonating ? req.session.user!.impersonationTarget : req.session.user!.organizationId;
      const isSuperuser = isImpersonating ? false : (req.session.user!.role === 'admin' && (req.session.user!.permissions?.includes('superuser') || false));
      const phiAccess = isImpersonating ? false : (req.session.user!.role === 'admin' && (req.session.user!.permissions?.includes('phi-access') || false));
      
      const mode = userType === 'admin' && isSuperuser ? 'universal' : 'client-scoped';
      const capabilities = mode === 'universal' 
        ? ['cross-tenant-analytics', 'phi-access', 'system-administration', 'platform-insights']
        : ['organization-analytics', 'case-management', 'worker-tracking'];

      res.json({
        mode,
        accessLevel: userType,
        organizationId,
        capabilities,
        phiAccess
      });
    } catch (error) {
      console.error("Michelle mode error:", error);
      res.status(500).json({ error: "Failed to get Michelle mode" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

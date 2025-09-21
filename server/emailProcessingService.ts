import { db } from "./db";
import { externalEmails, emailAttachments, aiRecommendations, tickets } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { emailParsingService, type RawEmailData, type ParsedEmail } from "./emailParsingService";
import { createCaseMatchingService, type MatchResult } from "./caseMatchingService";
import { michelle, type EmailAnalysisResult, type AiRecommendationResult } from "./michelle";
import { IStorage } from "./storage";
import { phiSanitizer } from "./phiSanitization";
import { z } from "zod";

export interface EmailProcessingResult {
  success: boolean;
  externalEmailId?: string;
  ticketId?: string;
  matchResult?: MatchResult;
  aiAnalysis?: EmailAnalysisResult;
  aiRecommendations?: AiRecommendationResult;
  storedRecommendationIds?: string[];
  error?: string;
  processingTime: number;
  isDuplicate?: boolean;
}

export interface ProcessingMetrics {
  totalEmails: number;
  successfulProcessing: number;
  duplicates: number;
  errors: number;
  averageProcessingTime: number;
  matchingSuccessRate: number;
}

export class EmailProcessingService {
  private storage: IStorage;
  private caseMatchingService: any;
  
  constructor(storage: IStorage) {
    this.storage = storage;
    this.caseMatchingService = createCaseMatchingService(storage);
  }

  /**
   * Process a complete email workflow from raw email to stored recommendations
   */
  async processIncomingEmail(
    rawEmail: RawEmailData,
    organizationId: string,
    forwardedBy: string
  ): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    let externalEmailId: string | undefined;
    
    try {
      // Step 1: Check for duplicates using message ID
      const existingEmail = await this.checkForDuplicateWithId(rawEmail.messageId, organizationId);
      if (existingEmail) {
        return {
          success: true,
          isDuplicate: true,
          externalEmailId: existingEmail.id,
          processingTime: Date.now() - startTime,
        };
      }

      // Step 2: Parse the email
      const parsedEmail = await emailParsingService.parseEmail(rawEmail, organizationId);
      
      // Step 3: Perform case matching
      const matchResult = await this.performCaseMatching(parsedEmail, organizationId);
      
      // Step 4: Store the external email record with idempotency handling
      externalEmailId = await this.storeExternalEmailSafely(
        parsedEmail, 
        organizationId, 
        forwardedBy,
        matchResult
      );
      
      // Step 5: Store attachments (only if we have a valid email ID)
      if (externalEmailId) {
        await this.storeAttachments(parsedEmail.attachments, externalEmailId, matchResult?.bestMatch?.ticketId);
      }
      
      // Step 6: Perform AI analysis with verified PHI sanitization
      const aiAnalysis = await this.performSecureAIAnalysis(
        parsedEmail,
        matchResult,
        { organizationId, ticketId: matchResult?.bestMatch?.ticketId }
      );
      
      // Step 7: Generate AI recommendations
      const aiRecommendations = await this.generateSecureAIRecommendations(
        aiAnalysis,
        parsedEmail,
        matchResult
      );
      
      // Step 8: Store AI recommendations ONLY if we have a valid ticket ID
      let storedRecommendationIds: string[] = [];
      if (matchResult?.bestMatch?.ticketId && externalEmailId) {
        storedRecommendationIds = await this.storeAIRecommendations(
          aiRecommendations,
          matchResult.bestMatch.ticketId,
          externalEmailId
        );
      }
      
      // Step 9: Update ticket priority and next steps if matched
      if (matchResult?.bestMatch?.ticketId) {
        await this.updateTicketFromEmailAnalysis(
          matchResult.bestMatch.ticketId,
          aiAnalysis,
          aiRecommendations
        );
      }
      
      // Step 10: Update processing status to success
      if (externalEmailId) {
        await this.updateProcessingStatus(externalEmailId, 'processed', aiAnalysis);
      }
      
      return {
        success: true,
        externalEmailId,
        ticketId: matchResult?.bestMatch?.ticketId,
        matchResult,
        aiAnalysis,
        aiRecommendations,
        storedRecommendationIds,
        processingTime: Date.now() - startTime,
      };
      
    } catch (error) {
      // Ensure we update the processing status to failed if we created a record
      if (externalEmailId) {
        try {
          await this.updateProcessingStatus(
            externalEmailId, 
            'error', 
            undefined,
            error instanceof Error ? error.message : 'Unknown processing error'
          );
        } catch (statusError) {
          console.error("Failed to update processing status:", statusError);
        }
      }
      
      // Log error without sensitive information
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      console.error("Email processing failed for organization", organizationId, ":", errorMessage);
      
      return {
        success: false,
        externalEmailId,
        error: errorMessage,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check for duplicate emails using message ID and return the existing record
   */
  private async checkForDuplicateWithId(messageId: string, organizationId: string): Promise<{ id: string } | null> {
    try {
      const [existing] = await db
        .select({ id: externalEmails.id })
        .from(externalEmails)
        .where(and(
          eq(externalEmails.messageId, messageId),
          eq(externalEmails.organizationId, organizationId)
        ))
        .limit(1);
      
      return existing || null;
    } catch (error) {
      console.error("Duplicate check failed:", error);
      return null; // Err on side of processing rather than skipping
    }
  }

  /**
   * Perform case matching with error handling
   */
  private async performCaseMatching(
    parsedEmail: ParsedEmail,
    organizationId: string
  ): Promise<MatchResult | undefined> {
    try {
      const matchResult = await this.caseMatchingService.findMatches(
        {
          extractedEntities: parsedEmail.extractedEntities,
          originalSender: parsedEmail.originalSender,
          originalSenderName: parsedEmail.originalSenderName,
          body: parsedEmail.body,
          subject: parsedEmail.subject,
        },
        organizationId
      );
      
      return matchResult;
    } catch (error) {
      console.error("Case matching failed:", error);
      return undefined; // Continue processing without match
    }
  }

  /**
   * Store external email with idempotency handling and constraint violation recovery
   */
  private async storeExternalEmailSafely(
    parsedEmail: ParsedEmail,
    organizationId: string,
    forwardedBy: string,
    matchResult?: MatchResult
  ): Promise<string> {
    try {
      const emailData = emailParsingService.convertToInsertFormat(
        parsedEmail,
        organizationId,
        matchResult?.bestMatch?.ticketId
      );
      
      // Override with workflow-specific data
      const insertData = {
        ...emailData,
        forwardedBy,
        confidenceScore: matchResult?.bestMatch?.confidenceScore,
        matchType: matchResult?.bestMatch?.matchType,
        matchReasoning: matchResult?.bestMatch?.matchReasoning,
        processingStatus: "processing" as const,
      };
      
      const [stored] = await db
        .insert(externalEmails)
        .values(insertData)
        .returning();
      
      return stored.id;
    } catch (error) {
      // Handle unique constraint violation gracefully
      if (error instanceof Error && error.message.includes('unique constraint')) {
        console.log(`Duplicate email detected for messageId: ${parsedEmail.messageId}`);
        
        // Try to find the existing record
        const existing = await this.checkForDuplicateWithId(parsedEmail.messageId, organizationId);
        if (existing) {
          return existing.id;
        }
      }
      
      console.error("Failed to store external email:", error);
      throw new Error(`Failed to store email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store email attachments with validation
   */
  private async storeAttachments(
    attachments: ParsedEmail['attachments'],
    externalEmailId: string,
    ticketId?: string
  ): Promise<void> {
    if (attachments.length === 0) return;
    
    try {
      const attachmentData = emailParsingService.convertAttachmentsToInsertFormat(
        attachments,
        externalEmailId,
        ticketId
      );
      
      // Add basic file validation
      const validatedAttachments = attachmentData.filter(attachment => {
        // Basic file size validation (50MB limit)
        if (attachment.fileSize && attachment.fileSize > 50 * 1024 * 1024) {
          console.warn(`Attachment ${attachment.filename} exceeds size limit`);
          return false;
        }
        
        // Basic file type validation
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];
        
        if (attachment.mimeType && !allowedTypes.includes(attachment.mimeType)) {
          console.warn(`Attachment ${attachment.filename} has disallowed type: ${attachment.mimeType}`);
          return false;
        }
        
        return true;
      });
      
      if (validatedAttachments.length > 0) {
        await db.insert(emailAttachments).values(validatedAttachments);
      }
    } catch (error) {
      console.error("Failed to store attachments:", error);
      // Don't fail the entire process for attachment issues
    }
  }

  /**
   * Perform AI analysis with verified PHI sanitization and response validation
   */
  private async performSecureAIAnalysis(
    parsedEmail: ParsedEmail,
    matchResult?: MatchResult,
    context?: { organizationId: string; ticketId?: string }
  ): Promise<EmailAnalysisResult> {
    try {
      // Use verified PHI sanitization
      const sanitizationResult = phiSanitizer.sanitizeEmailContent({
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        originalSender: parsedEmail.originalSender,
        originalSenderName: parsedEmail.originalSenderName,
      });
      
      // Log sanitization for monitoring
      if (sanitizationResult.sanitizationReport.totalRedactions > 0) {
        console.log(`PHI Sanitization: Redacted ${sanitizationResult.sanitizationReport.totalRedactions} items (Risk: ${sanitizationResult.sanitizationReport.riskLevel})`);
      }
      
      // Create sanitized ParsedEmail object
      const sanitizedEmail: ParsedEmail = {
        ...parsedEmail,
        subject: sanitizationResult.sanitizedEmail.subject,
        body: sanitizationResult.sanitizedEmail.body,
        originalSender: sanitizationResult.sanitizedEmail.originalSender || parsedEmail.originalSender,
        originalSenderName: sanitizationResult.sanitizedEmail.originalSenderName,
      };
      
      const result = await michelle.analyzeEmail(sanitizedEmail, matchResult, context);
      
      // Validate the AI response structure
      this.validateEmailAnalysisResult(result);
      
      return result;
    } catch (error) {
      console.error("Secure AI analysis failed:", error instanceof Error ? error.message : 'Unknown error');
      
      // Return fallback analysis
      return {
        summary: "Email analysis unavailable due to system error",
        urgencyLevel: "medium" as const,
        extractedActions: [],
        keyEntities: { people: [], dates: [], medicalTerms: [], locations: [] },
        sentiment: "neutral" as const,
        confidence: 0,
        tokenUsage: { promptTokens: 0, completionTokens: 0 }
      };
    }
  }

  /**
   * Generate AI recommendations with enhanced security and validation
   */
  private async generateSecureAIRecommendations(
    aiAnalysis: EmailAnalysisResult,
    parsedEmail: ParsedEmail,
    matchResult?: MatchResult
  ): Promise<AiRecommendationResult> {
    try {
      // Use the same sanitization as analysis for consistency
      const sanitizationResult = phiSanitizer.sanitizeEmailContent({
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        originalSender: parsedEmail.originalSender,
        originalSenderName: parsedEmail.originalSenderName,
      });
      
      const sanitizedEmail: ParsedEmail = {
        ...parsedEmail,
        subject: sanitizationResult.sanitizedEmail.subject,
        body: sanitizationResult.sanitizedEmail.body,
        originalSender: sanitizationResult.sanitizedEmail.originalSender || parsedEmail.originalSender,
        originalSenderName: sanitizationResult.sanitizedEmail.originalSenderName,
      };
      
      const result = await michelle.generateRecommendations(
        aiAnalysis,
        sanitizedEmail,
        matchResult
      );
      
      // Validate the AI response structure
      this.validateAiRecommendationResult(result);
      
      return result;
    } catch (error) {
      console.error("AI recommendation generation failed:", error instanceof Error ? error.message : 'Unknown error');
      
      // Return fallback recommendations
      return {
        recommendations: [{
          type: "manual_review",
          title: "Manual Review Required",
          description: "AI analysis failed - case requires manual review",
          priority: "medium" as const,
          suggestedAction: "manual_review",
          actionDetails: { reason: "AI_PROCESSING_ERROR" },
          estimatedTimeframe: "within_24h",
          reasoning: "Automated analysis was unavailable",
          confidence: 100
        }],
        overallAssessment: "Manual review required due to processing error",
        nextSteps: ["Assign case for manual review"],
        tokenUsage: { promptTokens: 0, completionTokens: 0 }
      };
    }
  }

  /**
   * Store AI recommendations with strict validation and error handling
   */
  private async storeAIRecommendations(
    recommendations: AiRecommendationResult,
    ticketId: string,
    externalEmailId: string
  ): Promise<string[]> {
    // Strict validation - only store if we have valid IDs
    if (!ticketId || !externalEmailId) {
      console.warn(`Cannot store recommendations: missing ticketId (${ticketId}) or externalEmailId (${externalEmailId})`);
      return [];
    }
    
    if (!recommendations.recommendations || recommendations.recommendations.length === 0) {
      console.warn("No recommendations to store");
      return [];
    }
    
    try {
      const storedIds: string[] = [];
      
      for (const rec of recommendations.recommendations) {
        // Validate each recommendation before storing
        if (!rec.type || !rec.title || !rec.description) {
          console.warn("Skipping invalid recommendation:", rec);
          continue;
        }
        
        const [stored] = await db.insert(aiRecommendations).values({
          ticketId,
          externalEmailId,
          recommendationType: rec.type,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          suggestedAction: rec.suggestedAction,
          actionDetails: rec.actionDetails,
          estimatedTimeframe: rec.estimatedTimeframe,
          confidenceScore: rec.confidence,
          model: "gpt-5",
          reasoning: rec.reasoning,
          status: "pending",
        }).returning();
        
        storedIds.push(stored.id);
      }
      
      console.log(`Successfully stored ${storedIds.length} AI recommendations for ticket ${ticketId}`);
      return storedIds;
    } catch (error) {
      console.error("Failed to store AI recommendations:", error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Update ticket based on AI analysis results
   */
  private async updateTicketFromEmailAnalysis(
    ticketId: string,
    aiAnalysis: EmailAnalysisResult,
    aiRecommendations: AiRecommendationResult
  ): Promise<void> {
    try {
      const updates: any = {};
      
      // Update priority based on urgency
      if (aiAnalysis.urgencyLevel === 'critical') {
        updates.priority = 'URGENT';
      } else if (aiAnalysis.urgencyLevel === 'high') {
        updates.priority = 'HIGH';
      }
      
      // Update next step based on highest priority recommendation
      const highestPriorityRec = aiRecommendations.recommendations
        .sort((a, b) => {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })[0];
      
      if (highestPriorityRec) {
        updates.nextStep = highestPriorityRec.title;
        updates.nextStepType = highestPriorityRec.type;
      }
      
      // Only update if we have changes
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        
        await db
          .update(tickets)
          .set(updates)
          .where(eq(tickets.id, ticketId));
      }
    } catch (error) {
      console.error("Failed to update ticket:", error);
      // Don't fail the entire process for ticket update issues
    }
  }

  /**
   * Update external email processing status with error tracking
   */
  private async updateProcessingStatus(
    externalEmailId: string,
    status: string,
    aiAnalysis?: EmailAnalysisResult,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        processingStatus: status,
        updatedAt: new Date(),
      };
      
      if (aiAnalysis) {
        updateData.aiSummary = aiAnalysis.summary;
        updateData.urgencyLevel = aiAnalysis.urgencyLevel;
        updateData.extractedEntities = {
          people: aiAnalysis.keyEntities.people,
          dates: aiAnalysis.keyEntities.dates,
          medicalTerms: aiAnalysis.keyEntities.medicalTerms,
          locations: aiAnalysis.keyEntities.locations,
        };
      }
      
      if (status === 'error' && errorMessage) {
        updateData.errorMessage = errorMessage;
      }
      
      await db
        .update(externalEmails)
        .set(updateData)
        .where(eq(externalEmails.id, externalEmailId));
    } catch (error) {
      console.error("Failed to update processing status:", error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate AI analysis result structure
   */
  private validateEmailAnalysisResult(result: EmailAnalysisResult): void {
    const schema = z.object({
      summary: z.string(),
      urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
      extractedActions: z.array(z.string()),
      keyEntities: z.object({
        people: z.array(z.string()),
        dates: z.array(z.string()),
        medicalTerms: z.array(z.string()),
        locations: z.array(z.string()),
      }),
      sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']),
      confidence: z.number().min(0).max(100),
      tokenUsage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
      }),
    });
    
    try {
      schema.parse(result);
    } catch (error) {
      console.error("AI analysis result validation failed:", error);
      throw new Error("Invalid AI analysis result structure");
    }
  }
  
  /**
   * Validate AI recommendation result structure
   */
  private validateAiRecommendationResult(result: AiRecommendationResult): void {
    const schema = z.object({
      recommendations: z.array(z.object({
        type: z.string(),
        title: z.string(),
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        suggestedAction: z.string(),
        actionDetails: z.any(),
        estimatedTimeframe: z.string(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(100),
      })),
      overallAssessment: z.string(),
      nextSteps: z.array(z.string()),
      tokenUsage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
      }),
    });
    
    try {
      schema.parse(result);
    } catch (error) {
      console.error("AI recommendation result validation failed:", error);
      throw new Error("Invalid AI recommendation result structure");
    }
  }

  /**
   * Get processing metrics for monitoring
   */
  async getProcessingMetrics(
    organizationId: string,
    timeframeHours: number = 24
  ): Promise<ProcessingMetrics> {
    try {
      const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
      
      const emails = await db
        .select()
        .from(externalEmails)
        .where(and(
          eq(externalEmails.organizationId, organizationId),
          // Note: Add createdAt comparison when we have the field properly indexed
        ));
      
      const recentEmails = emails.filter(email => 
        email.createdAt && new Date(email.createdAt) >= cutoffTime
      );
      
      const successfulProcessing = recentEmails.filter(email => 
        email.processingStatus === 'processed' || email.processingStatus === 'matched'
      ).length;
      
      const duplicates = recentEmails.filter(email => 
        email.processingStatus === 'duplicate'
      ).length;
      
      const errors = recentEmails.filter(email => 
        email.processingStatus === 'error'
      ).length;
      
      const matchedEmails = recentEmails.filter(email => 
        email.ticketId && email.confidenceScore && email.confidenceScore > 60
      ).length;
      
      return {
        totalEmails: recentEmails.length,
        successfulProcessing,
        duplicates,
        errors,
        averageProcessingTime: 0, // Would need to track processing times
        matchingSuccessRate: recentEmails.length > 0 ? matchedEmails / recentEmails.length : 0,
      };
    } catch (error) {
      console.error("Failed to get processing metrics:", error);
      return {
        totalEmails: 0,
        successfulProcessing: 0,
        duplicates: 0,
        errors: 0,
        averageProcessingTime: 0,
        matchingSuccessRate: 0,
      };
    }
  }

  /**
   * Reprocess failed emails
   */
  async reprocessFailedEmails(organizationId: string): Promise<EmailProcessingResult[]> {
    try {
      const failedEmails = await db
        .select()
        .from(externalEmails)
        .where(and(
          eq(externalEmails.organizationId, organizationId),
          eq(externalEmails.processingStatus, 'error')
        ));
      
      const results: EmailProcessingResult[] = [];
      
      for (const email of failedEmails) {
        try {
          // Reconstruct raw email data from stored information
          const rawEmail: RawEmailData = {
            messageId: email.messageId || '',
            from: email.originalSender,
            to: email.originalRecipient || '',
            subject: email.subject,
            body: email.body,
            htmlBody: email.htmlBody || undefined,
            date: email.originalDate || new Date(),
            attachments: [], // Attachments already stored separately
          };
          
          const result = await this.processIncomingEmail(
            rawEmail,
            organizationId,
            email.forwardedBy
          );
          
          results.push(result);
        } catch (error) {
          console.error(`Failed to reprocess email ${email.id}:`, error);
          results.push({
            success: false,
            error: `Reprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            processingTime: 0,
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error("Failed to reprocess failed emails:", error);
      return [];
    }
  }
}

// Export factory function to match the pattern from case matching service
export const createEmailProcessingService = (storage: IStorage) => new EmailProcessingService(storage);
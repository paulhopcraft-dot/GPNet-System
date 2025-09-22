/**
 * Email Draft Management Routes
 * 
 * Handles automated email draft generation, manager review,
 * and worker notification workflows.
 */

import { Router } from 'express';
import { z } from 'zod';
import { emailDraftingService, EmailDraftRequestSchema } from './emailDraftingService.js';
import { EmailService } from './emailService.js';
import { requireAuth } from './authRoutes.js';
import { storage } from './storage.js';

const router = Router();
const emailService = new EmailService();

// Validation schemas
const CreateDraftSchema = EmailDraftRequestSchema;

const ReviewDraftSchema = z.object({
  action: z.enum(['approve', 'edit', 'reject']),
  modifications: z.object({
    subject: z.string().optional(),
    customMessage: z.string().optional(),
    dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
    companyInstructions: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional()
  }).optional(),
  rejectionReason: z.string().optional()
});

/**
 * POST /api/email-drafts/generate
 * Generate a new email draft for health check request
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const data = CreateDraftSchema.parse(req.body);
    
    console.log('Generating email draft:', {
      ticketId: data.ticketId,
      managerEmail: data.managerEmail,
      urgency: data.urgency
    });
    
    // Generate and save email draft
    const draftId = await emailDraftingService.createEmailDraft(data);
    
    // Get the created draft with context for response
    const draftWithContext = await emailDraftingService.getEmailDraftWithContext(draftId);
    
    res.status(201).json({
      success: true,
      message: 'Email draft generated successfully',
      data: {
        draftId,
        draft: draftWithContext.draft,
        context: {
          worker: draftWithContext.worker,
          check: draftWithContext.check,
          ticket: draftWithContext.ticket
        }
      }
    });
    
  } catch (error) {
    console.error('Failed to generate email draft:', error);
    res.status(500).json({
      error: 'Failed to generate email draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/email-drafts/manager/:managerEmail
 * Get all drafts pending manager review
 * IMPORTANT: This route MUST come before '/:draftId' to avoid routing collision
 */
router.get('/manager/:managerEmail', requireAuth, async (req, res) => {
  try {
    const { managerEmail } = req.params;
    
    // Decode email if URL encoded
    const decodedEmail = decodeURIComponent(managerEmail);
    
    const drafts = await storage.getEmailDraftsForManager(decodedEmail);
    
    // Enrich with context data
    const enrichedDrafts = await Promise.all(
      drafts.map(async (draft: any) => {
        const [worker, check, ticket] = await Promise.all([
          storage.getWorker(draft.workerId),
          storage.getCheckById(draft.checkId),
          storage.getTicket(draft.ticketId)
        ]);
        
        return {
          draft,
          context: { worker, check, ticket }
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        drafts: enrichedDrafts,
        count: enrichedDrafts.length
      }
    });
    
  } catch (error) {
    console.error('Failed to get manager drafts:', error);
    res.status(500).json({
      error: 'Failed to retrieve manager drafts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/email-drafts/:draftId
 * Get email draft with full context for manager review
 */
router.get('/:draftId', requireAuth, async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const draftWithContext = await emailDraftingService.getEmailDraftWithContext(draftId);
    
    res.json({
      success: true,
      data: {
        draft: draftWithContext.draft,
        context: {
          worker: draftWithContext.worker,
          check: draftWithContext.check,
          ticket: draftWithContext.ticket
        }
      }
    });
    
  } catch (error) {
    console.error('Failed to get email draft:', error);
    res.status(404).json({
      error: 'Email draft not found',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/email-drafts/:draftId/review
 * Manager review and action on email draft
 */
router.put('/:draftId/review', requireAuth, async (req, res) => {
  try {
    const { draftId } = req.params;
    const reviewData = ReviewDraftSchema.parse(req.body);
    
    console.log('Manager reviewing draft:', {
      draftId,
      action: reviewData.action,
      managerEmail: req.session.user?.email
    });
    
    const draftWithContext = await emailDraftingService.getEmailDraftWithContext(draftId);
    
    switch (reviewData.action) {
      case 'approve':
        // Send email to worker and mark as sent
        if (emailService.isAvailable()) {
          const sendResult = await emailService.sendEmail({
            to: draftWithContext.worker?.email || '',
            subject: draftWithContext.draft.subject,
            html: draftWithContext.draft.body, // Already stored as HTML
            text: draftWithContext.draft.body.replace(/<[^>]*>/g, '') // Generate text version by stripping HTML
          });
          
          if (sendResult.success) {
            await emailDraftingService.updateDraftStatus(draftId, 'sent');
            
            res.json({
              success: true,
              message: 'Email approved and sent to worker',
              data: {
                messageId: sendResult.messageId,
                sentAt: new Date()
              }
            });
          } else {
            throw new Error(`Failed to send email: ${sendResult.error}`);
          }
        } else {
          // Email service not available - just mark as approved
          await storage.updateEmailDraft(draftId, {
            status: 'approved_no_email',
            forwardedToWorkerAt: new Date()
          });
          
          res.json({
            success: true,
            message: 'Email approved (email service unavailable - please send manually)',
            data: {
              draft: draftWithContext.draft,
              manualSendRequired: true
            }
          });
        }
        break;
        
      case 'edit':
        // Apply modifications and regenerate email content
        if (reviewData.modifications) {
          // Prepare regeneration request
          const regenerationRequest: any = {
            ticketId: draftWithContext.draft.ticketId,
            workerId: draftWithContext.draft.workerId,
            checkId: draftWithContext.draft.checkId,
            managerEmail: draftWithContext.draft.managerEmail,
          };
          
          // Apply modifications
          if (reviewData.modifications.customMessage) {
            regenerationRequest.customMessage = reviewData.modifications.customMessage;
          }
          if (reviewData.modifications.dueDate) {
            regenerationRequest.dueDate = reviewData.modifications.dueDate;
          }
          if (reviewData.modifications.companyInstructions) {
            regenerationRequest.companyInstructions = reviewData.modifications.companyInstructions;
          }
          if (reviewData.modifications.urgency) {
            regenerationRequest.urgency = reviewData.modifications.urgency;
          }
          
          // Regenerate email content
          const regeneratedDraft = await emailDraftingService.generateEmailDraft(regenerationRequest);
          
          // Update database with regenerated content
          const updatedData: any = {
            subject: reviewData.modifications.subject || regeneratedDraft.subject,
            body: regeneratedDraft.htmlBody,
            checkLink: regeneratedDraft.checkLink,
            expiresAt: regeneratedDraft.expiresAt,
            linkToken: regeneratedDraft.linkToken,
            status: 'edited'
          };
          
          await storage.updateEmailDraft(draftId, updatedData);
          
          // Get updated draft for response
          const updatedDraftContext = await emailDraftingService.getEmailDraftWithContext(draftId);
          
          res.json({
            success: true,
            message: 'Draft regenerated successfully with modifications',
            data: {
              draftId,
              action: 'edited',
              draft: updatedDraftContext.draft
            }
          });
        } else {
          res.status(400).json({
            error: 'No modifications provided for edit action'
          });
        }
        break;
        
      case 'reject':
        await storage.updateEmailDraft(draftId, {
          status: 'rejected',
          // Could store rejection reason in a notes field if needed
        });
        
        res.json({
          success: true,
          message: 'Draft rejected',
          data: {
            draftId,
            rejectionReason: reviewData.rejectionReason
          }
        });
        break;
        
      default:
        res.status(400).json({
          error: 'Invalid review action',
          validActions: ['approve', 'edit', 'reject']
        });
    }
    
  } catch (error) {
    console.error('Failed to review email draft:', error);
    res.status(500).json({
      error: 'Failed to review email draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/email-drafts/:draftId/resend
 * Resend email to worker (if they didn't receive it)
 */
router.post('/:draftId/resend', requireAuth, async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const draftWithContext = await emailDraftingService.getEmailDraftWithContext(draftId);
    
    if (draftWithContext.draft.status !== 'sent') {
      return res.status(400).json({
        error: 'Can only resend previously sent drafts'
      });
    }
    
    if (!emailService.isAvailable()) {
      return res.status(503).json({
        error: 'Email service is not available'
      });
    }
    
    const sendResult = await emailService.sendEmail({
      to: draftWithContext.worker?.email || '',
      subject: `[RESENT] ${draftWithContext.draft.subject}`,
      html: draftWithContext.draft.body,
      text: draftWithContext.draft.body.replace(/<[^>]*>/g, '')
    });
    
    if (sendResult.success) {
      // Log the resend activity - timestamp updated automatically
      
      res.json({
        success: true,
        message: 'Email resent successfully',
        data: {
          messageId: sendResult.messageId,
          resentAt: new Date()
        }
      });
    } else {
      throw new Error(`Failed to resend email: ${sendResult.error}`);
    }
    
  } catch (error) {
    console.error('Failed to resend email:', error);
    res.status(500).json({
      error: 'Failed to resend email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/email-drafts/:draftId/preview
 * Preview email content without sending
 */
router.get('/:draftId/preview', requireAuth, async (req, res) => {
  try {
    const { draftId } = req.params;
    const format = req.query.format as string || 'html';
    
    const draftWithContext = await emailDraftingService.getEmailDraftWithContext(draftId);
    
    if (format === 'text') {
      res.set('Content-Type', 'text/plain');
      res.send(draftWithContext.draft.body.replace(/<[^>]*>/g, ''));
    } else {
      res.set('Content-Type', 'text/html');
      res.send(draftWithContext.draft.body);
    }
    
  } catch (error) {
    console.error('Failed to preview email:', error);
    res.status(404).json({
      error: 'Email draft not found',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as emailDraftRoutes };
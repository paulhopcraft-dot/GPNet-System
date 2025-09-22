import express from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from './storage.js';
import michelleDialogueService, { DialogueContext, DialogueResponse } from './michelleDialogueService.js';

const router = express.Router();

// In-memory store for dialogue contexts (in production, use Redis or database)
const activeDialogues = new Map<string, DialogueContext>();

// Middleware to require authenticated user (consistent with system standards)
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.user?.id || !req.session?.isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// ===============================================
// MICHELLE DIALOGUE API ENDPOINTS
// ===============================================

/**
 * POST /api/michelle/start - Start a new dialogue session with Michelle
 */
router.post('/start', requireAuth, async (req, res) => {
  try {
    const managerId = req.session.user?.email || req.session.user?.id || 'unknown';
    
    // Start new dialogue
    const context = await michelleDialogueService.startDialogue(managerId);
    
    // Store dialogue context
    activeDialogues.set(context.conversationId, context);
    
    // Set auto-cleanup after 1 hour
    setTimeout(() => {
      activeDialogues.delete(context.conversationId);
    }, 60 * 60 * 1000);

    res.json({
      success: true,
      data: {
        conversationId: context.conversationId,
        message: context.conversationHistory[0].message,
        stage: context.stage,
        availableChecks: context.availableChecks
      }
    });
  } catch (error) {
    console.error('Failed to start Michelle dialogue:', error);
    res.status(500).json({
      error: 'Failed to start dialogue session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/michelle/message - Send a message to Michelle
 */
router.post('/message', requireAuth, async (req, res) => {
  try {
    const messageSchema = z.object({
      conversationId: z.string().min(1),
      message: z.string().min(1).max(1000),
    });

    const validationResult = messageSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid request data',
        details: errorMessage
      });
    }

    const { conversationId, message } = validationResult.data;
    
    // Get existing dialogue context
    const context = activeDialogues.get(conversationId);
    if (!context) {
      return res.status(404).json({
        error: 'Dialogue session not found',
        details: 'Session may have expired or been invalid'
      });
    }

    // Verify the dialogue belongs to the authenticated user
    const currentUserId = req.session.user?.email || req.session.user?.id || 'unknown';
    if (context.managerId !== currentUserId) {
      return res.status(403).json({
        error: 'Unauthorized access to dialogue session'
      });
    }

    // Process message with Michelle
    const response: DialogueResponse = await michelleDialogueService.processMessage(context, message);
    
    // Update stored context
    activeDialogues.set(conversationId, context);

    res.json({
      success: true,
      data: {
        conversationId,
        response: response.response,
        stage: response.stage,
        collectedData: response.collectedData,
        suggestedActions: response.suggestedActions,
        isComplete: response.isComplete,
        checkRequestReady: response.checkRequestReady,
        conversationHistory: context.conversationHistory.slice(-6) // Last 6 messages
      }
    });

  } catch (error) {
    console.error('Failed to process Michelle message:', error);
    res.status(500).json({
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/michelle/submit-request - Create check request from completed dialogue
 */
router.post('/submit-request', requireAuth, async (req, res) => {
  try {
    const requestSchema = z.object({
      conversationId: z.string().min(1),
    });

    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid request data',
        details: errorMessage
      });
    }

    const { conversationId } = validationResult.data;
    
    // Get dialogue context
    const context = activeDialogues.get(conversationId);
    if (!context) {
      return res.status(404).json({
        error: 'Dialogue session not found'
      });
    }

    // Verify ownership
    const currentUserId = req.session.user?.email || req.session.user?.id || 'unknown';
    if (context.managerId !== currentUserId) {
      return res.status(403).json({
        error: 'Unauthorized access to dialogue session'
      });
    }

    // Create check request from dialogue
    const requestData = await michelleDialogueService.createCheckRequestFromDialogue(context);
    
    // Find or create worker
    let worker = await storage.findWorkerByEmail(requestData.workerEmail);
    if (!worker) {
      worker = await storage.createWorker({
        firstName: requestData.workerFirstName,
        lastName: requestData.workerLastName,
        email: requestData.workerEmail,
        phone: '',
        dateOfBirth: '',
        roleApplied: 'TBD'
      });
    }

    // Create ticket for this check request
    const ticket = await storage.createTicket({
      workerId: worker.id,
      caseType: 'manager_initiated_check',
      status: 'NEW',
      priority: requestData.urgency
    });

    // Get the check configuration
    const check = await storage.getCheckByKey(requestData.checkKey);
    if (!check) {
      return res.status(404).json({
        error: 'Check type not found',
        details: `No check found with key: ${requestData.checkKey}`
      });
    }

    // Create check request record
    const checkRequest = await storage.createCheckRequest({
      ticketId: ticket.id,
      workerId: worker.id,
      checkId: check.id,
      requestedBy: context.managerId,
      requestReason: requestData.requestReason,
      urgency: requestData.urgency,
      dialogueContext: requestData.dialogueContext
    });

    // Create email draft for manager to review and send
    const emailDraft = await storage.createEmailDraft({
      ticketId: ticket.id,
      subject: `Health Check Required - ${check.displayName}`,
      body: generateEmailContent(worker, check, ticket),
      workerId: worker.id,
      checkId: check.id,
      checkLink: check.checkUrl,
      managerEmail: context.managerId,
      status: 'draft'
    });

    // Clean up dialogue session
    activeDialogues.delete(conversationId);

    res.json({
      success: true,
      message: 'Check request created successfully',
      data: {
        ticketId: ticket.id,
        checkRequestId: checkRequest.id,
        emailDraftId: emailDraft.id,
        worker: {
          name: `${worker.firstName} ${worker.lastName}`,
          email: worker.email
        },
        check: {
          name: check.displayName,
          type: check.checkKey,
          estimatedDays: 5
        }
      }
    });

  } catch (error) {
    console.error('Failed to submit check request:', error);
    res.status(500).json({
      error: 'Failed to create check request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/michelle/dialogue/:conversationId - Get dialogue status and history
 */
router.get('/dialogue/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const context = activeDialogues.get(conversationId);
    if (!context) {
      return res.status(404).json({
        error: 'Dialogue session not found'
      });
    }

    // Verify ownership
    const currentUserId = req.session.user?.email || req.session.user?.id || 'unknown';
    if (context.managerId !== currentUserId) {
      return res.status(403).json({
        error: 'Unauthorized access to dialogue session'
      });
    }

    res.json({
      success: true,
      data: {
        conversationId: context.conversationId,
        stage: context.stage,
        collectedData: context.collectedData,
        conversationHistory: context.conversationHistory,
        availableChecks: context.availableChecks,
        isComplete: context.stage === 'completed'
      }
    });

  } catch (error) {
    console.error('Failed to get dialogue status:', error);
    res.status(500).json({
      error: 'Failed to retrieve dialogue session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/michelle/dialogue/:conversationId - End dialogue session
 */
router.delete('/dialogue/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const context = activeDialogues.get(conversationId);
    if (!context) {
      return res.status(404).json({
        error: 'Dialogue session not found'
      });
    }

    // Verify ownership
    const currentUserId = req.session.user?.email || req.session.user?.id || 'unknown';
    if (context.managerId !== currentUserId) {
      return res.status(403).json({
        error: 'Unauthorized access to dialogue session'
      });
    }

    // Remove dialogue from memory
    activeDialogues.delete(conversationId);

    res.json({
      success: true,
      message: 'Dialogue session ended successfully'
    });

  } catch (error) {
    console.error('Failed to end dialogue session:', error);
    res.status(500).json({
      error: 'Failed to end dialogue session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate email content for health check requests
 */
function generateEmailContent(worker: any, check: any, ticket: any): string {
  return `
Dear ${worker.firstName} ${worker.lastName},

Your manager has requested that you complete a health check as part of our workplace health and safety requirements.

**Health Check Details:**
- Type: ${check.checkName}
- Estimated time to complete: ${check.estimatedCompletionDays} business days
- Case ID: ${ticket.id}

**Next Steps:**
1. Click the link below to access your health check form
2. Complete all required sections accurately
3. Submit any required medical documentation
4. You will receive confirmation once your submission is processed

**Access Your Health Check:**
[Complete Health Check Form](https://form.jotform.com/${check.jotformId}?ticketId=${ticket.id})

If you have any questions about this health check requirement, please contact your manager or the HR team.

Best regards,
GPNet Health Services Team

---
This is an automated message from the GPNet pre-employment health check system.
Reference: ${ticket.id}
  `.trim();
}

export { router as michelleRoutes };
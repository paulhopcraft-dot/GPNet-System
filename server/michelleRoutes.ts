import express from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from './storage.js';
import michelleDialogueService, { DialogueContext, DialogueResponse } from './michelleDialogueService.js';

const router = express.Router();

// In-memory store for dialogue contexts (in production, use Redis or database)
const activeDialogues = new Map<string, DialogueContext>();

// DEV-only auth bypass for development access
const requireAuth = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    // Set mock session for development
    req.session.user = req.session.user || {
      id: 'dev-user',
      email: 'dev@example.com',
      role: 'client',
      firstName: 'Development',
      lastName: 'User',
      organizationId: 'default-org'
    };
    req.session.isAuthenticated = true;
    return next();
  }
  
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

// Enhanced /chat endpoint with worker lookup and conversation modes
router.post('/chat', async (req, res) => {
  try {
    console.log('MICHELLE CHAT REQUEST:', req.body);
    const { conversationId, message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Initialize conversation context if needed
    const sessionConversationId = conversationId || `conv_${Date.now()}`;
    
    // Worker case lookup logic
    const workerNameMatch = message.match(/(?:tell me about|lookup|find|show me)\s+(.+?)(?:\s|$)/i);
    const nameMatch = message.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
    
    let reply = '';
    let nextQuestions = [];
    
    // Check for worker lookup request
    if (message.toLowerCase().includes('lookup') || message.toLowerCase().includes('find worker') || message.toLowerCase().includes('tell me about') || nameMatch) {
      const searchName = workerNameMatch?.[1] || nameMatch?.[1] || '';
      
      if (searchName) {
        try {
          // Search for workers by name
          const workers = await storage.findWorkersByName(searchName);
          
          if (workers && workers.length > 0) {
            const worker = workers[0];
            const cases = await storage.findCasesByWorkerId(worker.id);
            
            // Generate worker status report
            const latestCase = cases[0];
            const status = latestCase?.status || 'No active cases';
            
            reply = `**${worker.firstName} ${worker.lastName}**
            
**Current Status:** ${status}
**Email:** ${worker.email}
**Active Cases:** ${cases.length}

${latestCase ? `**Latest Case:** ${latestCase.caseType} (Priority: ${latestCase.priority})` : ''}

How can I help you with this worker's case?`;

            nextQuestions = [
              `Medical recommendations for ${worker.firstName}`,
              `Return to work plan for ${worker.firstName}`,
              `Risk assessment details`,
              `Contact the worker directly`
            ];
          } else {
            reply = `I couldn't find a worker named "${searchName}". Could you check the spelling or try searching by:
            
• Full name (first and last)
• Email address  
• Ticket number

What would you like to search for?`;
            nextQuestions = [
              'Show me all active cases',
              'List workers by status',
              'Search by email instead'
            ];
          }
        } catch (error) {
          reply = `Sorry, I encountered an error searching for "${searchName}". Please try again or contact support.`;
          nextQuestions = ['Try a different search', 'Show me all cases'];
        }
      } else {
        reply = "I can help you look up worker information. Please provide a worker's full name, email, or ticket number.";
        nextQuestions = [
          'Show me all active cases',
          'List injured workers',
          'Search by status'
        ];
      }
    }
    // Conversation mode switching
    else if (message.toLowerCase().includes('doctor mode') || message.toLowerCase().includes('medical')) {
      reply = `**🩺 DOCTOR MODE ACTIVATED**

I'm now providing medical perspectives and recommendations. I can help with:

• Clinical assessments and interpretations
• Medical fitness recommendations  
• Treatment plan reviews
• Occupational health guidance
• Return-to-work medical clearance

What medical question can I help you with?`;
      
      nextQuestions = [
        'Review fitness for duties',
        'Interpret medical certificates',
        'Assess injury severity',
        'Recommend treatment options'
      ];
    }
    else if (message.toLowerCase().includes('case manager') || message.toLowerCase().includes('admin')) {
      reply = `**📋 CASE MANAGER MODE ACTIVATED**

I'm now focused on case administration and follow-up processes. I can help with:

• Case status tracking and updates
• Follow-up scheduling and reminders
• Documentation requirements
• Escalation protocols
• Compliance monitoring

What case management task can I assist with?`;
      
      nextQuestions = [
        'Update case status',
        'Schedule follow-up',
        'Review documentation',
        'Escalate to supervisor'
      ];
    }
    else if (message.toLowerCase().includes('employer mode') || message.toLowerCase().includes('work duties')) {
      reply = `**🏢 EMPLOYER MODE ACTIVATED**

I'm now focusing on workplace considerations and return-to-work planning. I can help with:

• Job duty modifications and restrictions
• Workplace accommodation planning
• Return-to-work timelines
• Risk management strategies
• Productivity and safety considerations

What workplace question can I help you with?`;
      
      nextQuestions = [
        'Plan return to work',
        'Assess job modifications',
        'Review workplace risks',
        'Calculate productivity impact'
      ];
    }
    // Health and injury concerns
    else if (message.toLowerCase().includes('pain') || message.toLowerCase().includes('hurt') || message.toLowerCase().includes('injury')) {
      reply = `🚨 **HEALTH CONCERN FLAGGED**

I understand you're experiencing pain or injury. This is important and may require immediate attention.

**Immediate Actions:**
• Seek medical attention if severe
• Document the incident properly  
• Report to your supervisor
• Contact your case manager

Can you provide more details about:
• When did this occur?
• What type of pain/injury?
• Current severity level?`;

      nextQuestions = [
        'I need immediate medical help',
        'Report a workplace injury',
        'Update my existing case',
        'Speak to case manager'
      ];
    }
    // Mental health and coping
    else if (message.toLowerCase().includes('not coping') || message.toLowerCase().includes('stress') || message.toLowerCase().includes('mental')) {
      reply = `🧠 **MENTAL HEALTH SUPPORT**

Thank you for sharing this with me. Mental health is just as important as physical health.

**Immediate Support Available:**
• Employee Assistance Program (EAP)
• Mental health professionals
• Workplace counseling services
• Stress management resources

**I'm flagging this for priority follow-up.**

Would you like me to:`;

      nextQuestions = [
        'Connect me with EAP services',
        'Schedule mental health assessment',
        'Provide stress management resources',
        'Contact my case manager urgently'
      ];
    }
    // Default helpful responses
    else {
      const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
      const isGreeting = greetings.some(g => message.toLowerCase().includes(g));
      
      if (isGreeting) {
        reply = `Hello! I'm Michelle, your occupational health assistant. I can help you with:

**🔍 Worker Lookups:** Find cases by name or ID
**📋 Case Management:** Track status and follow-ups  
**🩺 Health Advice:** Medical and safety guidance
**🏢 Workplace Support:** Return-to-work planning

Try saying something like "tell me about John Smith" or "doctor mode" to get started.`;
      } else {
        reply = `I'm here to help with occupational health questions. I can:

• Look up worker cases by name
• Switch to Doctor, Case Manager, or Employer mode
• Provide health and safety guidance
• Help with return-to-work planning

What would you like assistance with?`;
      }
      
      nextQuestions = [
        'Look up a worker by name',
        'Switch to Doctor mode',
        'Show me case management options',
        'Help with workplace concerns'
      ];
    }
    
    console.log('MICHELLE RESPONSE:', { reply, nextQuestions, conversationId: sessionConversationId });
    
    res.json({
      reply,
      nextQuestions,
      conversationId: sessionConversationId
    });
  } catch (error) {
    console.error('Michelle chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Add mode and context endpoints for compatibility
router.get('/mode', async (req, res) => {
  res.json({ mode: 'client-scoped', accessLevel: 'client' });
});

router.get('/context', async (req, res) => {
  res.json({ 
    currentPage: 'dashboard',
    dialogueMode: 'standard',
    escalationAvailable: true 
  });
});

export { router as michelleRoutes };
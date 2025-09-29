import express from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from './storage.js';
import michelleDialogueService, { DialogueContext, DialogueResponse } from './michelleDialogueService.js';
import { chatWithMichelle } from './michelleService.js';

const router = express.Router();

// In-memory store for dialogue contexts (in production, use Redis or database)
const activeDialogues = new Map<string, DialogueContext>();

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.user?.id || !req.session?.isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * POST /api/michelle/chat - Direct chat endpoint for Michelle widget
 * SECURITY: Requires authentication for case-specific context access
 */
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const chatSchema = z.object({
      conversationId: z.string().optional(),
      message: z.string().min(1).max(1000),
      context: z.object({
        role: z.string().optional(),
        currentPage: z.string().optional(),
        caseId: z.string().optional(),
        workerName: z.string().optional(),
        checkType: z.string().optional()
      }).optional()
    });

    const validationResult = chatSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid request data',
        details: errorMessage
      });
    }

    const { conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, message, context } = validationResult.data;
    
    // SECURITY: Strip sensitive context fields if user is not authenticated properly
    let sanitizedContext = context;
    if (!req.session?.user?.id || !req.session?.isAuthenticated) {
      console.log('🔒 SECURITY: Stripping case-specific context for unauthenticated user');
      sanitizedContext = {
        ...context,
        caseId: undefined,
        workerName: undefined,
        checkType: undefined
      };
    }
    
    // Create user context
    const userContext = {
      userType: 'client' as const,
      isSuperuser: false,
      userId: req.session?.user?.id || 'anonymous-user',
      email: req.session?.user?.email || 'anonymous@example.com'
    };

    // Call Michelle chat service with sanitized context
    const response = await chatWithMichelle(conversationId, message, userContext, sanitizedContext);

    res.json({
      success: true,
      ...response
    });

  } catch (error) {
    console.error('Failed to process Michelle chat:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add compatibility endpoints
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
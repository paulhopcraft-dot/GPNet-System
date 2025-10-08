import { Router, type Request, type Response } from 'express';
import { storage } from './storage';
import { ruleEngine } from './ruleEngine';
import { xgboostService } from './xgboostService';
import { workerInfoSheetService } from './workerInfoSheetService';
import { requireAuth } from './authRoutes.js'; // CRITICAL: Authentication middleware
import { generateDemoFeedbackForAllOrgs, generateBulkDemoFeedback } from './demoFeedbackGenerator';

const router = Router();

// CRITICAL: All case console routes require authentication
router.use(requireAuth);

/**
 * GET /api/case-console/:ticketId/analysis
 * Get comprehensive case analysis (risk, status, next steps)
 */
router.get('/:ticketId/analysis', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    // CRITICAL: Pass organizationId to storage to prevent cross-tenant fetches
    const ticket = await storage.getTicket(ticketId, userOrgId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }

    // Run full analysis
    const analysis = await ruleEngine.analyzeFull(ticketId);
    
    // Get ML prediction if available
    let mlPrediction = null;
    try {
      mlPrediction = await xgboostService.predictRisk(ticketId);
    } catch (error) {
      console.error('ML prediction failed:', error);
    }

    // Get Worker Info Sheet status if exists
    let workerInfoSheetStatus = null;
    if (ticket.workerId) {
      try {
        const sheet = await storage.getWorkerInfoSheetByWorkerId(ticket.workerId, ticket.organizationId ?? undefined);
        if (sheet) {
          workerInfoSheetStatus = await workerInfoSheetService.getEscalationStatus(sheet.id);
        }
      } catch (error) {
        console.error('Worker Info Sheet status check failed:', error);
      }
    }

    res.json({
      ticketId,
      analysis: {
        risk: analysis.risk,
        status: analysis.status,
        nextSteps: analysis.nextSteps,
        analyzedAt: analysis.analyzedAt
      },
      mlPrediction,
      workerInfoSheetStatus,
      ticket: {
        id: ticket.id,
        caseType: ticket.caseType,
        workerId: ticket.workerId,
        status: ticket.status,
        riskLevel: ticket.riskLevel,
        currentStatus: ticket.currentStatus
      }
    });
  } catch (error) {
    console.error('Error getting case analysis:', error);
    res.status(500).json({ error: 'Failed to analyze case' });
  }
});

/**
 * POST /api/case-console/:ticketId/feedback
 * Submit feedback on AI suggestions for ML training
 */
router.post('/:ticketId/feedback', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    const { 
      feedbackType, 
      suggestionText, 
      betterActionText, 
      features,
      givenBy 
    } = req.body;

    if (!feedbackType || !suggestionText) {
      return res.status(400).json({ error: 'feedbackType and suggestionText are required' });
    }

    // CRITICAL: Pass organizationId to storage to prevent cross-tenant fetches
    const ticket = await storage.getTicket(ticketId, userOrgId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }

    // CRITICAL: Validate ticket has organization for ML feedback
    if (!ticket.organizationId) {
      return res.status(400).json({ error: 'Ticket has no organization - cannot record feedback' });
    }

    // Record feedback for ML training (with organizationId for multi-tenant isolation)
    const feedbackId = await xgboostService.recordFeedback({
      organizationId: ticket.organizationId, // CRITICAL: Multi-tenant partitioning
      ticketId,
      feedbackType,
      suggestionText,
      betterActionText,
      features: features || {},
      givenBy
    });

    res.json({
      success: true,
      feedbackId,
      message: 'Feedback recorded successfully'
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * POST /api/case-console/:ticketId/update-analysis
 * Update ticket with latest rule engine analysis
 */
router.post('/:ticketId/update-analysis', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    // CRITICAL: Pass organizationId to storage to prevent cross-tenant fetches
    const ticket = await storage.getTicket(ticketId, userOrgId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }

    // Update ticket with latest analysis
    const analysis = await ruleEngine.updateTicketWithAnalysis(ticketId);

    res.json({
      success: true,
      ticketId,
      analysis: {
        risk: analysis.risk,
        status: analysis.status,
        nextSteps: analysis.nextSteps
      }
    });
  } catch (error) {
    console.error('Error updating case analysis:', error);
    res.status(500).json({ error: 'Failed to update analysis' });
  }
});

/**
 * GET /api/case-console/:ticketId/worker-info-sheet
 * Get Worker Info Sheet status
 */
router.get('/:ticketId/worker-info-sheet', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    // CRITICAL: Pass organizationId to storage to prevent cross-tenant fetches
    const ticket = await storage.getTicket(ticketId, userOrgId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }

    if (!ticket.workerId) {
      return res.json({ hasSheet: false, message: 'No worker associated with ticket' });
    }

    const sheet = await storage.getWorkerInfoSheetByWorkerId(ticket.workerId, ticket.organizationId ?? undefined);
    
    if (!sheet) {
      return res.json({ hasSheet: false });
    }

    const escalationStatus = await workerInfoSheetService.getEscalationStatus(sheet.id);

    res.json({
      hasSheet: true,
      sheet: {
        id: sheet.id,
        status: sheet.status,
        requestedAt: sheet.requestedAt,
        returnedAt: sheet.returnedAt,
        escalationLevel: sheet.escalationLevel
      },
      escalationStatus
    });
  } catch (error) {
    console.error('Error getting Worker Info Sheet:', error);
    res.status(500).json({ error: 'Failed to get Worker Info Sheet status' });
  }
});

/**
 * POST /api/case-console/:ticketId/worker-info-sheet/request
 * Request Worker Info Sheet from employer
 */
router.post('/:ticketId/worker-info-sheet/request', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    // CRITICAL: Pass organizationId to storage to prevent cross-tenant fetches
    const ticket = await storage.getTicket(ticketId, userOrgId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }

    if (!ticket.workerId) {
      return res.status(400).json({ error: 'No worker associated with ticket' });
    }

    const sheet = await workerInfoSheetService.requestWorkerInfoSheet(ticketId, ticket.workerId);

    res.json({
      success: true,
      sheet: {
        id: sheet.id,
        status: sheet.status,
        requestedAt: sheet.requestedAt,
        escalationLevel: sheet.escalationLevel
      }
    });
  } catch (error) {
    console.error('Error requesting Worker Info Sheet:', error);
    res.status(500).json({ error: 'Failed to request Worker Info Sheet' });
  }
});

/**
 * POST /api/case-console/:ticketId/worker-info-sheet/:sheetId/mark-returned
 * Mark Worker Info Sheet as returned
 */
router.post('/:ticketId/worker-info-sheet/:sheetId/mark-returned', async (req: Request, res: Response) => {
  try {
    const { ticketId, sheetId } = req.params;
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    // CRITICAL: Pass organizationId to storage to prevent cross-tenant fetches
    const ticket = await storage.getTicket(ticketId, userOrgId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }
    
    const sheet = await workerInfoSheetService.markReturned(sheetId);

    res.json({
      success: true,
      sheet: {
        id: sheet.id,
        status: sheet.status,
        returnedAt: sheet.returnedAt
      }
    });
  } catch (error) {
    console.error('Error marking Worker Info Sheet as returned:', error);
    res.status(500).json({ error: 'Failed to mark sheet as returned' });
  }
});

/**
 * GET /api/case-console/training/status
 * Get ML training status and metrics
 */
router.get('/training/status', async (req: Request, res: Response) => {
  try {
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    const feedbackCount = (await storage.getAllCaseFeedback(userOrgId)).length;
    
    // Handle potential schema mismatch gracefully (expected for new installations)
    let latestRun = null;
    let allRuns: any[] = [];
    
    try {
      latestRun = await storage.getLatestModelTrainingRun(userOrgId);
      allRuns = await storage.getAllModelTrainingRuns(userOrgId);
    } catch (dbError: any) {
      console.warn('Database schema issue for model_training_runs (expected for new installations):', dbError.message);
      // Continue with empty training runs - this is expected for new setups
    }

    res.json({
      latestRun,
      totalRuns: allRuns.length,
      feedbackCount,
      canTrain: feedbackCount >= 50,
      allRuns: allRuns.slice(0, 10) // Last 10 runs
    });
  } catch (error) {
    console.error('Error getting training status:', error);
    res.status(500).json({ error: 'Failed to get training status' });
  }
});

/**
 * POST /api/case-console/training/start
 * Trigger ML model training
 */
router.post('/training/start', async (req: Request, res: Response) => {
  try {
    const userOrgId = req.session.user?.organizationId; // Authenticated user's organization
    
    // CRITICAL: Train model only on user's organization data
    const runId = await xgboostService.trainModel(userOrgId);

    res.json({
      success: true,
      runId,
      message: `Model training started for organization ${userOrgId}`
    });
  } catch (error) {
    console.error('Error starting model training:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to start training' 
    });
  }
});

/**
 * POST /api/case-console/training/demo-feedback
 * Generate demo feedback for testing (development only)
 * Admin users can specify organizationId, regular users use their session org
 */
router.post('/training/demo-feedback', async (req: Request, res: Response) => {
  try {
    const userOrgId = req.session.user?.organizationId;
    const { feedbackCount = 50, organizationId } = req.body;
    const userPermissions = req.session.user?.permissions || [];
    const userRole = req.session.user?.role;
    
    // Check if user is admin
    const isAdmin = userPermissions.includes('admin') || 
                    userPermissions.includes('superuser') ||
                    userRole === 'super_user';

    // Determine which organization to use
    let targetOrgId: string;
    
    if (organizationId && isAdmin) {
      // Admin can specify any organization
      targetOrgId = organizationId;
    } else if (userOrgId) {
      // Regular user uses their session org
      targetOrgId = userOrgId;
    } else {
      return res.status(400).json({ error: 'No organization ID available. Please specify organizationId in request body.' });
    }

    // Generate demo feedback for target organization
    const result = await generateBulkDemoFeedback(targetOrgId, 10, Math.ceil(feedbackCount / 10));

    res.json({
      success: true,
      ...result,
      organizationId: targetOrgId,
      message: `Generated ${result.totalFeedback} demo feedback entries for ${result.ticketsProcessed} tickets`
    });
  } catch (error) {
    console.error('Error generating demo feedback:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate demo feedback' 
    });
  }
});

/**
 * POST /api/case-console/training/demo-feedback-all
 * Generate demo feedback for all organizations (admin only)
 * CRITICAL: Admin/superuser permission check required
 */
router.post('/training/demo-feedback-all', async (req: Request, res: Response) => {
  try {
    const userPermissions = req.session.user?.permissions || [];
    const userRole = req.session.user?.role;
    
    // CRITICAL: Verify admin/superuser permission before cross-tenant operations
    const isAdmin = userPermissions.includes('admin') || 
                    userPermissions.includes('superuser') ||
                    userRole === 'super_user';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden: Admin or superuser permission required for cross-organization operations' 
      });
    }

    const { feedbackPerOrg = 50 } = req.body;

    // Generate demo feedback for all organizations (admin-only operation)
    const results = await generateDemoFeedbackForAllOrgs(feedbackPerOrg);

    res.json({
      success: true,
      results,
      totalOrganizations: Object.keys(results).length,
      message: `Generated demo feedback for ${Object.keys(results).length} organizations`
    });
  } catch (error) {
    console.error('Error generating demo feedback for all orgs:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate demo feedback' 
    });
  }
});

export default router;

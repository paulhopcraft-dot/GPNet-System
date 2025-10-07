import { Router, type Request, type Response } from 'express';
import { storage } from './storage';
import { ruleEngine } from './ruleEngine';
import { xgboostService } from './xgboostService';
import { workerInfoSheetService } from './workerInfoSheetService';

const router = Router();

/**
 * GET /api/case-console/:ticketId/analysis
 * Get comprehensive case analysis (risk, status, next steps)
 */
router.get('/:ticketId/analysis', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
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
        const sheet = await storage.getWorkerInfoSheetByWorkerId(ticket.workerId);
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

    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Record feedback for ML training
    const feedbackId = await xgboostService.recordFeedback({
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
    
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
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
    
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!ticket.workerId) {
      return res.json({ hasSheet: false, message: 'No worker associated with ticket' });
    }

    const sheet = await storage.getWorkerInfoSheetByWorkerId(ticket.workerId);
    
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
    
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
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
    const { sheetId } = req.params;
    
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
    const latestRun = await storage.getLatestModelTrainingRun();
    const allRuns = await storage.getAllModelTrainingRuns();
    const feedbackCount = (await storage.getAllCaseFeedback()).length;

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
    const runId = await xgboostService.trainModel();

    res.json({
      success: true,
      runId,
      message: 'Model training started'
    });
  } catch (error) {
    console.error('Error starting model training:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to start training' 
    });
  }
});

export default router;

import { Router } from 'express';
import { nextStepService } from './nextStepService';
import { requireAuth } from './authRoutes';
import { z } from 'zod';

const router = Router();

/**
 * Analyze and update next step for a specific ticket
 */
router.post('/analyze/:ticketId', requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { fdId } = req.body;

    console.log(`Analyzing next step for ticket ${ticketId}...`);
    
    const analysis = await nextStepService.analyzeAndUpdateNextStep(ticketId, fdId);
    
    if (!analysis) {
      return res.status(503).json({ 
        error: 'Analysis unavailable',
        message: 'Unable to analyze next step at this time. Please try again later.'
      });
    }

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Next step analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed',
      message: 'An error occurred while analyzing the case. Please try again.'
    });
  }
});

/**
 * Batch analyze all pending cases
 */
router.post('/analyze-all', requireAuth, async (req, res) => {
  try {
    // Check if user has admin permissions
    const user = (req as any).user;
    if (!user?.permissions?.includes('admin') && !user?.permissions?.includes('superuser')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('Starting batch analysis of all pending cases...');
    
    // Run in background
    nextStepService.analyzeAllPendingCases().catch(err => {
      console.error('Batch analysis failed:', err);
    });

    res.json({
      success: true,
      message: 'Batch analysis started in background'
    });
  } catch (error) {
    console.error('Batch analysis trigger error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get next step analysis without updating the ticket
 */
router.get('/preview/:ticketId', requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const fdId = req.query.fdId ? parseInt(req.query.fdId as string) : undefined;

    const { storage } = await import('./storage');
    
    // Get ticket with error handling
    let ticket;
    try {
      ticket = await storage.getTicket(ticketId);
    } catch (dbError) {
      console.error('Database error fetching ticket:', dbError);
      return res.status(503).json({ 
        error: 'Database unavailable',
        message: 'Unable to fetch ticket information. Please try again later.'
      });
    }
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      currentNextStep: ticket.nextStep,
      lastStep: ticket.lastStep,
      status: ticket.status
    });
  } catch (error) {
    console.error('Next step preview error:', error);
    res.status(500).json({ 
      error: 'Preview failed',
      message: 'Unable to retrieve case information. Please try again.'
    });
  }
});

export { router as nextStepRoutes };

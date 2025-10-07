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

/**
 * Get comprehensive case summary for analysis dialog
 */
router.get('/summary/:ticketId', requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { fdId } = req.query;

    const { storage } = await import('./storage');
    const { db } = await import('./db');
    const { medicalDocuments, events } = await import('@shared/schema');
    const { eq, desc, and } = await import('drizzle-orm');
    
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

    // Get latest medical certificate
    let latestCertificate = null;
    try {
      const certs = await db
        .select()
        .from(medicalDocuments)
        .where(and(
          eq(medicalDocuments.ticketId, ticketId),
          eq(medicalDocuments.kind, 'medical_certificate')
        ))
        .orderBy(desc(medicalDocuments.validTo))
        .limit(1);
      
      if (certs.length > 0) {
        const cert = certs[0];
        latestCertificate = {
          status: cert.fitStatus || 'Active',
          expiryDate: cert.validTo || new Date().toISOString(),
          issuedBy: cert.doctorName || cert.clinicName || 'Unknown'
        };
      }
    } catch (error) {
      console.error('Error fetching medical certificates:', error);
    }

    // Get recent steps from events
    let recentSteps: Array<{step: string, completedAt: string}> = [];
    try {
      const stepEvents = await db
        .select()
        .from(events)
        .where(eq(events.caseId, ticketId))
        .orderBy(desc(events.occurredAt))
        .limit(3);
      
      recentSteps = stepEvents.map(e => ({
        step: (e.payloadJson as any)?.description || e.kind || 'Event',
        completedAt: e.occurredAt?.toISOString() || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error fetching step history:', error);
    }

    // Perform AI analysis to get suggested next step
    const analysis = await nextStepService.analyzeAndUpdateNextStep(
      ticketId, 
      fdId ? parseInt(fdId as string) : ticket.fdId ?? undefined
    );

    // Get worker name if available
    let workerName = 'Unknown';
    if (ticket.workerId) {
      try {
        const { workers } = await import('@shared/schema');
        const workerResult = await db
          .select()
          .from(workers)
          .where(eq(workers.id, ticket.workerId))
          .limit(1);
        if (workerResult.length > 0) {
          const worker = workerResult[0];
          workerName = `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Unknown';
        }
      } catch (error) {
        console.error('Error fetching worker:', error);
      }
    }

    const summary = {
      ticketId: ticket.id,
      caseType: ticket.caseType,
      workerName,
      company: ticket.companyName || 'Unknown',
      dateOfInjury: undefined, // Will be populated if available in worker data
      injuryStatus: undefined, // Will be populated if available
      latestCertificate,
      recentSteps,
      suggestedNextStep: {
        action: analysis?.nextStep || ticket.nextStep || 'Review case',
        assignedTo: analysis?.assignedTo || ticket.assignedOwner,
        dueDate: ticket.slaDueAt?.toISOString(),
        priority: analysis?.priority || ticket.priority || 'medium',
        urgency: analysis?.urgency || 'routine',
        reasoning: analysis?.reasoning || 'Based on current case status'
      },
      currentStatus: ticket.status
    };

    res.json(summary);
  } catch (error) {
    console.error('Case summary error:', error);
    res.status(500).json({ 
      error: 'Summary failed',
      message: 'Unable to generate case summary. Please try again.'
    });
  }
});

export { router as nextStepRoutes };

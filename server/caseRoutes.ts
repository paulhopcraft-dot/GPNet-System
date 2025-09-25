import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage.js';
import { requireAuth } from './authRoutes.js';

const router = Router();

// Validation schemas
const UpdateStatusSchema = z.object({
  status: z.string().min(1)
});

const UpdateRecommendationsSchema = z.object({
  recommendations: z.array(z.string())
});

const UpdateRiskLevelSchema = z.object({
  ragScore: z.enum(['green', 'amber', 'red'])
});

/**
 * GET /api/cases
 * Retrieve list of cases for the dashboard
 */
router.get('/', async (req, res) => {
  try {
    console.log('Fetching cases for dashboard');
    
    // For demo purposes, get all tickets regardless of organization
    // In production, this would be filtered by user's organization
    const tickets = await storage.getAllTickets();
    
    // Transform tickets to dashboard case format
    const cases = await Promise.all(tickets.map(async (ticket) => {
      // Get worker info
      const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
      
      // Get analysis for RAG score and fit classification
      const analysis = await storage.getAnalysisByTicket(ticket.id);
      
      // Get form submission for additional context
      const formSubmission = await storage.getFormSubmissionByTicket(ticket.id);
      
      return {
        ticketId: ticket.id,
        caseType: ticket.caseType || 'pre_employment',
        claimType: ticket.claimType,
        priority: ticket.priority || 'medium',
        status: ticket.status,
        createdAt: ticket.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: ticket.updatedAt?.toISOString(),
        workerName: worker ? `${worker.firstName} ${worker.lastName}` : 'Unknown Worker',
        email: worker?.email || '',
        phone: worker?.phone || '',
        roleApplied: worker?.roleApplied || '',
        company: ticket.companyName || 'Unknown Company',
        ragScore: analysis?.ragScore || 'green',
        fitClassification: analysis?.fitClassification || 'pending',
        recommendations: analysis?.recommendations ? 
          (Array.isArray(analysis.recommendations) ? analysis.recommendations : [analysis.recommendations]) : [],
        notes: analysis?.notes || '',
        nextStep: ticket.nextStep,
        lastStep: ticket.lastStep,
        lastStepCompletedAt: ticket.lastStepCompletedAt?.toISOString(),
        assignedTo: ticket.assignedTo,
        formData: formSubmission?.rawData || null
      };
    }));

    res.json({
      cases,
      total: cases.length,
      success: true
    });

  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cases/:ticketId
 * Retrieve specific case details for the modal
 */
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    console.log('Fetching case details for:', ticketId);

    // Get ticket
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Check user has access to this ticket's organization (unless admin)
    const userOrgId = req.session.user?.organizationId;
    if (process.env.NODE_ENV !== 'development' && ticket.organizationId !== userOrgId && !req.session.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get worker info
    const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
    
    // Get analysis
    const analysis = await storage.getAnalysisByTicket(ticketId);
    
    // Get form submission
    const formSubmission = await storage.getFormSubmissionByTicket(ticketId);

    const caseDetails = {
      ticketId: ticket.id,
      caseType: ticket.caseType || 'pre_employment',
      claimType: ticket.claimType,
      status: ticket.status,
      createdAt: new Date(ticket.createdAt || Date.now()),
      workerName: worker ? `${worker.firstName} ${worker.lastName}` : 'Unknown Worker',
      email: worker?.email || '',
      phone: worker?.phone || '',
      roleApplied: worker?.roleApplied || '',
      company: ticket.companyName || 'Unknown Company',
      ragScore: analysis?.ragScore || 'green',
      fitClassification: analysis?.fitClassification || 'pending',
      recommendations: analysis?.recommendations ? 
        (Array.isArray(analysis.recommendations) ? analysis.recommendations : [analysis.recommendations]) : [],
      notes: analysis?.notes || '',
      assignedTo: ticket.assignedTo,
      nextStep: ticket.nextStep,
      lastStep: ticket.lastStep,
      lastStepCompletedAt: ticket.lastStepCompletedAt,
      formData: formSubmission?.rawData || null
    };

    res.json(caseDetails);

  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch case details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/cases/:ticketId/status
 * Update case status
 */
router.put('/:ticketId/status', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = UpdateStatusSchema.parse(req.body);

    console.log('Updating case status:', ticketId, status);

    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Check organization access for security
    const userOrgId = req.session.user?.organizationId;
    if (process.env.NODE_ENV !== 'development' && ticket.organizationId !== userOrgId && !req.session.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update ticket status
    await storage.updateTicketStatus(ticketId, status);

    res.json({ 
      success: true, 
      message: 'Status updated successfully',
      ticketId,
      newStatus: status
    });

  } catch (error) {
    console.error('Error updating case status:', error);
    res.status(500).json({ 
      error: 'Failed to update status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/cases/:ticketId/recommendations
 * Update case recommendations
 */
router.put('/:ticketId/recommendations', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { recommendations } = UpdateRecommendationsSchema.parse(req.body);

    console.log('Updating case recommendations:', ticketId, recommendations.length);
    
    // Check organization access for security
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const userOrgId = req.session.user?.organizationId;
    if (process.env.NODE_ENV !== 'development' && ticket.organizationId !== userOrgId && !req.session.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get or create analysis
    let analysis = await storage.getAnalysisByTicket(ticketId);
    if (!analysis) {
      // Create new analysis if none exists
      analysis = await storage.createAnalysis({
        ticketId,
        recommendations,
        ragScore: 'green',
        fitClassification: 'pending',
        notes: ''
      });
    } else {
      // Update existing analysis
      await storage.updateAnalysis(ticketId, { recommendations });
    }

    res.json({ 
      success: true, 
      message: 'Recommendations updated successfully',
      ticketId,
      recommendations
    });

  } catch (error) {
    console.error('Error updating recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to update recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/cases/:ticketId/risk-level
 * Update case risk level (RAG score)
 */
router.put('/:ticketId/risk-level', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { ragScore } = UpdateRiskLevelSchema.parse(req.body);

    console.log('Updating case risk level:', ticketId, ragScore);
    
    // Check organization access for security
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const userOrgId = req.session.user?.organizationId;
    if (process.env.NODE_ENV !== 'development' && ticket.organizationId !== userOrgId && !req.session.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get or create analysis
    let analysis = await storage.getAnalysisByTicket(ticketId);
    if (!analysis) {
      // Create new analysis if none exists
      analysis = await storage.createAnalysis({
        ticketId,
        ragScore,
        fitClassification: 'pending',
        recommendations: [],
        notes: ''
      });
    } else {
      // Update existing analysis
      await storage.updateAnalysis(ticketId, { ragScore });
    }

    res.json({ 
      success: true, 
      message: 'Risk level updated successfully',
      ticketId,
      ragScore
    });

  } catch (error) {
    console.error('Error updating risk level:', error);
    res.status(500).json({ 
      error: 'Failed to update risk level',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as caseRoutes };
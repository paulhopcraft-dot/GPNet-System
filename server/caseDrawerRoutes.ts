import { Router } from 'express';
import { storage } from './storage.js';

const router = Router();

// GET /api/case-drawer/:ticketId - Get all case drawer data
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const [ticket, worker, analysis, emails] = await Promise.all([
      storage.getTicket(ticketId),
      storage.getTicket(ticketId).then(t => t?.workerId ? storage.getWorker(t.workerId) : null),
      storage.getAnalysisByTicket(ticketId),
      storage.getEmailsByTicket(ticketId)
    ]);

    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Mock restrictions for now
    const restrictions = {
      physical: ticket.caseType === 'injury' ? ['No lifting > 15kg', 'No repetitive bending'] : [],
      functional: ticket.caseType === 'injury' ? ['Max 6hr shifts', 'Frequent breaks required'] : [],
      mentalHealth: []
    };

    // Mock treatment plan
    const treatmentPlan = ticket.caseType === 'injury' ? [
      { type: 'GP', name: 'Dr. Smith', frequency: 'Weekly', nextAppt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
      { type: 'Physio', name: 'ABC Physio', frequency: '2x/week', nextAppt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }
    ] : [];

    // Mock timeline from emails and events
    const timeline = [
      ...(emails || []).map(e => ({
        timestamp: e.sentAt,
        source: 'email',
        summary: e.subject,
        details: { emailId: e.id }
      })),
      {
        timestamp: ticket.createdAt,
        source: 'system',
        summary: `Case created - ${ticket.caseType} check`,
        details: {}
      }
    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 20);

    // Next steps
    const nextSteps = [
      { id: '1', action: ticket.nextStep || 'Review case details', priority: 'high', done: false },
      { id: '2', action: 'Request medical certificate', priority: 'medium', done: false },
      { id: '3', action: 'Contact employer', priority: 'medium', done: false }
    ];

    res.json({
      caseId: ticketId,
      worker: worker ? {
        name: `${worker.firstName} ${worker.lastName}`,
        dob: worker.dateOfBirth,
        phone: worker.phone,
        email: worker.email
      } : null,
      employer: { name: ticket.companyName || 'Unknown', site: worker?.site },
      role: worker?.roleApplied,
      status: {
        work: ticket.status,
        risk: analysis?.ragScore || 'green',
        certificate: { from: null, to: null }
      },
      diagnosis: 'Not specified',
      dateOfInjury: ticket.createdAt,
      restrictions,
      treatmentPlan,
      timeline,
      nextSteps,
      predictions: {
        claimProgressionProb: 0.35,
        healingEtaDays: 21
      },
      emailsCount: emails?.length || 0,
      reportsCount: 0
    });
  } catch (error) {
    console.error('Error fetching case drawer data:', error);
    res.status(500).json({ error: 'Failed to fetch case data' });
  }
});

export { router as caseDrawerRoutes };

import { Router } from 'express';
import { storage } from './storage.js';
import { requireAuth } from './authRoutes.js';

const router = Router();

// GET /api/case-drawer/:ticketId - Get all case drawer data
router.get('/:ticketId', requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [worker, analysis, dbEmails] = await Promise.all([
      ticket.workerId ? storage.getWorker(ticket.workerId) : null,
      storage.getAnalysisByTicket(ticketId),
      storage.getEmailsByTicket(ticketId)
    ]);

    // Use only real emails from database
    const emails = dbEmails.map(e => ({
      id: e.id,
      subject: e.subject || 'No subject',
      sentAt: e.sentAt,
      from: e.senderEmail || e.senderName || 'Unknown',
      to: worker?.email || 'Unknown',
      body: e.body || ''
    }));

    // Restrictions from database (empty for now, will be populated by Freshdesk sync)
    const restrictions = {
      physical: [],
      functional: [],
      mentalHealth: []
    };

    // Treatment plan from database (empty for now, will be populated by Freshdesk sync)
    const treatmentPlan: any[] = [];

    // Timeline from real emails only
    const timeline = [
      ...emails.map(e => ({
        timestamp: e.sentAt,
        source: 'email',
        summary: e.subject,
        details: { emailId: e.id, from: e.from, to: e.to }
      })),
      {
        timestamp: ticket.createdAt,
        source: 'system',
        summary: `Case created - ${ticket.caseType} check`,
        details: { caseType: ticket.caseType, status: 'NEW' }
      }
    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    // Next steps from ticket data
    const nextSteps = [
      { id: '1', action: ticket.nextStep || 'Review case details', priority: 'high', done: false }
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
      emails,
      emailsCount: emails?.length || 0,
      reportsCount: 0
    });
  } catch (error) {
    console.error('Error fetching case drawer data:', error);
    res.status(500).json({ error: 'Failed to fetch case data' });
  }
});

export { router as caseDrawerRoutes };

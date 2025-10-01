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

    // Use real emails from database, or fallback to mock emails for demo if none exist
    const emails: any[] = dbEmails.length > 0 ? dbEmails.map(e => ({
      id: e.id,
      subject: e.subject || 'No subject',
      sentAt: e.sentAt,
      from: e.senderEmail || e.senderName || 'Unknown',
      to: worker?.email || 'Unknown',
      body: e.body || ''
    })) : (ticket.caseType === 'injury' ? [
      {
        id: 'email-1',
        subject: 'Pre-employment check submission received',
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        from: 'system@gpnet.au',
        to: worker?.email,
        body: 'Your pre-employment health check has been received and is under review.'
      },
      {
        id: 'email-2',
        subject: 'Additional information required',
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        from: 'support@gpnet.au',
        to: worker?.email,
        body: 'Please provide your medical certificate for the lower back injury.'
      },
      {
        id: 'email-3',
        subject: 'Medical certificate received',
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        from: worker?.email || 'worker@example.com',
        to: 'support@gpnet.au',
        body: 'Certificate attached from Dr. Smith.'
      },
      {
        id: 'email-4',
        subject: 'Case update - Restrictions identified',
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        from: 'support@gpnet.au',
        to: ticket.companyName || 'employer@example.com',
        body: 'Worker cleared with restrictions. Treatment plan in progress.'
      }
    ] : []);

    // Mock restrictions - comprehensive for injury cases
    const restrictions = {
      physical: ticket.caseType === 'injury' ? [
        'No lifting > 15kg',
        'No repetitive bending or twisting',
        'No prolonged standing > 2hrs without breaks',
        'Avoid overhead reaching'
      ] : [],
      functional: ticket.caseType === 'injury' ? [
        'Max 6hr shifts initially, progressing to 8hrs over 3 weeks',
        'Frequent breaks required (10min every hour)',
        'Modified duties - light tasks only for first 2 weeks',
        'Gradual return to full duties as tolerated'
      ] : [],
      mentalHealth: ticket.caseType === 'injury' ? [
        'Regular check-ins with supervisor recommended',
        'Access to EAP services if needed for adjustment support'
      ] : []
    };

    // Mock treatment plan - comprehensive with multiple providers
    const treatmentPlan = ticket.caseType === 'injury' ? [
      { 
        type: 'GP', 
        name: 'Dr. Sarah Smith', 
        frequency: 'Weekly reviews', 
        nextAppt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        contact: '(03) 9876 5432',
        notes: 'Monitoring pain management and work capacity'
      },
      { 
        type: 'Physiotherapist', 
        name: 'ABC Physio - James Chen', 
        frequency: '2x per week', 
        nextAppt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        contact: '(03) 9876 1234',
        notes: 'Core strengthening and mobility exercises'
      },
      { 
        type: 'Occupational Therapist', 
        name: 'WorkSafe Rehab Services', 
        frequency: 'Fortnightly', 
        nextAppt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        contact: '(03) 9876 7890',
        notes: 'Workplace ergonomic assessment and modifications'
      }
    ] : [];

    // Mock timeline from emails and events - rich history
    const timeline = [
      ...(emails || []).map(e => ({
        timestamp: e.sentAt,
        source: 'email',
        summary: e.subject,
        details: { emailId: e.id, from: e.from, to: e.to }
      })),
      ...(ticket.caseType === 'injury' ? [
        {
          timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'system',
          summary: 'Medical certificate uploaded',
          details: { documentType: 'Medical Certificate', provider: 'Dr. Sarah Smith' }
        },
        {
          timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'analysis',
          summary: 'RAG analysis completed - AMBER risk identified',
          details: { score: 'amber', liftingCapacity: '10kg', musculoskeletalRisk: 'moderate' }
        },
        {
          timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'system',
          summary: 'Restrictions documented',
          details: { physicalRestrictions: 4, functionalRestrictions: 4 }
        },
        {
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'system',
          summary: 'Treatment plan established',
          details: { providers: 3, frequency: 'Multiple weekly sessions' }
        },
        {
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'system',
          summary: 'Case reviewed by case manager',
          details: { reviewer: 'Natalie Support', outcome: 'Fit with restrictions' }
        }
      ] : []),
      {
        timestamp: ticket.createdAt,
        source: 'system',
        summary: `Case created - ${ticket.caseType} check`,
        details: { caseType: ticket.caseType, status: 'NEW' }
      }
    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 20);

    // Next steps - comprehensive action items
    const nextSteps = ticket.caseType === 'injury' ? [
      { id: '1', action: 'Review updated medical certificate (due in 2 weeks)', priority: 'high', done: false },
      { id: '2', action: 'Schedule 2-week progress review with GP', priority: 'high', done: false },
      { id: '3', action: 'Confirm workplace modifications with employer', priority: 'medium', done: false },
      { id: '4', action: 'Send fit-with-restrictions report to employer', priority: 'medium', done: true },
      { id: '5', action: 'Monitor compliance with treatment plan', priority: 'medium', done: false },
      { id: '6', action: 'Check-in call with worker in 1 week', priority: 'low', done: false }
    ] : [
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

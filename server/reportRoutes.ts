import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { tickets, workers, formSubmissions, analyses, injuries, rtwPlans, stakeholders, externalEmails, emailAttachments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { pdfService } from './pdfService';
import { requireAuth } from './authRoutes';

const router = Router();

router.get('/:ticketId/types', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId)
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const reportTypes: string[] = [];

    if (ticket.caseType === 'PRE_EMPLOYMENT') {
      reportTypes.push('pre-employment');
    }

    if (ticket.caseType === 'INJURY' || ticket.caseType === 'RTW') {
      reportTypes.push('injury-report');
    }

    reportTypes.push('case-summary');
    reportTypes.push('compliance-audit');

    res.json({ reportTypes });
  } catch (error) {
    console.error('Error getting report types:', error);
    res.status(500).json({ error: 'Failed to get available report types' });
  }
});

router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ticketId, reportType, options = {} } = req.body;

    if (!ticketId || !reportType) {
      return res.status(400).json({ error: 'Missing ticketId or reportType' });
    }

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId)
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const worker = ticket.workerId
      ? await db.query.workers.findFirst({
          where: eq(workers.id, ticket.workerId)
        })
      : null;

    const formSubmission = await db.query.formSubmissions.findFirst({
      where: eq(formSubmissions.ticketId, ticketId)
    });

    const analysis = await db.query.analyses.findFirst({
      where: eq(analyses.ticketId, ticketId)
    });

    const injury = await db.query.injuries.findFirst({
      where: eq(injuries.ticketId, ticketId)
    });

    const rtwPlan = await db.query.rtwPlans.findFirst({
      where: eq(rtwPlans.ticketId, ticketId)
    });

    const stakeholdersList = await db.query.stakeholders.findMany({
      where: eq(stakeholders.ticketId, ticketId)
    });

    const emails = await db.query.externalEmails.findMany({
      where: eq(externalEmails.ticketId, ticketId)
    });

    const attachments = await db.query.emailAttachments.findMany({
      where: eq(emailAttachments.ticketId, ticketId)
    });

    const generatedAt = new Date().toISOString();
    const generatedBy = (req as any).session?.user?.name || 'System';

    let pdfBuffer: Buffer;

    switch (reportType) {
      case 'pre-employment':
        if (!formSubmission || !analysis) {
          return res.status(400).json({ error: 'Pre-employment report requires form submission and analysis' });
        }
        pdfBuffer = await pdfService.generatePreEmploymentReport(
          {
            ticket,
            worker,
            analysis,
            formSubmission,
            generatedAt,
            generatedBy,
            companyName: ticket.organizationId || 'Organization',
            recommendations: []
          },
          options
        );
        break;

      case 'injury-report':
        if (!injury) {
          return res.status(400).json({ error: 'Injury report requires injury data' });
        }
        pdfBuffer = await pdfService.generateInjuryReport(
          {
            ticket,
            worker,
            injury,
            formSubmission,
            analysis,
            stakeholders: stakeholdersList,
            rtwPlan,
            generatedAt,
            generatedBy
          },
          options
        );
        break;

      case 'case-summary':
        pdfBuffer = await pdfService.generateCaseSummaryReport(
          {
            ticket,
            worker,
            analysis,
            formSubmission,
            injury,
            rtwPlan,
            stakeholders: stakeholdersList,
            emails,
            attachments,
            generatedAt,
            generatedBy
          },
          options
        );
        break;

      case 'compliance-audit':
        pdfBuffer = await pdfService.generateComplianceAuditReport(
          {
            ticket,
            worker,
            auditTrail: [],
            workflowSteps: [],
            participationEvents: [],
            generatedLetters: [],
            generatedAt,
            generatedBy
          },
          options
        );
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    const filename = `${reportType}-${ticketId}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export const reportRoutes = router;

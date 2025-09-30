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

// Helper functions for enhanced case detail analysis
function determineWorkStatus(ticket: any, analysis: any, formData: any): 'at_work' | 'partial_duties' | 'off_work' | 'unknown' {
  // Check form data for work status indicators
  if (formData) {
    if (formData.currentlyWorking === true || formData.backAtWork === true) {
      return 'at_work';
    }
    if (formData.suitableDuties === true || formData.lightDuties === true) {
      return 'partial_duties';
    }
    if (formData.offWork === true || formData.unableToWork === true) {
      return 'off_work';
    }
  }
  
  // Check ticket status
  if (ticket.status === 'COMPLETE' && analysis?.fitClassification === 'fit') {
    return 'at_work';
  }
  if (ticket.status === 'COMPLETE' && analysis?.fitClassification === 'fit_with_restrictions') {
    return 'partial_duties';
  }
  if (analysis?.fitClassification === 'not_fit') {
    return 'off_work';
  }
  
  return 'unknown';
}

function interpretRAGStatus(ragScore: string, workStatus: string): { 
  status: string; 
  description: string; 
  workStatusText: string;
  riskLevel: string;
} {
  const interpretations = {
    green: {
      status: 'Green - Smooth Progress',
      description: 'Case is progressing well with minimal complications',
      riskLevel: 'low'
    },
    amber: {
      status: 'Amber - Some Hiccups',
      description: 'Case has some challenges but is manageable',
      riskLevel: 'medium'
    },
    red: {
      status: 'Red - Complex/Critical',
      description: 'Case requires urgent attention or has significant barriers',
      riskLevel: 'high'
    }
  };
  
  const workStatusTexts = {
    at_work: 'Worker is currently at work',
    partial_duties: 'Worker on suitable/light duties',
    off_work: 'Worker is off work',
    unknown: 'Work status unclear'
  };
  
  const base = interpretations[ragScore as keyof typeof interpretations] || interpretations.green;
  
  return {
    ...base,
    workStatusText: workStatusTexts[workStatus as keyof typeof workStatusTexts] || workStatusTexts.unknown
  };
}

function generateNextSteps(ticket: any, analysis: any, medicalCertificates: any[], workStatus: string): string[] {
  const steps: string[] = [];
  
  // Standard next step from ticket
  if (ticket.nextStep) {
    steps.push(ticket.nextStep);
  }
  
  // Medical certificate expiry checks
  medicalCertificates.forEach((cert: any) => {
    if (cert.expiresAt) {
      const expiryDate = new Date(cert.expiresAt);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        steps.push(`Medical certificate expires in ${daysUntilExpiry} days - request renewal`);
      } else if (daysUntilExpiry <= 0) {
        steps.push(`Medical certificate has expired - urgent renewal required`);
      }
    }
  });
  
  // Work status-based recommendations
  if (workStatus === 'off_work') {
    steps.push('Monitor worker engagement and return-to-work planning');
    if (ticket.caseType === 'injury') {
      steps.push('Schedule progress review with medical provider');
    }
  } else if (workStatus === 'partial_duties') {
    steps.push('Review accommodation effectiveness and duration');
    steps.push('Plan progression to full duties when appropriate');
  }
  
  // RAG-based recommendations
  if (analysis?.ragScore === 'red') {
    steps.push('Escalate to senior case manager for review');
    steps.push('Consider Michelle AI consultation for complex case guidance');
  } else if (analysis?.ragScore === 'amber') {
    steps.push('Monitor closely for improvement or deterioration');
  }
  
  // WorkCover specific steps
  if (ticket.claimType === 'workcover' || ticket.caseType === 'injury') {
    steps.push('Ensure WorkCover compliance and documentation');
    if (ticket.nextDeadlineDate) {
      steps.push(`Critical deadline: ${ticket.nextDeadlineType} due ${ticket.nextDeadlineDate}`);
    }
  }
  
  // Default steps if none generated
  if (steps.length === 0) {
    steps.push('Case monitoring and standard follow-up procedures');
  }
  
  return steps;
}

function checkUrgencyFlags(ticket: any, analysis: any, medicalCertificates: any[]): boolean {
  // Red RAG score indicates urgency
  if (analysis?.ragScore === 'red') {
    return true;
  }
  
  // Expired medical certificates
  const hasExpiredCerts = medicalCertificates.some((cert: any) => {
    if (!cert.expiresAt) return false;
    return new Date(cert.expiresAt) < new Date();
  });
  
  if (hasExpiredCerts) {
    return true;
  }
  
  // WorkCover deadlines
  if (ticket.nextDeadlineDate) {
    const deadline = new Date(ticket.nextDeadlineDate);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDeadline <= 3) {
      return true;
    }
  }
  
  // Case age for certain types
  const caseAge = Math.floor((Date.now() - new Date(ticket.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
  if (ticket.caseType === 'injury' && caseAge > 30) {
    return true;
  }
  
  return false;
}

/**
 * GET /api/cases
 * Retrieve list of cases for the dashboard
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('=== CASE FETCHING DEBUG ===');
    console.log('Session exists:', !!(req as any).session);
    console.log('User in session:', !!(req as any).session?.user);
    
    // Get authenticated user from session
    const user = (req as any).session.user;
    console.log('User data:', JSON.stringify(user, null, 2));
    
    let tickets;
    
    // Admin users see all tickets across all organizations
    const isAdmin = user.userType === 'admin' || user.role === 'admin' || user.role === 'super_user' || user.permissions?.includes('admin') || user.permissions?.includes('superuser');
    console.log('Admin check result:', isAdmin);
    
    if (isAdmin) {
      console.log('✅ Admin user detected - fetching ALL tickets across all organizations');
      tickets = await storage.getAllTickets();
    } else {
      console.log(`❌ Company user - fetching tickets only for organization: ${user.organizationId}`);
      tickets = await storage.getAllTicketsForOrganization(user.organizationId);
    }
    
    console.log(`Total tickets found: ${tickets.length}`);
    console.log('=== END DEBUG ===');
    
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
        fdId: ticket.fdId || null,
        workerId: ticket.workerId,
        caseType: ticket.caseType || 'pre_employment',
        claimType: ticket.claimType,
        priority: ticket.priority || 'medium',
        priorityLevel: ticket.priorityLevel || 'Low',
        priorityScore: ticket.priorityScore || 0,
        flags: {
          red: ticket.flagRedCount || 0,
          amber: ticket.flagAmberCount || 0,
          green: ticket.flagGreenCount || 0
        },
        slaDueAt: ticket.slaDueAt?.toISOString(),
        lastUpdateAt: ticket.lastUpdateAt?.toISOString(),
        assignedOwner: ticket.assignedOwner,
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
router.get('/:ticketId', requireAuth, async (req, res) => {
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

    // Get medical documents and certificates
    const documents = await storage.getMedicalDocumentsByTicket(ticketId);
    const medicalCertificates = documents.filter((doc: any) => 
      doc.kind === 'medical_certificate' && doc.isCurrentBool
    );
    
    // Get email thread for case history (mock for now - can be enhanced later)
    const emails: any[] = []; // TODO: Implement email history when getEmailsByTicket is available
    
    // Get attachment files (mock for now - can be enhanced later)
    const attachments: any[] = []; // TODO: Implement attachments when getAttachmentsByTicket is available

    // Enhanced RAG status interpretation with work status
    const ragScore = analysis?.ragScore || 'green';
    const workStatus = determineWorkStatus(ticket, analysis, formSubmission?.rawData);
    const ragInterpretation = interpretRAGStatus(ragScore, workStatus);
    
    // WorkCover classification
    const isWorkCover = ticket.claimType === 'workcover' || 
                       ticket.caseType === 'injury' ||
                       (formSubmission?.rawData as any)?.isWorkCoverClaim === true;

    // Enhanced next steps with Michelle AI recommendations
    const enhancedNextSteps = generateNextSteps(ticket, analysis, medicalCertificates, workStatus);

    const caseDetails = {
      // Core case information
      ticketId: ticket.id,
      fdId: ticket.fdId || null,
      caseType: ticket.caseType || 'pre_employment',
      claimType: ticket.claimType,
      status: ticket.status,
      priority: ticket.priority || 'medium',
      createdAt: new Date(ticket.createdAt || Date.now()),
      
      // Worker information
      workerName: worker ? `${worker.firstName} ${worker.lastName}` : 'Unknown Worker',
      email: worker?.email || '',
      phone: worker?.phone || '',
      roleApplied: worker?.roleApplied || '',
      dateOfBirth: worker?.dateOfBirth || '',
      
      // Company information
      company: ticket.companyName || 'Unknown Company',
      
      // Enhanced RAG status with work interpretation
      ragScore,
      ragInterpretation,
      workStatus,
      
      // Classification and assessment
      fitClassification: analysis?.fitClassification || 'pending',
      isWorkCover,
      workCoverBool: ticket.workCoverBool || false,
      
      // Recommendations and notes
      recommendations: analysis?.recommendations ? 
        (Array.isArray(analysis.recommendations) ? analysis.recommendations : [analysis.recommendations]) : [],
      notes: analysis?.notes || '',
      
      // Workflow tracking
      assignedTo: ticket.assignedTo,
      nextStep: ticket.nextStep,
      enhancedNextSteps,
      lastStep: ticket.lastStep,
      lastStepCompletedAt: ticket.lastStepCompletedAt,
      
      // Medical certificates and documents
      medicalCertificates: medicalCertificates.map((cert: any) => ({
        id: cert.id,
        filename: cert.filename || 'Unknown',
        expiresAt: cert.expiresAt,
        uploadedBy: cert.uploadedBy,
        createdAt: cert.createdAt,
        storageUrl: cert.storageUrl,
        isCurrent: cert.isCurrentBool || true
      })),
      
      // Communication history
      emailCount: emails.length,
      recentEmails: emails.slice(0, 3).map((email: any) => ({
        subject: email.subject || 'No Subject',
        direction: email.direction || 'unknown',
        sentAt: email.sentAt,
        senderName: email.senderName || 'Unknown'
      })),
      
      // Attachments
      attachments: attachments.map((att: any) => ({
        id: att.id,
        filename: att.filename,
        uploadedAt: att.uploadedAt
      })),
      
      // RTW and compliance fields for complex cases
      rtwStep: ticket.rtwStep,
      workplaceJurisdiction: ticket.workplaceJurisdiction,
      complianceStatus: ticket.complianceStatus,
      nextDeadlineDate: ticket.nextDeadlineDate,
      nextDeadlineType: ticket.nextDeadlineType,
      
      // Form data for detailed analysis
      formData: formSubmission?.rawData || null,
      
      // Case age and urgency indicators
      ageDays: Math.floor((Date.now() - new Date(ticket.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)),
      requiresUrgentAction: checkUrgencyFlags(ticket, analysis, medicalCertificates)
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
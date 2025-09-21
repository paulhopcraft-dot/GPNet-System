import { storage } from './storage';
import { PreEmploymentReportData, CaseSummaryReportData, InjuryReportData, ComplianceAuditReportData } from './pdfService';

export class ReportDataService {
  
  /**
   * Extract comprehensive data for pre-employment report generation
   */
  async getPreEmploymentReportData(ticketId: string, generatedBy: string): Promise<PreEmploymentReportData> {
    try {
      // Get core ticket information
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      // Get worker information
      if (!ticket.workerId) {
        throw new Error(`Ticket has no associated worker: ${ticketId}`);
      }
      const worker = await storage.getWorker(ticket.workerId);
      if (!worker) {
        throw new Error(`Worker not found: ${ticket.workerId}`);
      }

      // Get analysis data
      const analysis = await storage.getAnalysisByTicket(ticketId);

      // Get form submission data
      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);

      // Generate recommendations based on analysis
      const recommendations = this.generateRecommendations(analysis, formSubmission);

      // Get company name from ticket or organization
      let companyName = ticket.companyName;
      if (!companyName && ticket.organizationId) {
        const organization = await storage.getOrganization(ticket.organizationId);
        companyName = organization?.name || 'Unknown Company';
      }

      return {
        ticket,
        worker,
        analysis,
        formSubmission,
        recommendations,
        companyName: companyName || 'Unknown Company',
        generatedAt: new Date().toISOString(),
        generatedBy
      };

    } catch (error) {
      console.error('Error extracting pre-employment report data:', error);
      throw error;
    }
  }

  /**
   * Extract comprehensive data for case summary report
   */
  async getCaseSummaryReportData(ticketId: string, generatedBy: string): Promise<CaseSummaryReportData> {
    try {
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      const worker = await storage.getWorker(ticket.workerId);
      const analysis = await storage.getAnalysisByTicket(ticketId);
      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);

      // Get injury data if it's an injury case
      let injury = null;
      if (ticket.caseType === 'injury') {
        injury = await storage.getInjuryByTicket(ticketId);
      }

      // Get RTW plan if available
      let rtwPlan = null;
      if (ticket.caseType === 'injury') {
        const rtwPlans = await storage.getRtwPlansByTicket(ticketId);
        rtwPlan = rtwPlans?.[0];
      }

      // Get stakeholders
      const stakeholders = await storage.getStakeholdersByTicket(ticketId);

      // Get email communications - placeholder empty array for now
      const emails: any[] = [];

      // Get attachments - placeholder empty array for now
      const attachments: any[] = [];

      return {
        ticket,
        worker,
        analysis,
        formSubmission,
        injury,
        rtwPlan,
        stakeholders,
        emails,
        attachments,
        generatedAt: new Date().toISOString(),
        generatedBy
      };

    } catch (error) {
      console.error('Error extracting case summary report data:', error);
      throw error;
    }
  }

  /**
   * Extract data for injury report
   */
  async getInjuryReportData(ticketId: string, generatedBy: string): Promise<InjuryReportData> {
    try {
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      const worker = await storage.getWorker(ticket.workerId);
      
      // Get injury data
      const injury = await storage.getInjuryByTicket(ticketId);

      const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
      const analysis = await storage.getAnalysisByTicket(ticketId);
      const stakeholders = await storage.getStakeholdersByTicket(ticketId);

      // Get RTW plan
      const rtwPlans = await storage.getRtwPlansByTicket(ticketId);
      const rtwPlan = rtwPlans?.[0];

      return {
        ticket,
        worker,
        injury,
        formSubmission,
        analysis,
        stakeholders,
        rtwPlan,
        generatedAt: new Date().toISOString(),
        generatedBy
      };

    } catch (error) {
      console.error('Error extracting injury report data:', error);
      throw error;
    }
  }

  /**
   * Extract data for compliance audit report
   */
  async getComplianceAuditReportData(ticketId: string, generatedBy: string): Promise<ComplianceAuditReportData> {
    try {
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      const worker = await storage.getWorker(ticket.workerId);

      // Get audit trail data - using getAuditEvents with filters
      const auditTrail = await storage.getAuditEvents({
        organizationId: ticket.organizationId || undefined
      });

      // Get workflow steps - placeholder empty array for now
      const workflowSteps: any[] = [];

      // Get participation events - placeholder empty array for now
      const participationEvents: any[] = [];

      // Get generated letters - placeholder empty array for now
      const generatedLetters: any[] = [];

      return {
        ticket,
        worker,
        auditTrail,
        workflowSteps,
        participationEvents,
        generatedLetters,
        generatedAt: new Date().toISOString(),
        generatedBy
      };

    } catch (error) {
      console.error('Error extracting compliance audit report data:', error);
      throw error;
    }
  }

  /**
   * Generate contextual recommendations based on analysis and form data
   */
  private generateRecommendations(analysis: any, formSubmission: any): string[] {
    const recommendations: string[] = [];

    if (!analysis) {
      return ['Complete health assessment pending - no recommendations available at this time'];
    }

    // Base recommendations on analysis
    if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
      recommendations.push(...analysis.recommendations);
    }

    // Add contextual recommendations based on form data
    if (formSubmission?.rawData) {
      const data = formSubmission.rawData;

      // Lifting capacity recommendations
      if (data.liftingKg && data.liftingKg < 15) {
        recommendations.push('Consider ergonomic assessment and training for safe lifting practices');
        recommendations.push('Implement mechanical aids for heavy lifting tasks where possible');
      }

      // Endurance recommendations
      if (data.standingMins && data.standingMins < 30) {
        recommendations.push('Gradual conditioning program to improve standing endurance');
        recommendations.push('Provide adequate rest breaks and job rotation options');
      }

      if (data.walkingMins && data.walkingMins < 30) {
        recommendations.push('Walking endurance improvement program recommended');
      }

      // Musculoskeletal recommendations
      if (data.mskBack && data.mskBack !== 'no') {
        recommendations.push('Ergonomic workstation assessment and back care education');
        recommendations.push('Consider physiotherapy consultation for back condition management');
      }

      // Psychosocial recommendations
      if (data.stressRating && data.stressRating > 3) {
        recommendations.push('Stress management support and employee assistance program referral');
        recommendations.push('Regular check-ins with supervisor to monitor workplace stress levels');
      }

      if (data.sleepRating && data.sleepRating < 3) {
        recommendations.push('Sleep hygiene education and fatigue management strategies');
        recommendations.push('Consider fitness for duty assessment for safety-critical roles');
      }

      // Repetitive tasks
      if (data.repetitiveTasks === 'no') {
        recommendations.push('Job modification to reduce repetitive tasks or provide rotation');
        recommendations.push('Ergonomic training for repetitive task performance');
      }
    }

    // RAG score specific recommendations
    if (analysis.ragScore) {
      switch (analysis.ragScore.toLowerCase()) {
        case 'red':
          recommendations.push('High-risk case requiring immediate medical review and clearance');
          recommendations.push('Consider occupational physician consultation before employment');
          break;
        case 'amber':
          recommendations.push('Medium-risk case requiring periodic monitoring and review');
          recommendations.push('Implement workplace adjustments as necessary');
          break;
        case 'green':
          recommendations.push('Low-risk case suitable for standard employment with routine monitoring');
          break;
      }
    }

    // Fit classification recommendations
    if (analysis.fitClassification) {
      switch (analysis.fitClassification.toLowerCase()) {
        case 'fit_with_restrictions':
          recommendations.push('Employment conditional on implementation of specified workplace adjustments');
          recommendations.push('Regular review of restrictions and capacity for role requirements');
          break;
        case 'not_fit':
          recommendations.push('Alternative role consideration or delayed employment until fitness improves');
          recommendations.push('Medical clearance required before proceeding with employment');
          break;
      }
    }

    // Ensure we have at least some recommendations
    if (recommendations.length === 0) {
      recommendations.push('Standard pre-employment health monitoring recommended');
      recommendations.push('Regular wellness checks and employee health program participation');
    }

    // Remove duplicates and limit to reasonable number
    const uniqueRecommendations = Array.from(new Set(recommendations));
    return uniqueRecommendations.slice(0, 8);
  }

  /**
   * Get available report types for a ticket
   */
  async getAvailableReportTypes(ticketId: string): Promise<string[]> {
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const reportTypes: string[] = ['case-summary'];

    // Pre-employment reports
    if (ticket.caseType === 'pre_employment') {
      reportTypes.push('pre-employment');
    }

    // Injury reports
    if (ticket.caseType === 'injury') {
      reportTypes.push('injury-report');
    }

    // Compliance audit reports (available for all types)
    reportTypes.push('compliance-audit');

    return reportTypes;
  }
}

export const reportDataService = new ReportDataService();
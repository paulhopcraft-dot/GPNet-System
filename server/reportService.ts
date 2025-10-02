import { pdfService, PreEmploymentReportData } from './pdfService.js';
import { storage } from './storage.js';
import { InsertReport } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || '/replit-objstore-5077d17e-4a75-4767-a85c-e8248f3fb83e/.private';

export class ReportService {
  async generatePreEmploymentReport(ticketId: string, generatedBy: string = 'system'): Promise<string> {
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (!ticket.workerId) {
      throw new Error(`No worker associated with ticket ${ticketId}`);
    }

    const worker = await storage.getWorker(ticket.workerId);
    const analysis = await storage.getAnalysisByTicket(ticketId);
    const formSubmission = await storage.getFormSubmissionByTicket(ticketId);

    if (!worker) {
      throw new Error(`Worker not found for ticket ${ticketId}`);
    }
    if (!analysis) {
      throw new Error(`Analysis not found for ticket ${ticketId}`);
    }
    if (!formSubmission) {
      throw new Error(`Form submission not found for ticket ${ticketId}`);
    }

    let organization = null;
    if (ticket.organizationId) {
      organization = await storage.getOrganization(ticket.organizationId);
    }

    const reportData: PreEmploymentReportData = {
      ticket,
      worker,
      analysis,
      formSubmission,
      generatedAt: new Date().toISOString(),
      generatedBy,
      companyName: organization?.name || 'Unknown Organization',
      recommendations: this.extractRecommendations(analysis)
    };

    const pdfBuffer = await pdfService.generatePreEmploymentReport(reportData);
    
    const storageKey = `reports/pre-employment-${ticketId}-${Date.now()}.pdf`;
    const fullPath = path.join(PRIVATE_OBJECT_DIR, storageKey);
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, pdfBuffer);

    const reportRecord: InsertReport = {
      ticketId,
      reportType: 'pre-employment',
      status: 'generated',
      storageKey,
      dataVersion: '1.0',
      metadata: {
        generatedBy,
        companyName: organization?.name,
        workerName: `${worker.firstName} ${worker.lastName}`,
        ragScore: analysis.ragScore,
        fitClassification: analysis.fitClassification
      }
    };

    const report = await storage.createReport(reportRecord);
    return report.id;
  }

  async saveGeneratedReport(
    ticketId: string,
    reportType: string,
    pdfBuffer: Buffer,
    metadata: any = {},
    generatedBy: string = 'system'
  ): Promise<string> {
    const storageKey = `reports/${reportType}-${ticketId}-${Date.now()}.pdf`;
    const fullPath = path.join(PRIVATE_OBJECT_DIR, storageKey);
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, pdfBuffer);

    const reportRecord: InsertReport = {
      ticketId,
      reportType,
      status: 'generated',
      storageKey,
      dataVersion: '1.0',
      metadata: {
        generatedBy,
        ...metadata
      }
    };

    const report = await storage.createReport(reportRecord);
    return report.id;
  }

  private extractRecommendations(analysis: any): any[] {
    const recommendations = [];
    
    if (analysis.recommendations) {
      recommendations.push({
        type: 'general',
        text: analysis.recommendations
      });
    }

    if (analysis.fitClassification === 'FIT_WITH_RESTRICTIONS') {
      recommendations.push({
        type: 'restrictions',
        text: 'Employee requires workplace restrictions. Review detailed recommendations.'
      });
    }

    if (analysis.ragScore === 'RED') {
      recommendations.push({
        type: 'high_risk',
        text: 'High risk identified. Medical review recommended before employment.'
      });
    }

    return recommendations;
  }
}

export const reportService = new ReportService();

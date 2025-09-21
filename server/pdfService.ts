import puppeteer, { Browser, Page } from 'puppeteer';
import Handlebars from 'handlebars';
import moment from 'moment';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: string) => {
  return moment(date).format('DD/MM/YYYY');
});

Handlebars.registerHelper('formatDateTime', (date: string) => {
  return moment(date).format('DD/MM/YYYY HH:mm');
});

Handlebars.registerHelper('capitalize', (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('ragColor', (ragScore: string) => {
  switch (ragScore?.toLowerCase()) {
    case 'green': return '#22c55e';
    case 'amber': return '#f59e0b';
    case 'red': return '#ef4444';
    default: return '#6b7280';
  }
});

Handlebars.registerHelper('statusBadge', (status: string) => {
  const statusColors: Record<string, string> = {
    'NEW': '#3b82f6',
    'ANALYZING': '#f59e0b',
    'AWAITING_REVIEW': '#8b5cf6',
    'REVISIONS_REQUIRED': '#ef4444',
    'READY_TO_SEND': '#10b981',
    'COMPLETE': '#22c55e'
  };
  return statusColors[status] || '#6b7280';
});

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);
Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);
Handlebars.registerHelper('or', (a: any, b: any) => a || b);
Handlebars.registerHelper('and', (a: any, b: any) => a && b);

// PDF generation interface
export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  // Business logic options
  includeConfidentialInfo?: boolean;
  customFooter?: string;
  letterhead?: boolean;
}

// Report data interfaces
export interface CaseSummaryReportData {
  ticket: any;
  worker: any;
  analysis?: any;
  formSubmission?: any;
  injury?: any;
  rtwPlan?: any;
  stakeholders: any[];
  emails: any[];
  attachments: any[];
  generatedAt: string;
  generatedBy: string;
}

export interface PreEmploymentReportData {
  ticket: any;
  worker: any;
  analysis: any;
  formSubmission: any;
  generatedAt: string;
  generatedBy: string;
  companyName: string;
  recommendations: any[];
}

export interface InjuryReportData {
  ticket: any;
  worker: any;
  injury: any;
  formSubmission?: any;
  analysis?: any;
  stakeholders: any[];
  rtwPlan?: any;
  generatedAt: string;
  generatedBy: string;
}

export interface ComplianceAuditReportData {
  ticket: any;
  worker: any;
  auditTrail: any[];
  workflowSteps: any[];
  participationEvents: any[];
  generatedLetters: any[];
  generatedAt: string;
  generatedBy: string;
}

class PDFService {
  private templatesPath: string;
  private browser: Browser | null = null;

  constructor() {
    this.templatesPath = path.join(__dirname, 'templates', 'pdf');
  }

  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  private async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      return Handlebars.compile(templateSource);
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  private async generatePDFFromHTML(
    html: string,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      const defaultOptions: PDFGenerationOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin: 0 auto;">
            <span>GPNet Case Management System</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin: 0 auto;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Generated on ${moment().format('DD/MM/YYYY HH:mm')}</span>
          </div>
        `
      };

      const mergedOptions = { ...defaultOptions, ...options };

      const pdf = await page.pdf({
        format: mergedOptions.format,
        landscape: mergedOptions.orientation === 'landscape',
        margin: mergedOptions.margin,
        displayHeaderFooter: mergedOptions.displayHeaderFooter,
        headerTemplate: mergedOptions.headerTemplate,
        footerTemplate: mergedOptions.footerTemplate,
        printBackground: true
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async generateCaseSummaryReport(
    data: CaseSummaryReportData,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    const template = await this.loadTemplate('case-summary');
    const html = template(data);
    return this.generatePDFFromHTML(html, options);
  }

  async generatePreEmploymentReport(
    data: PreEmploymentReportData,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    const template = await this.loadTemplate('pre-employment');
    const html = template(data);
    return this.generatePDFFromHTML(html, options);
  }

  async generateInjuryReport(
    data: InjuryReportData,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    const template = await this.loadTemplate('injury-report');
    const html = template(data);
    return this.generatePDFFromHTML(html, options);
  }

  async generateComplianceAuditReport(
    data: ComplianceAuditReportData,
    options?: PDFGenerationOptions
  ): Promise<Buffer> {
    const template = await this.loadTemplate('compliance-audit');
    const html = template(data);
    return this.generatePDFFromHTML(html, options);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const pdfService = new PDFService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pdfService.close();
});

process.on('SIGINT', async () => {
  await pdfService.close();
});
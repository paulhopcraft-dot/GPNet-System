import nodemailer from 'nodemailer';
import { IStorage } from './storage';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  role?: string; // e.g., 'employer', 'hr_manager', 'consultant'
}

export interface ReportEmailOptions {
  ticketId: string;
  reportType: string;
  recipients: EmailRecipient[];
  pdfBuffer: Buffer;
  customMessage?: string;
  includeComplianceNote?: boolean;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;
  private fromName: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || 'reports@gpnet.com.au';
    this.fromName = process.env.EMAIL_FROM_NAME || 'GPNet Health Assessment Services';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Check if email configuration is available
    const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
    const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

    if (!emailHost || !emailUser || !emailPass) {
      console.log('Email configuration not complete - email sending will be disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465, // Use SSL for port 465, TLS for others
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates in development
        }
      });

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return !!this.transporter;
  }

  /**
   * Generate email template for report delivery
   */
  private generateReportEmailTemplate(
    reportType: string,
    ticketId: string,
    workerName: string,
    companyName: string,
    customMessage?: string,
    includeComplianceNote?: boolean
  ): { subject: string; html: string; text: string } {
    const reportTypeNames = {
      'pre-employment': 'Pre-Employment Health Assessment',
      'case-summary': 'Case Summary',
      'injury-report': 'Injury Assessment',
      'compliance-audit': 'Compliance Audit'
    };

    const reportDisplayName = reportTypeNames[reportType as keyof typeof reportTypeNames] || 'Health Assessment';
    const subject = `${reportDisplayName} Report - ${workerName} (Case #${ticketId})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; max-width: 600px; margin: 0 auto; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
        .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .logo { font-size: 24px; font-weight: bold; }
        .case-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">GPNet Health Assessment Services</div>
        <p style="margin: 5px 0 0 0; font-size: 14px;">Professional Occupational Health Solutions</p>
    </div>
    
    <div class="content">
        <h2>Report Delivery</h2>
        <p>Dear Employer,</p>
        
        <p>Please find attached the ${reportDisplayName} report for your review.</p>
        
        <div class="case-info">
            <h3 style="margin-top: 0;">Case Details</h3>
            <p><strong>Case Number:</strong> ${ticketId}</p>
            <p><strong>Worker:</strong> ${workerName}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>Report Type:</strong> ${reportDisplayName}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-AU', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit'
            })}</p>
        </div>

        ${customMessage ? `
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <h4 style="margin-top: 0;">Additional Information</h4>
            <p>${customMessage}</p>
        </div>
        ` : ''}

        ${includeComplianceNote ? `
        <div class="alert">
            <h4 style="margin-top: 0;">⚠️ Compliance Notice</h4>
            <p>This report contains confidential health information and must be handled in accordance with:</p>
            <ul>
                <li>Privacy Act 1988 (Commonwealth)</li>
                <li>Work Health and Safety Acts (State/Territory)</li>
                <li>Workers' Compensation legislation</li>
            </ul>
            <p>Please ensure appropriate confidentiality measures are maintained.</p>
        </div>
        ` : ''}

        <p>If you have any questions regarding this report, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>
        <strong>GPNet Health Assessment Team</strong></p>
    </div>
    
    <div class="footer">
        <p><strong>GPNet Health Assessment Services</strong></p>
        <p>Professional | Compliant | Confidential</p>
        <p>This email and any attachments contain confidential information. If you have received this email in error, please delete it immediately and notify the sender.</p>
    </div>
</body>
</html>`;

    const text = `
GPNet Health Assessment Services
${reportDisplayName} Report - ${workerName} (Case #${ticketId})

Dear Employer,

Please find attached the ${reportDisplayName} report for your review.

Case Details:
- Case Number: ${ticketId}
- Worker: ${workerName}
- Company: ${companyName}
- Report Type: ${reportDisplayName}
- Generated: ${new Date().toLocaleDateString('en-AU')}

${customMessage ? `\nAdditional Information:\n${customMessage}\n` : ''}

${includeComplianceNote ? `
COMPLIANCE NOTICE:
This report contains confidential health information and must be handled in accordance with:
- Privacy Act 1988 (Commonwealth)
- Work Health and Safety Acts (State/Territory)  
- Workers' Compensation legislation

Please ensure appropriate confidentiality measures are maintained.
` : ''}

If you have any questions regarding this report, please don't hesitate to contact us.

Best regards,
GPNet Health Assessment Team

---
This email and any attachments contain confidential information.
If you have received this email in error, please delete it immediately and notify the sender.
`;

    return { subject, html, text };
  }

  /**
   * Send PDF report via email
   */
  async sendReportEmail(options: ReportEmailOptions, storage: IStorage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Get case details
      const ticket = await storage.getTicket(options.ticketId);
      if (!ticket || !ticket.workerId) {
        return { success: false, error: 'Case or worker not found' };
      }

      const worker = await storage.getWorker(ticket.workerId);
      if (!worker) {
        return { success: false, error: 'Worker details not found' };
      }

      // Get organization details
      const organization = ticket.organizationId ? await storage.getOrganization(ticket.organizationId) : null;
      const companyName = organization?.name || 'Unknown Company';

      // Generate email content
      const emailTemplate = this.generateReportEmailTemplate(
        options.reportType,
        options.ticketId,
        `${worker.firstName} ${worker.lastName}`,
        companyName,
        options.customMessage,
        options.includeComplianceNote
      );

      // Prepare recipients
      const recipients = options.recipients.map(r => 
        r.name ? `"${r.name}" <${r.email}>` : r.email
      );

      // Prepare attachment
      const reportTypeNames = {
        'pre-employment': 'Pre-Employment-Assessment',
        'case-summary': 'Case-Summary',
        'injury-report': 'Injury-Report',
        'compliance-audit': 'Compliance-Audit'
      };
      
      const filename = `${reportTypeNames[options.reportType as keyof typeof reportTypeNames] || 'Report'}-${options.ticketId}-${new Date().toISOString().split('T')[0]}.pdf`;

      // Send email
      const result = await this.transporter!.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: recipients,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
        attachments: [
          {
            filename,
            content: options.pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      console.log('Report email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('Failed to send report email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error'
      };
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Email service is not available'
      };
    }

    try {
      const result = await this.transporter!.sendMail({
        from: options.from || `"${this.fromName}" <${this.fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || (options.html ? options.html.replace(/<[^>]*>/g, '') : undefined)
      });

      console.log(`Email sent successfully: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId
      };
      
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error'
      };
    }
  }

  /**
   * Send test email to verify configuration
   */
  async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const result = await this.transporter!.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: recipientEmail,
        subject: 'GPNet Email Service Test',
        text: 'This is a test email from GPNet Health Assessment Services. If you received this, the email service is working correctly.',
        html: `
          <h2>GPNet Email Service Test</h2>
          <p>This is a test email from <strong>GPNet Health Assessment Services</strong>.</p>
          <p>If you received this, the email service is working correctly.</p>
          <p>Time sent: ${new Date().toISOString()}</p>
        `
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send test email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error'
      };
    }
  }
}

export const emailService = new EmailService();
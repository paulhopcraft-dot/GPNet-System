import nodemailer from 'nodemailer';
import { MailService } from '@sendgrid/mail';
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
  private sendGridService: MailService | null = null;
  private fromAddress: string;
  private fromName: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || 'reports@gpnet.com.au';
    this.fromName = process.env.EMAIL_FROM_NAME || 'GPNet Health Assessment Services';
    this.initializeTransporter();
    this.initializeSendGrid();
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

  private initializeSendGrid() {
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {
      console.log('SendGrid API key not found - SendGrid email sending will be disabled');
      return;
    }

    try {
      this.sendGridService = new MailService();
      this.sendGridService.setApiKey(sendGridApiKey);
      console.log('SendGrid email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SendGrid service:', error);
      this.sendGridService = null;
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return !!this.transporter || !!this.sendGridService;
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

  /**
   * Send manager notification when a worker submits a health check
   */
  async sendManagerNotification(managerEmail: string, workerName: string, checkType: string, ticketId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    const subject = `Health Check Submitted - ${workerName} (${checkType})`;
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
              .logo { font-size: 24px; font-weight: bold; }
              .case-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">GPNet Health Assessment Services</div>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Manager Notification</p>
          </div>
          
          <div class="content">
              <h2>New Health Check Submission</h2>
              <p>Dear Manager,</p>
              
              <p>A health check has been submitted and is awaiting your review.</p>
              
              <div class="case-info">
                  <h3 style="margin-top: 0;">Submission Details</h3>
                  <p><strong>Worker:</strong> ${workerName}</p>
                  <p><strong>Check Type:</strong> ${checkType}</p>
                  <p><strong>Ticket ID:</strong> ${ticketId}</p>
                  <p><strong>Status:</strong> Awaiting Review</p>
                  <p><strong>Submitted:</strong> ${new Date().toLocaleDateString('en-AU', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}</p>
              </div>

              <p>Please review this submission in the GPNet dashboard at your earliest convenience.</p>
              
              <p>Best regards,<br>
              <strong>GPNet Automation System</strong></p>
          </div>
          
          <div class="footer">
              <p><strong>GPNet Health Assessment Services</strong></p>
              <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
      </body>
      </html>
    `;

    return this.sendEmailWithFallback({
      to: managerEmail,
      subject,
      html
    });
  }

  /**
   * Send follow-up reminder to worker for incomplete health checks
   */
  async sendFollowUpReminder(workerEmail: string, workerName: string, checkType: string, dayNumber: number): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    const isDay3 = dayNumber === 3;
    const subject = isDay3 
      ? `URGENT: Health Check Still Pending - ${checkType}` 
      : `Reminder: Health Check Pending - ${checkType}`;

    const html = isDay3 ? this.getDay3ReminderHtml(workerName, checkType) : this.getDay1ReminderHtml(workerName, checkType);

    return this.sendEmailWithFallback({
      to: workerEmail,
      subject,
      html
    });
  }

  /**
   * Send admin alert for overdue health checks
   */
  async sendAdminAlert(adminEmail: string, workerName: string, checkType: string, dayNumber: number): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    const subject = `Health Check Overdue Alert - ${workerName} (Day ${dayNumber})`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; max-width: 600px; margin: 0 auto; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
              .logo { font-size: 24px; font-weight: bold; }
              .alert-info { background-color: #fef2f2; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #dc2626; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">GPNet Admin Alert</div>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Health Check Overdue</p>
          </div>
          
          <div class="content">
              <h2>⚠️ Health Check Overdue Alert</h2>
              <p>Dear Administrator,</p>
              
              <div class="alert-info">
                  <h3 style="margin-top: 0;">Overdue Health Check</h3>
                  <p><strong>Worker:</strong> ${workerName}</p>
                  <p><strong>Check Type:</strong> ${checkType}</p>
                  <p><strong>Days Overdue:</strong> ${dayNumber}</p>
                  <p><strong>Alert Generated:</strong> ${new Date().toLocaleDateString('en-AU', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}</p>
              </div>

              <p>This worker has not completed their health check within the required timeframe. Please follow up with the worker and their manager immediately.</p>
              
              <p><strong>Recommended Actions:</strong></p>
              <ul>
                  <li>Contact the worker directly</li>
                  <li>Notify their immediate supervisor</li>
                  <li>Review any compliance implications</li>
                  <li>Consider escalation if necessary</li>
              </ul>
              
              <p>Best regards,<br>
              <strong>GPNet Automation System</strong></p>
          </div>
          
          <div class="footer">
              <p><strong>GPNet Health Assessment Services</strong></p>
              <p>This is an automated alert. Please take appropriate action.</p>
          </div>
      </body>
      </html>
    `;

    return this.sendEmailWithFallback({
      to: adminEmail,
      subject,
      html
    });
  }

  private getDay1ReminderHtml(workerName: string, checkType: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; max-width: 600px; margin: 0 auto; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
              .logo { font-size: 24px; font-weight: bold; }
              .reminder-info { background-color: #eff6ff; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #1e3a8a; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">GPNet Health Assessment</div>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Health Check Reminder</p>
          </div>
          
          <div class="content">
              <h2>Health Check Reminder</h2>
              <p>Dear ${workerName},</p>
              
              <div class="reminder-info">
                  <h3 style="margin-top: 0;">Pending Health Check</h3>
                  <p><strong>Check Type:</strong> ${checkType}</p>
                  <p><strong>Status:</strong> Not Started</p>
              </div>
              
              <p>This is a friendly reminder that your <strong>${checkType}</strong> health check is still pending completion.</p>
              
              <p>Please complete your health assessment as soon as possible to ensure compliance with workplace health requirements.</p>
              
              <p>If you have any questions or need assistance, please contact your manager or HR department.</p>
              
              <p>Thank you for your attention to this matter.</p>
              
              <p>Best regards,<br>
              <strong>GPNet Health System</strong></p>
          </div>
          
          <div class="footer">
              <p><strong>GPNet Health Assessment Services</strong></p>
              <p>This is an automated reminder. Please complete your health check promptly.</p>
          </div>
      </body>
      </html>
    `;
  }

  private getDay3ReminderHtml(workerName: string, checkType: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; max-width: 600px; margin: 0 auto; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
              .logo { font-size: 24px; font-weight: bold; }
              .urgent-info { background-color: #fef2f2; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #dc2626; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">GPNet Health Assessment</div>
              <p style="margin: 5px 0 0 0; font-size: 14px;">URGENT: Health Check Overdue</p>
          </div>
          
          <div class="content">
              <h2>🚨 URGENT: Health Check Overdue</h2>
              <p>Dear ${workerName},</p>
              
              <div class="urgent-info">
                  <h3 style="margin-top: 0;">⚠️ Overdue Health Check</h3>
                  <p><strong>Check Type:</strong> ${checkType}</p>
                  <p><strong>Status:</strong> OVERDUE - Immediate Action Required</p>
              </div>
              
              <p><strong>Your ${checkType} health check is now overdue and requires immediate attention.</strong></p>
              
              <p>Failure to complete this health assessment may result in:</p>
              <ul>
                  <li>Delays in work authorization</li>
                  <li>Compliance issues</li>
                  <li>Potential workplace safety concerns</li>
                  <li>Administrative follow-up actions</li>
              </ul>
              
              <p><strong style="color: #dc2626;">Action Required:</strong> Please complete your health check immediately or contact your manager for assistance.</p>
              
              <p>If there are any issues preventing completion, please reach out to your supervisor or HR department immediately.</p>
              
              <p>Best regards,<br>
              <strong>GPNet Health System</strong></p>
          </div>
          
          <div class="footer">
              <p><strong>GPNet Health Assessment Services</strong></p>
              <p>This is an urgent automated reminder requiring immediate action.</p>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Send 24-hour follow-up notification for incomplete health checks
   */
  async send24HourFollowUp(workerEmail: string, workerName: string, ticketId: string, checkType: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    const subject = `Reminder: Complete Your ${checkType} - 24 Hour Follow-up`;
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
              .logo { font-size: 24px; font-weight: bold; }
              .reminder-info { background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #ffc107; }
              .cta-button { background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">GPNet Health Assessment Services</div>
              <p style="margin: 5px 0 0 0; font-size: 14px;">24-Hour Follow-up Reminder</p>
          </div>
          
          <div class="content">
              <h2>Reminder: Complete Your Health Check</h2>
              <p>Dear ${workerName},</p>
              
              <p>We noticed you started a ${checkType} submission 24 hours ago but haven't completed it yet.</p>
              
              <div class="reminder-info">
                  <strong>Case ID:</strong> ${ticketId}<br>
                  <strong>Assessment Type:</strong> ${checkType}<br>
                  <strong>Status:</strong> Incomplete
              </div>
              
              <p>Please complete your health assessment at your earliest convenience. Your employer is waiting for this information to proceed with your application.</p>
              
              <p>If you're experiencing any difficulties or have questions, please don't hesitate to contact our support team.</p>
              
              <p>Thank you for your cooperation.</p>
              
              <p>Best regards,<br>
              GPNet Health Assessment Team</p>
          </div>
          
          <div class="footer">
              <p>GPNet Health Assessment Services<br>
              If you have any questions, please contact our support team.</p>
          </div>
      </body>
      </html>
    `;

    const text = `
      Reminder: Complete Your ${checkType} - 24 Hour Follow-up
      
      Dear ${workerName},
      
      We noticed you started a ${checkType} submission 24 hours ago but haven't completed it yet.
      
      Case ID: ${ticketId}
      Assessment Type: ${checkType}
      Status: Incomplete
      
      Please complete your health assessment at your earliest convenience. Your employer is waiting for this information to proceed with your application.
      
      If you're experiencing any difficulties or have questions, please don't hesitate to contact our support team.
      
      Thank you for your cooperation.
      
      Best regards,
      GPNet Health Assessment Team
    `;

    return this.sendEmailWithFallback({
      to: workerEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send day 3 follow-up notification for incomplete health checks
   */
  async sendDay3FollowUp(workerEmail: string, workerName: string, ticketId: string, checkType: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Email service not configured' };
    }

    const subject = `Final Reminder: Complete Your ${checkType} - Day 3 Follow-up`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; max-width: 600px; margin: 0 auto; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
              .logo { font-size: 24px; font-weight: bold; }
              .urgent-info { background-color: #f8d7da; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #dc3545; }
              .cta-button { background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">GPNet Health Assessment Services</div>
              <p style="margin: 5px 0 0 0; font-size: 14px;">FINAL REMINDER - Day 3 Follow-up</p>
          </div>
          
          <div class="content">
              <h2>Final Reminder: Complete Your Health Check</h2>
              <p>Dear ${workerName},</p>
              
              <p><strong>This is your final reminder</strong> - your ${checkType} submission has been incomplete for 3 days.</p>
              
              <div class="urgent-info">
                  <strong>⚠️ URGENT ACTION REQUIRED</strong><br><br>
                  <strong>Case ID:</strong> ${ticketId}<br>
                  <strong>Assessment Type:</strong> ${checkType}<br>
                  <strong>Status:</strong> Incomplete for 3 days<br>
                  <strong>Action Required:</strong> Complete assessment immediately
              </div>
              
              <p><strong>Please complete your health assessment immediately.</strong> Further delays may impact your employment application process.</p>
              
              <p>If you're unable to complete the assessment or are experiencing technical difficulties, please contact our support team immediately to avoid any delays with your application.</p>
              
              <p>Your employer has been notified of this delay and is waiting for your submission to proceed.</p>
              
              <p>Best regards,<br>
              GPNet Health Assessment Team</p>
          </div>
          
          <div class="footer">
              <p>GPNet Health Assessment Services<br>
              <strong>URGENT:</strong> If you have any questions, please contact our support team immediately.</p>
          </div>
      </body>
      </html>
    `;

    const text = `
      FINAL REMINDER: Complete Your ${checkType} - Day 3 Follow-up
      
      Dear ${workerName},
      
      This is your final reminder - your ${checkType} submission has been incomplete for 3 days.
      
      ⚠️ URGENT ACTION REQUIRED
      
      Case ID: ${ticketId}
      Assessment Type: ${checkType}
      Status: Incomplete for 3 days
      Action Required: Complete assessment immediately
      
      Please complete your health assessment immediately. Further delays may impact your employment application process.
      
      If you're unable to complete the assessment or are experiencing technical difficulties, please contact our support team immediately to avoid any delays with your application.
      
      Your employer has been notified of this delay and is waiting for your submission to proceed.
      
      Best regards,
      GPNet Health Assessment Team
    `;

    return this.sendEmailWithFallback({
      to: workerEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send email with fallback between SendGrid and nodemailer
   */
  private async sendEmailWithFallback(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromAddress = options.from || `"${this.fromName}" <${this.fromAddress}>`;

    // Try SendGrid first if available
    if (this.sendGridService) {
      try {
        const emailOptions: any = {
          to: options.to,
          from: fromAddress,
          subject: options.subject
        };
        
        if (options.html) {
          emailOptions.html = options.html;
        }
        
        if (options.text || options.html) {
          emailOptions.text = options.text || (options.html ? options.html.replace(/<[^>]*>/g, '') : '');
        }
        
        const result = await this.sendGridService.send(emailOptions);

        console.log(`Email sent via SendGrid: ${result[0].statusCode}`);
        return {
          success: true,
          messageId: result[0].headers?.['x-message-id'] as string || undefined
        };
      } catch (error) {
        console.error('SendGrid email failed, trying nodemailer fallback:', error);
      }
    }

    // Fallback to nodemailer if SendGrid fails or is not available
    if (this.transporter) {
      try {
        const result = await this.transporter.sendMail({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || (options.html ? options.html.replace(/<[^>]*>/g, '') : undefined)
        });

        console.log(`Email sent via nodemailer: ${result.messageId}`);
        return {
          success: true,
          messageId: result.messageId
        };
      } catch (error) {
        console.error('Nodemailer email failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown email error'
        };
      }
    }

    return {
      success: false,
      error: 'No email service available'
    };
  }
}

export const emailService = new EmailService();
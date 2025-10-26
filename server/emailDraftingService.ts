/**
 * Email Drafting Service
 * 
 * Automatically generates professional health check request emails
 * with ticket-aware JotForm links for seamless worker data collection.
 */

import { z } from 'zod';
import { storage } from './storage.js';
import type { CheckRequest, Worker, Check, Ticket } from '../shared/schema.js';

// Input schema for email draft generation
export const EmailDraftRequestSchema = z.object({
  ticketId: z.string(),
  workerId: z.string(),
  checkId: z.string(),
  managerEmail: z.string(),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  customMessage: z.string().optional(),
  dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  companyInstructions: z.string().optional()
});

export type EmailDraftRequest = z.infer<typeof EmailDraftRequestSchema>;

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
  htmlBody: string;
  checkLink: string;
  linkToken: string;
  expiresAt: Date;
}

export class EmailDraftingService {
  private readonly JOTFORM_BASE_URL = process.env.JOTFORM_BASE_URL || 'https://form.jotform.com/';
  private readonly BASE_URL = process.env.BASE_URL
  ? process.env.BASE_URL
  : (process.env.REPL_SLUG && process.env.REPL_OWNER
     ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
     : `http://localhost:${process.env.PORT || 9000}`);

  private readonly LINK_EXPIRY_HOURS = 72; // 3 days default

  /**
   * Generate a comprehensive email draft for health check requests
   */
  async generateEmailDraft(request: EmailDraftRequest): Promise<GeneratedEmailDraft> {
    // Fetch related data
    const [ticket, worker, check] = await Promise.all([
      storage.getTicket(request.ticketId),
      storage.getWorker(request.workerId),
      storage.getCheckById(request.checkId)
    ]);

    if (!ticket || !worker || !check) {
      throw new Error('Required data not found for email draft generation');
    }

    // Generate secure link token
    const linkToken = this.generateSecureLinkToken(request.ticketId, worker.id);
    
    // Create ticket-aware JotForm link
    const checkLink = this.generateTicketAwareJotFormLink(check, request.ticketId, linkToken);
    
    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.LINK_EXPIRY_HOURS);

    // Generate email content
    const subject = this.generateEmailSubject(check, worker, request.urgency);
    const { body, htmlBody } = this.generateEmailContent(
      ticket,
      worker,
      check,
      checkLink,
      request.customMessage,
      request.dueDate,
      request.companyInstructions,
      expiresAt
    );

    return {
      subject,
      body,
      htmlBody,
      checkLink,
      linkToken,
      expiresAt
    };
  }

  /**
   * Generate secure link token for verification
   */
  private generateSecureLinkToken(ticketId: string, workerId: string): string {
    const crypto = require('crypto');
    const secret = process.env.JWT_SECRET || 'gpnet-health-checks-2024';
    const payload = `${ticketId}:${workerId}:${Date.now()}`;
    
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate ticket-aware JotForm link with embedded context
   */
  private generateTicketAwareJotFormLink(
    check: Check,
    ticketId: string,
    linkToken: string
  ): string {
    const formId = check.checkUrl.split('/').pop() || check.checkKey.replace(/_/g, '-');
    
    // Embed ticket information in JotForm link for seamless integration
    const params = new URLSearchParams({
      ticket_id: ticketId,
      check_key: check.checkKey,
      token: linkToken,
      source: 'gpnet_email',
      return_url: `${this.BASE_URL}/check-complete/${ticketId}`
    });

    return `${this.JOTFORM_BASE_URL}${formId}?${params.toString()}`;
  }

  /**
   * Generate professional email subject line
   */
  private generateEmailSubject(
    check: Check,
    worker: Worker,
    urgency: string
  ): string {
    const urgencyPrefix = urgency === 'urgent' ? '🚨 URGENT: ' : 
                         urgency === 'high' ? '⚡ High Priority: ' : '';
    
    const workerName = `${worker.firstName} ${worker.lastName}`;
    
    return `${urgencyPrefix}Health Check Required - ${check.displayName} for ${workerName}`;
  }

  /**
   * Generate comprehensive email content (text and HTML)
   */
  private generateEmailContent(
    ticket: Ticket,
    worker: Worker,
    check: Check,
    checkLink: string,
    customMessage?: string,
    dueDate?: Date,
    companyInstructions?: string,
    expiresAt?: Date
  ): { body: string; htmlBody: string } {
    const workerName = `${worker.firstName} ${worker.lastName}`;
    const dueDateText = dueDate ? 
      `Please complete this by ${dueDate.toLocaleDateString('en-AU', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}.` : '';
    
    const expiryText = expiresAt ? 
      `This link will expire on ${expiresAt.toLocaleDateString('en-AU', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}.` : '';

    // Generate text version
    const body = `
Dear ${workerName},

As part of your employment process, you are required to complete a health assessment.

HEALTH CHECK DETAILS:
• Assessment Type: ${check.displayName}
• Case Reference: ${ticket.id}
• Description: ${check.description || 'Pre-employment health screening'}

${customMessage ? `ADDITIONAL INFORMATION:\n${customMessage}\n` : ''}

${companyInstructions ? `COMPANY INSTRUCTIONS:\n${companyInstructions}\n` : ''}

WHAT YOU NEED TO DO:
1. Click the secure link below to access your health check form
2. Complete all required sections accurately and honestly  
3. Upload any requested medical documentation
4. Submit the form to complete your assessment

SECURE HEALTH CHECK LINK:
${checkLink}

IMPORTANT INFORMATION:
• ${dueDateText || 'Please complete this assessment as soon as possible.'}
• ${expiryText}
• This link is unique to you and should not be shared
• All information provided is confidential and secure
• If you have questions, please contact GPNet Health Assessment Services

Thank you for your cooperation.

Best regards,
GPNet Health Assessment Services
Phone: 1800 GP NET (1800 476 368)
Email: support@gpnet.com.au
Web: www.gpnet.com.au

---
This is an automated message from GPNet Case Management System.
Case ID: ${ticket.id}
`.trim();

    // Generate HTML version
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Check Required - ${check.displayName}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px;
        }
        .greeting {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 25px;
        }
        .check-details {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #3b82f6;
        }
        .check-details h3 {
            color: #1f2937;
            margin-top: 0;
            margin-bottom: 15px;
        }
        .detail-item {
            margin: 8px 0;
            color: #4b5563;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
        }
        .custom-message, .company-instructions {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        .company-instructions {
            background: #e0e7ff;
            border-color: #6366f1;
        }
        .instructions {
            background: #ecfdf5;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
        }
        .instructions h3 {
            color: #065f46;
            margin-top: 0;
        }
        .instructions ol {
            color: #047857;
            padding-left: 20px;
        }
        .instructions li {
            margin: 12px 0;
        }
        .cta-button {
            display: block;
            width: fit-content;
            margin: 30px auto;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
            transition: transform 0.2s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(5, 150, 105, 0.4);
        }
        .important-info {
            background: #fef2f2;
            border: 1px solid #fca5a5;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        .important-info h3 {
            color: #dc2626;
            margin-top: 0;
        }
        .important-info ul {
            color: #991b1b;
            margin: 10px 0;
        }
        .footer {
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            padding: 25px 40px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .contact-info {
            margin: 15px 0;
        }
        .contact-info a {
            color: #3b82f6;
            text-decoration: none;
        }
        .case-id {
            font-family: monospace;
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Health Check Required</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                Dear <strong>${workerName}</strong>,
            </div>
            
            <p>As part of your employment process, you are required to complete a health assessment.</p>
            
            <div class="check-details">
                <h3>📋 Health Check Details</h3>
                <div class="detail-item">
                    <span class="detail-label">Assessment Type:</span> ${check.displayName}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Case Reference:</span> <span class="case-id">${ticket.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Description:</span> ${check.description || 'Pre-employment health screening'}
                </div>
            </div>

            ${customMessage ? `
            <div class="custom-message">
                <h3>📝 Additional Information</h3>
                <p>${customMessage.replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}

            ${companyInstructions ? `
            <div class="company-instructions">
                <h3>🏢 Company Instructions</h3>
                <p>${companyInstructions.replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}
            
            <div class="instructions">
                <h3>✅ What You Need To Do</h3>
                <ol>
                    <li>Click the secure link below to access your health check form</li>
                    <li>Complete all required sections accurately and honestly</li>
                    <li>Upload any requested medical documentation</li>
                    <li>Submit the form to complete your assessment</li>
                </ol>
            </div>
            
            <a href="${checkLink}" class="cta-button">
                🔐 Start Health Check
            </a>
            
            <div class="important-info">
                <h3>⚠️ Important Information</h3>
                <ul>
                    <li>${dueDateText || 'Please complete this assessment as soon as possible.'}</li>
                    <li>${expiryText}</li>
                    <li>This link is unique to you and should not be shared</li>
                    <li>All information provided is confidential and secure</li>
                    <li>If you have questions, please contact GPNet Health Assessment Services</li>
                </ul>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
                Thank you for your cooperation.
            </p>
        </div>
        
        <div class="footer">
            <div><strong>GPNet Health Assessment Services</strong></div>
            <div class="contact-info">
                <div>📞 Phone: <a href="tel:1800476368">1800 GP NET (1800 476 368)</a></div>
                <div>📧 Email: <a href="mailto:support@gpnet.com.au">support@gpnet.com.au</a></div>
                <div>🌐 Web: <a href="https://www.gpnet.com.au">www.gpnet.com.au</a></div>
            </div>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                This is an automated message from GPNet Case Management System.<br>
                Case ID: <span class="case-id">${ticket.id}</span>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    return { body, htmlBody };
  }

  /**
   * Create and save email draft to database
   */
  async createEmailDraft(request: EmailDraftRequest): Promise<string> {
    try {
      // Generate the email draft
      const draft = await this.generateEmailDraft(request);
      
      // Save to database - store HTML version as body for consistency
      const emailDraft = await storage.createEmailDraft({
        ticketId: request.ticketId,
        workerId: request.workerId,
        checkId: request.checkId,
        managerId: null, // Will be set when manager is determined
        subject: draft.subject,
        body: draft.htmlBody, // Store HTML version as primary body (schema expects HTML)
        checkLink: draft.checkLink,
        status: 'draft',
        managerEmail: request.managerEmail,
        expiresAt: draft.expiresAt,
        linkToken: draft.linkToken
      });

      return emailDraft.id;
    } catch (error) {
      console.error('Failed to create email draft:', error);
      throw new Error('Failed to create email draft');
    }
  }

  /**
   * Retrieve email draft by ID with full context
   */
  async getEmailDraftWithContext(draftId: string) {
    const draft = await storage.getEmailDraft(draftId);
    if (!draft) {
      throw new Error('Email draft not found');
    }

    // Fetch related data for context
    const [ticket, worker, check] = await Promise.all([
      storage.getTicket(draft.ticketId),
      storage.getWorker(draft.workerId),
      storage.getCheckById(draft.checkId)
    ]);

    return {
      draft,
      ticket,
      worker,
      check
    };
  }

  /**
   * Update draft status (e.g., when sent to worker)
   */
  async updateDraftStatus(draftId: string, status: 'draft' | 'sent' | 'expired') {
    const updateData: any = { status };
    
    if (status === 'sent') {
      updateData.forwardedToWorkerAt = new Date();
    }

    return storage.updateEmailDraft(draftId, updateData);
  }
}

// Export singleton instance
export const emailDraftingService = new EmailDraftingService();
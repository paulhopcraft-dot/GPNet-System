import { IStorage } from './storage';
import { emailService } from './emailService';
import fs from 'fs/promises';
import path from 'path';

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || '/replit-objstore-5077d17e-4a75-4767-a85c-e8248f3fb83e/.private';

/**
 * Report Delivery Scheduler
 * Runs every 15 minutes to check for reports ready for email delivery (1 hour after generation)
 */
export class ReportDeliveryScheduler {
  private storage: IStorage;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Start the report delivery scheduler
   */
  start(): void {
    if (this.schedulerInterval) {
      console.log('Report delivery scheduler already running');
      return;
    }

    console.log('Starting report delivery scheduler (checks every 15 minutes)');
    
    // Run immediately on startup
    this.runDeliveryCheck();
    
    // Then run every 15 minutes
    this.schedulerInterval = setInterval(async () => {
      await this.runDeliveryCheck();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('Report delivery scheduler stopped');
    }
  }

  /**
   * Check for reports ready for email delivery
   */
  private async runDeliveryCheck(): Promise<void> {
    try {
      console.log(`[${new Date().toISOString()}] Checking for reports ready for email delivery...`);
      
      const pendingReports = await this.storage.getPendingReportsForEmail();
      
      if (pendingReports.length === 0) {
        console.log('No reports ready for email delivery');
        return;
      }

      console.log(`Found ${pendingReports.length} report(s) ready for delivery`);

      for (const report of pendingReports) {
        try {
          await this.deliverReport(report);
        } catch (error) {
          console.error(`Failed to deliver report ${report.id}:`, error);
          // Update report status to failed
          await this.storage.updateReport(report.id, {
            status: 'failed',
            metadata: {
              ...(report.metadata || {}),
              error: error instanceof Error ? error.message : 'Unknown error',
              failedAt: new Date().toISOString()
            }
          });
        }
      }

      console.log('Report delivery check completed');
    } catch (error) {
      console.error('Error in report delivery check:', error);
    }
  }

  /**
   * Deliver a single report via email
   */
  private async deliverReport(report: any): Promise<void> {
    console.log(`Delivering report ${report.id} for ticket ${report.ticketId}`);

    // Get ticket details
    const ticket = await this.storage.getTicket(report.ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${report.ticketId} not found`);
    }

    // Get organization and determine recipient email
    let recipientEmail = process.env.MANAGER_EMAIL || 'manager@company.com';
    let organization = null;
    
    if (ticket.organizationId) {
      organization = await this.storage.getOrganization(ticket.organizationId);
      // Use organization-specific manager email if available
      // Future: Add manager/contact email to organization settings
    }

    // Load PDF from object storage with error handling
    let pdfBuffer: Buffer;
    try {
      const pdfPath = path.join(PRIVATE_OBJECT_DIR, report.storageKey);
      pdfBuffer = await fs.readFile(pdfPath);
    } catch (error) {
      throw new Error(`Failed to load PDF from storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Send email with PDF attachment
    const metadata = report.metadata || {};
    const emailResult = await emailService.sendReportEmail({
      reportType: report.reportType,
      ticketId: report.ticketId,
      recipients: [
        { 
          email: recipientEmail,
          name: 'Site Manager'
        }
      ],
      pdfBuffer: pdfBuffer,
      includeComplianceNote: true
    }, this.storage);

    if (emailResult.success) {
      console.log(`Report ${report.id} delivered successfully to ${recipientEmail}`);
      
      // Update report status to sent
      await this.storage.updateReport(report.id, {
        status: 'sent',
        emailSentAt: new Date(),
        emailRecipient: recipientEmail,
        metadata: {
          ...metadata,
          sentAt: new Date().toISOString(),
          sentTo: recipientEmail
        }
      });
    } else {
      // Email failed - mark as failed to prevent retry loop
      const errorMsg = emailResult.error || 'Email delivery failed';
      console.error(`Report ${report.id} email failed: ${errorMsg}`);
      await this.storage.updateReport(report.id, {
        status: 'failed',
        metadata: {
          ...metadata,
          error: errorMsg,
          failedAt: new Date().toISOString(),
          attemptedRecipient: recipientEmail
        }
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; nextCheck?: Date; checkInterval: number } {
    return {
      isRunning: this.schedulerInterval !== null,
      nextCheck: this.schedulerInterval ? new Date(Date.now() + this.CHECK_INTERVAL) : undefined,
      checkInterval: this.CHECK_INTERVAL
    };
  }

  /**
   * Manually trigger a delivery check (for testing/admin purposes)
   */
  async triggerManualCheck(): Promise<void> {
    console.log('Manual report delivery check triggered');
    await this.runDeliveryCheck();
  }
}

// Export factory function
export const createReportDeliveryScheduler = (storage: IStorage) => {
  return new ReportDeliveryScheduler(storage);
};

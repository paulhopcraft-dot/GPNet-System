import type { IStorage } from './storage.js';
import type { MedicalDocument, ReminderSchedule } from '@shared/schema';
import { chatWithMichelle, type UserContext } from './michelleService.js';

/**
 * Medical Certificate Reminder Service
 * Handles 7-day expiry reminders and capacity change detection
 */
export class MedicalCertificateReminderService {
  private storage: IStorage;
  private readonly REMINDER_DAYS_BEFORE_EXPIRY = 7;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Check for medical certificates expiring in 7 days and create reminders
   * Called by background job scheduler
   */
  async checkExpiringCertificates(): Promise<void> {
    console.log('Checking for medical certificates expiring in 7 days...');
    
    try {
      // Calculate target date (7 days from now)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + this.REMINDER_DAYS_BEFORE_EXPIRY);
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Get all current medical certificates with expiry dates
      const expiringCertificates = await this.getExpiringCertificates(targetDateStr);

      console.log(`Found ${expiringCertificates.length} certificates expiring on ${targetDateStr}`);

      for (const certificate of expiringCertificates) {
        await this.processExpiringCertificate(certificate);
      }

    } catch (error) {
      console.error('Error checking expiring certificates:', error);
      throw error;
    }
  }

  /**
   * Get medical certificates expiring on specific date
   */
  private async getExpiringCertificates(expiryDate: string): Promise<MedicalDocument[]> {
    try {
      // Get all medical documents and filter for expiring certificates
      // Note: In a real implementation, this would use a proper query with date filtering
      const allTickets = await this.storage.getAllTickets();
      const expiringCertificates: MedicalDocument[] = [];
      
      for (const ticket of allTickets) {
        const ticketDocs = await this.storage.getMedicalDocumentsByTicket(ticket.id);
        const expiring = ticketDocs.filter(doc => 
          doc.isCurrentCertificate && 
          doc.validTo === expiryDate &&
          doc.kind === 'medical_certificate' &&
          doc.processingStatus === 'completed'
        );
        expiringCertificates.push(...expiring);
      }
      
      return expiringCertificates;
    } catch (error) {
      console.error('Error getting expiring certificates:', error);
      return [];
    }
  }

  /**
   * Process a single expiring certificate - create reminder and generate Michelle summary
   */
  private async processExpiringCertificate(certificate: MedicalDocument): Promise<void> {
    try {
      // Get ticket and worker info
      const ticket = await this.storage.getTicket(certificate.ticketId);
      const worker = await this.storage.getWorker(certificate.workerId);
      
      if (!ticket || !worker) {
        console.warn(`Missing ticket or worker data for certificate ${certificate.id}`);
        return;
      }

      console.log(`Processing expiring certificate for worker ${worker.name} (Ticket: ${ticket.id})`);

      // Check if reminder already exists for this certificate
      const existingReminder = await this.findExistingCertificateReminder(certificate.ticketId, certificate.id);
      if (existingReminder) {
        console.log(`Reminder already exists for certificate ${certificate.id}`);
        return;
      }

      // Create 7-day reminder
      await this.createCertificateExpiryReminder(ticket, worker, certificate);

      // Generate Michelle capacity summary if this is a capacity change
      await this.generateCapacityChangeSummary(certificate);

      // Update timeline - create an audit event for tracking
      await this.storage.createAuditEvent({
        companyId: ticket.companyId || '',
        actorId: "system",
        actorName: "Medical Certificate Reminder Service",
        eventType: "medical_certificate_reminder",
        objectType: "medical_certificate",
        objectId: certificate.id,
        summary: `MC Reminder – 7 days before expiry (${certificate.validTo})`,
        details: {
          certificateId: certificate.id,
          expiryDate: certificate.validTo,
          reminderType: "7_day_expiry",
          ticketId: ticket.id
        }
      });

    } catch (error) {
      console.error(`Error processing expiring certificate ${certificate.id}:`, error);
    }
  }

  /**
   * Check if reminder already exists for this certificate expiry
   */
  private async findExistingCertificateReminder(ticketId: string, certificateId: string): Promise<ReminderSchedule | null> {
    try {
      const reminders = await this.storage.getRemindersByTicket(ticketId);
      
      return reminders.find(reminder => 
        reminder.checkType === 'medical_certificate' &&
        reminder.emailSubject.includes(certificateId) &&
        reminder.status !== 'cancelled'
      ) || null;
    } catch (error) {
      console.error('Error finding existing reminder:', error);
      return null;
    }
  }

  /**
   * Create reminder for certificate expiry
   */
  private async createCertificateExpiryReminder(ticket: any, worker: any, certificate: MedicalDocument): Promise<void> {
    // Schedule reminder to be sent immediately (since we already detected it's 7 days before expiry)
    const scheduledDate = new Date();

    const emailSubject = `Medical Certificate Renewal Required - Expires ${certificate.validTo} [${certificate.id}]`;
    const emailBody = this.generateReminderEmailBody(worker, certificate);

    // Create reminder for worker
    await this.storage.createReminderSchedule({
      ticketId: ticket.id,
      checkType: 'medical_certificate',
      recipientEmail: worker.email,
      recipientName: worker.name,
      reminderNumber: 1,
      scheduledFor: scheduledDate,
      emailSubject,
      emailBody,
      managerAlertRequired: false,
      isManagerAlert: false
    });

    console.log(`Created certificate expiry reminder for ${worker.name}, scheduled for immediate sending`);
  }

  /**
   * Generate reminder email body
   */
  private generateReminderEmailBody(worker: any, certificate: MedicalDocument): string {
    return `Dear ${worker.name},

Your medical certificate is due to expire on ${certificate.validTo}. To ensure continuity of your work capacity assessment, please:

1. Schedule an appointment with your treating doctor
2. Request an updated medical certificate
3. Submit the new certificate to your employer or HR department

Current Certificate Details:
- Doctor: ${certificate.doctorName || 'Not specified'}
- Capacity Status: ${certificate.fitStatus || 'Not specified'}
- Expiry Date: ${certificate.validTo}

If you have any questions or need assistance, please contact your manager or HR department.

Best regards,
GPNet Pre-Employment Health System`;
  }

  /**
   * Generate Michelle summary for capacity changes
   */
  private async generateCapacityChangeSummary(certificate: MedicalDocument): Promise<void> {
    try {
      // Get previous certificates for this worker to detect capacity changes
      const workerCertificates = await this.storage.getMedicalDocumentsByWorker(certificate.workerId);
      
      // Find previous certificate
      const previousCerts = workerCertificates
        .filter(cert => 
          cert.id !== certificate.id &&
          cert.kind === 'medical_certificate' &&
          cert.validTo &&
          new Date(cert.validTo) < new Date(certificate.validTo || '1900-01-01')
        )
        .sort((a, b) => new Date(b.validTo || '1900-01-01').getTime() - new Date(a.validTo || '1900-01-01').getTime());

      if (previousCerts.length === 0) {
        console.log('No previous certificate found for comparison');
        return;
      }

      const previousCert = previousCerts[0];
      
      // Detect capacity change
      const capacityChange = this.detectCapacityChange(previousCert, certificate);
      
      if (capacityChange.hasChanged) {
        // Generate Michelle summary
        const summary = await this.generateMichelleSummary(previousCert, certificate, capacityChange);
        
        // Save to conversation history
        await this.saveMichelleSummary(certificate.ticketId, summary);
        
        console.log(`Generated Michelle capacity change summary for certificate ${certificate.id}`);
      }

    } catch (error) {
      console.error('Error generating capacity change summary:', error);
    }
  }

  /**
   * Detect capacity changes between certificates
   */
  private detectCapacityChange(previousCert: MedicalDocument, currentCert: MedicalDocument): {
    hasChanged: boolean;
    changeType: 'improvement' | 'degradation' | 'status_change' | 'none';
    details: string;
  } {
    // Compare fit status
    const prevStatus = previousCert.fitStatus;
    const currentStatus = currentCert.fitStatus;

    if (prevStatus !== currentStatus) {
      if (prevStatus === 'unfit' && currentStatus !== 'unfit') {
        return {
          hasChanged: true,
          changeType: 'improvement',
          details: `Capacity improved from ${prevStatus} to ${currentStatus}`
        };
      } else if (prevStatus !== 'unfit' && currentStatus === 'unfit') {
        return {
          hasChanged: true,
          changeType: 'degradation',
          details: `Capacity deteriorated from ${prevStatus} to ${currentStatus}`
        };
      } else {
        return {
          hasChanged: true,
          changeType: 'status_change',
          details: `Capacity status changed from ${prevStatus} to ${currentStatus}`
        };
      }
    }

    // Compare restrictions
    const prevRestrictions = previousCert.restrictions || '';
    const currentRestrictions = currentCert.restrictions || '';

    if (prevRestrictions !== currentRestrictions) {
      return {
        hasChanged: true,
        changeType: 'status_change',
        details: 'Work restrictions have been modified'
      };
    }

    return {
      hasChanged: false,
      changeType: 'none',
      details: 'No significant capacity changes detected'
    };
  }

  /**
   * Generate Michelle AI summary for capacity changes
   */
  private async generateMichelleSummary(
    previousCert: MedicalDocument, 
    currentCert: MedicalDocument, 
    change: any
  ): Promise<string> {
    const prompt = `Analyze the capacity change between two medical certificates:

PREVIOUS CERTIFICATE:
- Fit Status: ${previousCert.fitStatus}
- Restrictions: ${previousCert.restrictions || 'None'}
- Valid From: ${previousCert.validFrom}
- Valid To: ${previousCert.validTo}

CURRENT CERTIFICATE:
- Fit Status: ${currentCert.fitStatus}
- Restrictions: ${currentCert.restrictions || 'None'}
- Valid From: ${currentCert.validFrom}
- Valid To: ${currentCert.validTo}

DETECTED CHANGE: ${change.details}

Provide a brief, professional summary of the capacity change and its implications for workplace management in 2-3 sentences.`;

    try {
      const summary = await michelleService.generateResponse(prompt, currentCert.ticketId, {
        mode: 'medical_analysis',
        isUrgent: change.changeType === 'degradation'
      });

      return `**Capacity Change Detected**\n\n${summary}`;
    } catch (error) {
      console.error('Error generating Michelle summary:', error);
      return `**Capacity Change Detected**\n\n${change.details}. Please review the updated certificate for workplace implications.`;
    }
  }

  /**
   * Save Michelle summary to conversation history
   */
  private async saveMichelleSummary(ticketId: string, summary: string): Promise<void> {
    try {
      // Get or create conversation
      let conversation = await this.storage.getConversationByTicket(ticketId);
      
      if (!conversation) {
        conversation = await this.storage.createConversation({
          ticketId,
          title: 'Medical Certificate Analysis',
          status: 'active'
        });
      }

      // Add Michelle message
      await this.storage.createConversationMessage({
        conversationId: conversation.id,
        ticketId,
        sender: 'michelle',
        content: summary,
        messageType: 'medical_analysis'
      });

    } catch (error) {
      console.error('Error saving Michelle summary:', error);
    }
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus(): { isEnabled: boolean; lastCheck?: Date; certificatesChecked: number } {
    return {
      isEnabled: true,
      lastCheck: new Date(),
      certificatesChecked: 0 // Could track this with instance variables
    };
  }
}

// Export factory function for proper initialization
export const createMedicalCertificateReminderService = (storage: IStorage) => {
  return new MedicalCertificateReminderService(storage);
};
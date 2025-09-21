import { documentProcessingService } from './documentProcessingService.js';
import type { IStorage } from './storage.js';

export interface FreshdeskWebhookEvent {
  type: 'ticket_created' | 'ticket_updated' | 'note_added';
  ticket: {
    id: number;
    subject: string;
    status: number;
    priority: number;
    requester_id: number;
    company_id?: number;
    attachments?: Array<{
      id: number;
      name: string;
      content_type: string;
      size: number;
      attachment_url: string;
    }>;
  };
  requester?: {
    id: number;
    name: string;
    email: string;
  };
  time_stamp: string;
}

export interface AttachmentProcessingJob {
  ticketId: string;
  attachmentUrl: string;
  companyId?: string;
  requesterEmail?: string;
  freshdeskTicketId: number;
  attachmentId: number;
  filename: string;
  contentType: string;
  size: number;
}

export class FreshdeskWebhookService {
  constructor(private storage: IStorage) {}

  /**
   * Process incoming Freshdesk webhook for new attachments
   */
  async processWebhook(event: FreshdeskWebhookEvent): Promise<void> {
    console.log(`Processing Freshdesk webhook: ${event.type} for ticket ${event.ticket.id}`);

    try {
      // Only process events with attachments
      if (!event.ticket.attachments || event.ticket.attachments.length === 0) {
        console.log('No attachments found in webhook event');
        return;
      }

      // Find or create ticket mapping
      const gpnetTicketId = await this.findOrCreateTicketMapping(event);
      if (!gpnetTicketId) {
        console.warn('Could not create or find GPNet ticket mapping');
        return;
      }

      // Process each attachment
      for (const attachment of event.ticket.attachments) {
        await this.processAttachment(gpnetTicketId, event, attachment);
      }

    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  /**
   * Process individual attachment from webhook
   */
  private async processAttachment(
    gpnetTicketId: string,
    event: FreshdeskWebhookEvent,
    attachment: any
  ): Promise<void> {
    
    // Check if attachment is a medical document
    if (!this.isMedicalDocument(attachment.name, attachment.content_type)) {
      console.log(`Skipping non-medical attachment: ${attachment.name}`);
      return;
    }

    console.log(`Processing medical attachment: ${attachment.name} (${attachment.content_type})`);

    try {
      // Download attachment
      const attachmentData = await this.downloadAttachment(attachment.attachment_url);
      
      // Get worker ID from ticket
      const ticket = await this.storage.getTicket(gpnetTicketId);
      if (!ticket || !ticket.workerId) {
        console.warn(`No worker ID found for ticket ${gpnetTicketId}`);
        return;
      }

      // Create processing job
      const job: AttachmentProcessingJob = {
        ticketId: gpnetTicketId,
        attachmentUrl: attachment.attachment_url,
        companyId: event.ticket.company_id?.toString(),
        requesterEmail: event.requester?.email,
        freshdeskTicketId: event.ticket.id,
        attachmentId: attachment.id,
        filename: attachment.name,
        contentType: attachment.content_type,
        size: attachment.size
      };

      // Enqueue for processing
      await this.enqueueDocumentProcessing(job, ticket.workerId, attachmentData);

    } catch (error) {
      console.error(`Failed to process attachment ${attachment.name}:`, error);
    }
  }

  /**
   * Check if attachment is likely a medical document
   */
  private isMedicalDocument(filename: string, contentType: string): boolean {
    // Check content type
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!supportedTypes.includes(contentType.toLowerCase())) {
      return false;
    }

    // Check filename for medical keywords
    const medicalKeywords = [
      'certificate', 'cert', 'medical', 'doctor', 'diagnosis', 'report',
      'fitness', 'capacity', 'clearance', 'restriction', 'workcover',
      'injury', 'assessment', 'specialist', 'radiology', 'xray', 'scan'
    ];

    const filename_lower = filename.toLowerCase();
    return medicalKeywords.some(keyword => filename_lower.includes(keyword));
  }

  /**
   * Download attachment from Freshdesk
   */
  private async downloadAttachment(url: string): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
    size: number;
  }> {
    // Add Freshdesk authentication
    const auth = Buffer.from(`${process.env.FRESHDESK_API_KEY}:X`).toString('base64');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'GPNet Medical Document Processor'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Extract filename from URL or use default
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] || 'attachment';

    return {
      buffer,
      filename,
      contentType,
      size: buffer.length
    };
  }

  /**
   * Find existing GPNet ticket or create mapping
   */
  private async findOrCreateTicketMapping(event: FreshdeskWebhookEvent): Promise<string | null> {
    try {
      // Check if we already have a ticket mapping
      const existingMapping = await this.findTicketByFreshdeskId(event.ticket.id);
      if (existingMapping) {
        return existingMapping.id;
      }

      // Try to find ticket by requester email or other identifiers
      if (event.requester?.email) {
        const workerByEmail = await this.findWorkerByEmail(event.requester.email);
        if (workerByEmail) {
          // Find open ticket for this worker
          const openTickets = await this.findOpenTicketsForWorker(workerByEmail.id);
          if (openTickets.length > 0) {
            // Update existing ticket with Freshdesk mapping
            await this.linkTicketToFreshdesk(openTickets[0].id, event.ticket.id);
            return openTickets[0].id;
          }
        }
      }

      // Create new ticket for unknown requester
      const newTicket = await this.createTicketFromFreshdesk(event);
      return newTicket?.id || null;

    } catch (error) {
      console.error('Failed to find or create ticket mapping:', error);
      return null;
    }
  }

  /**
   * Create new GPNet ticket from Freshdesk event
   */
  private async createTicketFromFreshdesk(event: FreshdeskWebhookEvent): Promise<any | null> {
    try {
      // Create worker if doesn't exist
      let worker = null;
      if (event.requester?.email) {
        worker = await this.findWorkerByEmail(event.requester.email);
        
        if (!worker) {
          worker = await this.createWorkerFromRequester(event.requester);
        }
      }

      if (!worker) {
        console.warn('Cannot create ticket without worker information');
        return null;
      }

      // Create ticket
      const ticket = await this.storage.createTicket({
        workerId: worker.id,
        caseType: 'injury', // Assume injury case for Freshdesk attachments
        status: 'NEW',
        priority: this.mapFreshdeskPriority(event.ticket.priority),
        fdId: event.ticket.id,
        subject: event.ticket.subject,
        companyName: event.ticket.company_id?.toString(),
        nextStep: 'Process medical documentation from Freshdesk'
      });

      console.log(`Created new ticket ${ticket.id} from Freshdesk ticket ${event.ticket.id}`);
      return ticket;

    } catch (error) {
      console.error('Failed to create ticket from Freshdesk:', error);
      return null;
    }
  }

  /**
   * Create worker from Freshdesk requester
   */
  private async createWorkerFromRequester(requester: any): Promise<any> {
    const names = (requester.name || '').split(' ');
    const firstName = names[0] || 'Unknown';
    const lastName = names.slice(1).join(' ') || 'Worker';

    return await this.storage.createWorker({
      firstName,
      lastName,
      email: requester.email,
      phone: '',
      dateOfBirth: '1900-01-01', // Placeholder
      roleApplied: 'Worker',
      site: null
    });
  }

  /**
   * Enqueue document for processing
   */
  private async enqueueDocumentProcessing(
    job: AttachmentProcessingJob,
    workerId: string,
    attachmentData: any
  ): Promise<void> {
    console.log(`Enqueueing document processing for ${job.filename}`);

    // Process immediately (in production, this would go to a queue)
    const result = await documentProcessingService.processAttachment(
      job.ticketId,
      workerId,
      {
        url: job.attachmentUrl,
        filename: job.filename,
        contentType: job.contentType,
        size: job.size,
        buffer: attachmentData.buffer
      },
      job.attachmentId.toString(),
      job.companyId,
      job.requesterEmail
    );

    if (result.success) {
      console.log(`Document processed successfully: ${result.documentId}`);
      
      // Add Freshdesk note about processing
      await this.addFreshdeskNote(job.freshdeskTicketId, result);
    } else {
      console.error(`Document processing failed: ${result.error}`);
    }
  }

  /**
   * Add note to Freshdesk ticket about processing result
   */
  private async addFreshdeskNote(freshdeskTicketId: number, result: any): Promise<void> {
    try {
      const { freshdeskService } = await import('./freshdeskService.js');
      
      if (!freshdeskService.isAvailable()) {
        return;
      }

      let noteContent = '';
      if (result.success) {
        noteContent = `Medical certificate processed automatically. Status: ${result.requiresReview ? 'Requires manual review' : 'Completed'}`;
        if (result.documentId) {
          noteContent += `\nDocument ID: ${result.documentId}`;
        }
      } else {
        noteContent = `Medical certificate processing failed: ${result.error}`;
      }

      await freshdeskService.addPrivateNote(freshdeskTicketId.toString(), noteContent);
      
    } catch (error) {
      console.error('Failed to add Freshdesk note:', error);
    }
  }

  /**
   * Helper methods that would use the storage interface
   */
  private async findTicketByFreshdeskId(freshdeskId: number): Promise<any | null> {
    // Implementation would query tickets table by fdId
    return null;
  }

  private async findWorkerByEmail(email: string): Promise<any | null> {
    // Implementation would query workers table by email
    return null;
  }

  private async findOpenTicketsForWorker(workerId: string): Promise<any[]> {
    // Implementation would query open tickets for worker
    return [];
  }

  private async linkTicketToFreshdesk(ticketId: string, freshdeskId: number): Promise<void> {
    // Implementation would update ticket with fdId
  }

  private mapFreshdeskPriority(priority: number): string {
    switch (priority) {
      case 4: return 'urgent';
      case 3: return 'high';
      case 2: return 'medium';
      case 1: 
      default: return 'low';
    }
  }

  /**
   * Validate webhook signature (security)
   */
  static validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      // Compare signatures using constant-time comparison to prevent timing attacks
      const actualSignature = signature.replace('sha256=', '');
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(actualSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook signature validation error:', error);
      return false;
    }
  }

  /**
   * Get service status
   */
  static getServiceInfo() {
    return {
      serviceName: 'Freshdesk Webhook Service',
      capabilities: [
        'Webhook event processing',
        'Medical attachment detection',
        'Automatic document processing',
        'Ticket mapping',
        'Freshdesk integration'
      ],
      supportedEvents: ['ticket_created', 'ticket_updated', 'note_added']
    };
  }
}

// Create and export singleton instance - will be properly initialized in routes.ts
export let freshdeskWebhookService: FreshdeskWebhookService;

export function initFreshdeskWebhookService(storage: IStorage): FreshdeskWebhookService {
  if (!freshdeskWebhookService) {
    freshdeskWebhookService = new FreshdeskWebhookService(storage);
  }
  return freshdeskWebhookService;
}
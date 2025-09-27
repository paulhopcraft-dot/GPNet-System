import { freshdeskService } from './freshdeskService.js';
import { freshdeskDocumentService } from './freshdeskDocumentService.js';
import { storage } from './storage.js';

/**
 * Service for backfilling document attachments from Freshdesk
 * Processes existing tickets to extract and embed medical report attachments
 */
export class FreshdeskBackfillService {
  
  /**
   * Backfill all ticket attachments from Freshdesk
   */
  async backfillAllTicketAttachments(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    console.log('🔄 Starting Freshdesk document backfill...');
    
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Use real Freshdesk API to get all tickets with attachments
      if (!freshdeskService.isAvailable()) {
        throw new Error('Freshdesk integration not configured. Please set FRESHDESK_API_KEY and FRESHDESK_DOMAIN environment variables.');
      }
      
      console.log('📋 Fetching all tickets from Freshdesk API...');
      const allTickets = await freshdeskService.fetchAllTickets();
      console.log(`Processing ${allTickets.length} tickets from Freshdesk`);

      for (const fdTicket of allTickets) {
        try {
          results.processed++;
          console.log(`\n🎫 Processing Freshdesk ticket ${fdTicket.id}: ${fdTicket.subject}`);

          // Find or create corresponding GPNet ticket
          const gpnetTicket = await this.findOrCreateGPNetTicket(fdTicket);
          
          // Process attachments for this ticket
          const attachmentResult = await freshdeskDocumentService.processTicketAttachments(
            fdTicket.id.toString(),
            gpnetTicket.id
          );

          if (attachmentResult.processed > 0 || attachmentResult.errors.length === 0) {
            results.successful++;
            console.log(`✅ Successfully processed ${attachmentResult.processed} attachments for ticket ${fdTicket.id}`);
          } else {
            results.failed++;
            const errorMsg = `Failed to process attachments for ticket ${fdTicket.id}: ${attachmentResult.errors.join(', ')}`;
            results.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }

          // Add delay to avoid API rate limits
          await this.delay(1000);

        } catch (error) {
          results.failed++;
          const errorMsg = `Error processing ticket ${fdTicket.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log('\n📊 Freshdesk document backfill completed:');
      console.log(`   Processed: ${results.processed}`);
      console.log(`   Successful: ${results.successful}`);
      console.log(`   Failed: ${results.failed}`);
      
      return results;

    } catch (error) {
      const errorMsg = `Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
      return results;
    }
  }

  /**
   * Find existing GPNet ticket or create a new one from Freshdesk data
   */
  private async findOrCreateGPNetTicket(fdTicket: any): Promise<any> {
    // Try to find existing ticket by Freshdesk ID
    const existingTickets = await storage.getAllTickets();
    const existing = existingTickets.find(t => t.fdId === fdTicket.id.toString());
    
    if (existing) {
      console.log(`📋 Found existing GPNet ticket ${existing.id} for Freshdesk ticket ${fdTicket.id}`);
      return existing;
    }

    // Create new ticket based on Freshdesk data
    console.log(`📝 Creating new GPNet ticket for Freshdesk ticket ${fdTicket.id}`);
    
    // Extract worker info from Freshdesk ticket
    const workerName = this.extractWorkerName(fdTicket);
    const companyName = this.extractCompanyName(fdTicket);

    // Create worker if needed
    const worker = await this.findOrCreateWorker(workerName, fdTicket.requester_id?.toString());

    // Create the ticket
    const newTicket = await storage.createTicket({
      workerId: worker.id,
      caseType: this.extractIssueType(fdTicket),
      priority: this.mapPriority(fdTicket.priority),
      status: 'NEW',
      company: companyName,
      description: fdTicket.description || `Imported from Freshdesk ticket ${fdTicket.id}`,
      fdId: fdTicket.id.toString(),
      // Map other relevant fields
      nextStep: 'process_documents'
    });

    console.log(`✅ Created GPNet ticket ${newTicket.id} for Freshdesk ticket ${fdTicket.id}`);
    return newTicket;
  }

  /**
   * Find or create worker based on Freshdesk requester info
   */
  private async findOrCreateWorker(name: string, freshdeskRequesterId?: string): Promise<any> {
    // Try to find existing worker by name
    const existingTickets = await storage.getAllTickets();
    
    // Look for existing worker through existing tickets
    // In a real system, you'd have a proper worker lookup
    const defaultWorker = {
      id: `worker-${Date.now()}`,
      firstName: name.split(' ')[0] || 'Unknown',
      lastName: name.split(' ').slice(1).join(' ') || 'Worker',
      email: `worker-${freshdeskRequesterId || Date.now()}@example.com`,
      phone: '',
      dateOfBirth: new Date('1990-01-01'),
      emergencyContactName: '',
      emergencyContactPhone: ''
    };

    // For this implementation, just create a basic worker record
    // In production, you'd have more sophisticated worker matching
    const workerData = {
      firstName: defaultWorker.firstName,
      lastName: defaultWorker.lastName,
      email: defaultWorker.email,
      phone: defaultWorker.phone,
      dateOfBirth: defaultWorker.dateOfBirth.toISOString(),
      roleApplied: 'Unknown Role',
      emergencyContactName: defaultWorker.emergencyContactName,
      emergencyContactPhone: defaultWorker.emergencyContactPhone
    };
    
    try {
      const worker = await storage.createWorker(workerData);
      return worker;
    } catch (error) {
      console.warn('Worker creation failed, using mock worker');
      return { ...defaultWorker, id: 'mock-worker-id' };
    }
  }

  /**
   * Extract worker name from Freshdesk ticket
   */
  private extractWorkerName(fdTicket: any): string {
    // Try to extract from subject, description, or custom fields
    const subject = fdTicket.subject || '';
    const description = fdTicket.description || '';
    
    // Look for common patterns like "Pre-employment check for John Smith"
    const nameMatch = subject.match(/(?:for|check for|assessment for)\s+([A-Za-z\s]+)/i) ||
                      description.match(/(?:Name|Worker|Employee|Candidate):\s*([A-Za-z\s]+)/i);
    
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }

    // Fallback to requester info or generic name
    return `Worker-${fdTicket.id}`;
  }

  /**
   * Extract company name from Freshdesk ticket
   */
  private extractCompanyName(fdTicket: any): string {
    const subject = fdTicket.subject || '';
    const description = fdTicket.description || '';
    
    // Look for company patterns
    const companyMatch = subject.match(/(?:Company|Employer):\s*([A-Za-z\s&]+)/i) ||
                        description.match(/(?:Company|Organization|Employer):\s*([A-Za-z\s&]+)/i);
    
    if (companyMatch && companyMatch[1]) {
      return companyMatch[1].trim();
    }

    return 'Unknown Company';
  }

  /**
   * Extract issue type from Freshdesk ticket
   */
  private extractIssueType(fdTicket: any): string {
    const subject = fdTicket.subject?.toLowerCase() || '';
    
    if (subject.includes('pre-employment') || subject.includes('pre employment')) {
      return 'pre-employment';
    } else if (subject.includes('injury') || subject.includes('accident')) {
      return 'injury';
    } else if (subject.includes('return to work') || subject.includes('rtw')) {
      return 'return-to-work';
    }
    
    return 'general';
  }

  /**
   * Map Freshdesk priority to GPNet priority
   */
  private mapPriority(freshdeskPriority: number): string {
    switch (freshdeskPriority) {
      case 4: return 'urgent';
      case 3: return 'high';
      case 2: return 'medium';
      case 1: 
      default: return 'low';
    }
  }

  /**
   * Add delay for API rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const freshdeskBackfillService = new FreshdeskBackfillService();
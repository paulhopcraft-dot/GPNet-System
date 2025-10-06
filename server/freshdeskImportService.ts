import { freshdeskService, FreshdeskService } from './freshdeskService.js';
import type { IStorage } from './storage.js';

export interface FreshdeskImportResult {
  totalTickets: number;
  totalCompanies: number;
  ticketsByCompany: Record<string, {
    companyName: string;
    tickets: Array<{
      id: number;
      subject: string;
      status: string;
      priority: string;
      createdAt: string;
      ageDays: number;
    }>;
  }>;
  unmappedTickets: Array<{
    id: number;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    ageDays: number;
  }>;
  summary: {
    openTickets: number;
    pendingTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    avgTicketAge: number;
  };
}

export class FreshdeskImportService {
  constructor(private storage: IStorage) {}

  /**
   * Import and categorize all tickets from Freshdesk
   */
  async importAndCategorizeTickets(): Promise<FreshdeskImportResult> {
    console.log('Starting Freshdesk ticket import and categorization...');

    // First, check if Freshdesk is available
    if (!freshdeskService.isAvailable()) {
      throw new Error('Freshdesk integration not configured. Please set FRESHDESK_API_KEY and FRESHDESK_DOMAIN environment variables.');
    }

    try {
      // Fetch active tickets only (no spam/deleted tickets)
      console.log('Fetching active tickets from Freshdesk...');
      const [tickets, companies] = await Promise.all([
        freshdeskService.fetchAllTickets(undefined, true), // Include resolved tickets
        freshdeskService.fetchAllCompanies()
      ]);
      
      console.log(`Total active tickets: ${tickets.length}`);

      console.log(`Fetched ${tickets.length} tickets and ${companies.length} companies from Freshdesk`);

      // Create company lookup map
      const companyMap = new Map<number, { name: string; domains?: string[] }>();
      companies.forEach(company => {
        companyMap.set(company.id, {
          name: company.name,
          domains: company.domains || []
        });
      });

      // Process and categorize tickets
      const ticketsByCompany: Record<string, {
        companyName: string;
        tickets: Array<{
          id: number;
          subject: string;
          status: string;
          priority: string;
          createdAt: string;
          ageDays: number;
        }>;
      }> = {};

      const unmappedTickets: Array<{
        id: number;
        subject: string;
        status: string;
        priority: string;
        createdAt: string;
        ageDays: number;
      }> = [];

      // Summary counters
      let openTickets = 0;
      let pendingTickets = 0;
      let resolvedTickets = 0;
      let closedTickets = 0;
      let totalAge = 0;

      // Process each ticket
      tickets.forEach(ticket => {
        const ticketData = {
          id: ticket.id,
          subject: ticket.subject,
          status: FreshdeskService.mapStatusToString(ticket.status),
          priority: FreshdeskService.mapPriorityToString(ticket.priority),
          createdAt: ticket.created_at,
          ageDays: FreshdeskService.calculateTicketAge(ticket.created_at)
        };

        // Update summary counters
        switch (ticket.status) {
          case 2: openTickets++; break;
          case 3: pendingTickets++; break;
          case 4: resolvedTickets++; break;
          case 5: closedTickets++; break;
        }
        totalAge += ticketData.ageDays;

        // Categorize by company
        if (ticket.company_id && companyMap.has(ticket.company_id)) {
          const company = companyMap.get(ticket.company_id)!;
          const companyKey = ticket.company_id.toString();
          
          if (!ticketsByCompany[companyKey]) {
            ticketsByCompany[companyKey] = {
              companyName: company.name,
              tickets: []
            };
          }
          
          ticketsByCompany[companyKey].tickets.push(ticketData);
        } else {
          // No company associated or company not found
          unmappedTickets.push(ticketData);
        }
      });

      // Store the import results in our database for future reference
      await this.storeImportResults(tickets, companies);

      const result: FreshdeskImportResult = {
        totalTickets: tickets.length,
        totalCompanies: companies.length,
        ticketsByCompany,
        unmappedTickets,
        summary: {
          openTickets,
          pendingTickets,
          resolvedTickets,
          closedTickets,
          avgTicketAge: tickets.length > 0 ? Math.round(totalAge / tickets.length) : 0
        }
      };

      console.log('Freshdesk import completed successfully:', {
        totalTickets: result.totalTickets,
        totalCompanies: result.totalCompanies,
        companiesWithTickets: Object.keys(ticketsByCompany).length,
        unmappedTickets: unmappedTickets.length
      });

      return result;

    } catch (error) {
      console.error('Failed to import tickets from Freshdesk:', error);
      throw error;
    }
  }

  /**
   * Store import results in our database for future reference and sync
   */
  private async storeImportResults(tickets: any[], companies: any[]): Promise<void> {
    console.log('Storing import results in database...');

    try {
      // Store/update companies in our organizations table
      const orgMap = new Map<number, string>(); // Freshdesk ID -> GPNet org ID
      
      for (const company of companies) {
        try {
          // Check if organization already exists by Freshdesk company ID
          const existingOrg = await this.findOrganizationByFreshdeskId(company.id);
          
          if (existingOrg) {
            console.log(`Organization already exists: ${company.name}`);
            orgMap.set(company.id, existingOrg.id);
          } else {
            // Create new organization
            console.log(`Creating new organization: ${company.name}`);
            const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const newOrg = await this.storage.createOrganization({
              name: company.name,
              slug: slug + '-' + company.id, // Ensure uniqueness with Freshdesk ID
              freshdeskCompanyId: company.id,
              domains: company.domains || [],
              description: company.description || null
            });
            orgMap.set(company.id, newOrg.id);
          }
        } catch (error) {
          console.error(`Error processing company ${company.name}:`, error);
        }
      }

      // Store/update tickets in our tickets table
      for (const ticket of tickets) {
        try {
          // Check if ticket already exists by Freshdesk ticket ID
          const existingTicket = await this.findTicketByFreshdeskId(ticket.id);
          
          if (existingTicket) {
            console.log(`Ticket already exists: ${ticket.id}`);
            // Update organization linkage if changed
            const newOrgId = ticket.company_id && orgMap.has(ticket.company_id) 
              ? orgMap.get(ticket.company_id) 
              : null;
            if (newOrgId && existingTicket.organizationId !== newOrgId) {
              await this.storage.updateTicket(existingTicket.id, { 
                organizationId: newOrgId,
                fdCompanyId: ticket.company_id || null,
                companyName: companies.find((c: any) => c.id === ticket.company_id)?.name || existingTicket.companyName
              });
              console.log(`Updated organization for ticket ${ticket.id}`);
            } else if (!existingTicket.fdCompanyId && ticket.company_id) {
              // Populate fd_company_id if it's missing
              await this.storage.updateTicket(existingTicket.id, { 
                fdCompanyId: ticket.company_id 
              });
            }
          } else {
            // Create new ticket
            console.log(`Creating new ticket: ${ticket.id} - ${ticket.subject}`);
            
            // Map Freshdesk ticket to GPNet ticket
            const ticketData: any = {
              fdId: ticket.id,
              fdCompanyId: ticket.company_id || null,
              subject: ticket.subject,
              caseType: 'general', // Default to general, can be updated later
              status: this.mapFreshdeskStatus(ticket.status),
              priority: this.mapFreshdeskPriority(ticket.priority),
              companyName: ticket.company_id && orgMap.has(ticket.company_id) 
                ? companies.find((c: any) => c.id === ticket.company_id)?.name 
                : 'Unknown Company',
              organizationId: ticket.company_id && orgMap.has(ticket.company_id)
                ? orgMap.get(ticket.company_id)
                : null,
              requesterId: ticket.requester_id?.toString(),
              assigneeId: ticket.responder_id?.toString(),
              ageDays: FreshdeskService.calculateTicketAge(ticket.created_at),
              tagsJson: ticket.tags || [],
              customJson: ticket.custom_fields || {},
              createdAt: new Date(ticket.created_at),
              lastUpdateAt: new Date(ticket.updated_at)
            };

            await this.storage.createTicket(ticketData);
          }
        } catch (error) {
          console.error(`Error processing ticket ${ticket.id}:`, error);
        }
      }

      console.log('Import results stored successfully');

    } catch (error) {
      console.error('Error storing import results:', error);
      // Don't throw - we still want to return the results even if storage fails
    }
  }

  /**
   * Map Freshdesk status to GPNet status
   */
  private mapFreshdeskStatus(freshdeskStatus: number): string {
    switch (freshdeskStatus) {
      case 2: return 'NEW'; // Open
      case 3: return 'IN_PROGRESS'; // Pending
      case 4: return 'AWAITING_REVIEW'; // Resolved
      case 5: return 'COMPLETE'; // Closed
      case 6: return 'NEW'; // Waiting on Customer (unresolved)
      case 7: return 'NEW'; // Waiting on Third Party (unresolved)
      default: return 'NEW';
    }
  }

  /**
   * Map Freshdesk priority to GPNet priority
   */
  private mapFreshdeskPriority(freshdeskPriority: number): string {
    switch (freshdeskPriority) {
      case 1: return 'low';
      case 2: return 'medium';
      case 3: return 'high';
      case 4: return 'urgent';
      default: return 'medium';
    }
  }

  /**
   * Find organization by Freshdesk company ID
   */
  private async findOrganizationByFreshdeskId(freshdeskCompanyId: number): Promise<any | null> {
    return await this.storage.findOrganizationByFreshdeskId(freshdeskCompanyId);
  }

  /**
   * Find ticket by Freshdesk ticket ID
   */
  private async findTicketByFreshdeskId(freshdeskTicketId: number): Promise<any | null> {
    return await this.storage.findTicketByFreshdeskId(freshdeskTicketId);
  }

  /**
   * Import a single ticket from Freshdesk webhook (real-time sync)
   */
  async importSingleTicket(freshdeskTicketId: number): Promise<{ success: boolean; ticketId?: string; error?: string }> {
    try {
      console.log(`🔄 Real-time sync: Importing Freshdesk ticket ${freshdeskTicketId}`);

      if (!freshdeskService.isAvailable()) {
        throw new Error('Freshdesk integration not configured');
      }

      // Fetch the specific ticket from Freshdesk
      const ticket = await freshdeskService.getTicket(freshdeskTicketId);
      if (!ticket) {
        return { success: false, error: 'Ticket not found in Freshdesk' };
      }

      // Fetch company if ticket has one
      let company = null;
      let orgId = null;
      
      if (ticket.company_id) {
        try {
          company = await freshdeskService.getCompany(ticket.company_id);
          
          // Find or create organization
          const existingOrg = await this.findOrganizationByFreshdeskId(ticket.company_id);
          if (existingOrg) {
            orgId = existingOrg.id;
          } else if (company) {
            // Create new organization
            const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const newOrg = await this.storage.createOrganization({
              name: company.name,
              slug: slug + '-' + company.id,
              freshdeskCompanyId: company.id,
              domains: company.domains || [],
              description: company.description || null
            });
            orgId = newOrg.id;
            console.log(`Created organization: ${company.name}`);
          }
        } catch (error) {
          console.warn(`Could not fetch/create company ${ticket.company_id}:`, error);
        }
      }

      // Check if ticket already exists
      const existingTicket = await this.findTicketByFreshdeskId(ticket.id);
      
      if (existingTicket) {
        // Update existing ticket
        await this.storage.updateTicket(existingTicket.id, {
          organizationId: orgId,
          fdCompanyId: ticket.company_id || null,
          companyName: company?.name || existingTicket.companyName,
          subject: ticket.subject,
          status: this.mapFreshdeskStatus(ticket.status),
          priority: this.mapFreshdeskPriority(ticket.priority),
          lastUpdateAt: new Date(ticket.updated_at)
        });
        console.log(`✅ Updated ticket ${existingTicket.id} from Freshdesk ticket ${freshdeskTicketId}`);
        return { success: true, ticketId: existingTicket.id };
      } else {
        // Create new ticket
        const ticketData: any = {
          fdId: ticket.id,
          fdCompanyId: ticket.company_id || null,
          subject: ticket.subject,
          caseType: 'general',
          status: this.mapFreshdeskStatus(ticket.status),
          priority: this.mapFreshdeskPriority(ticket.priority),
          companyName: company?.name || 'Unknown Company',
          organizationId: orgId,
          requesterId: ticket.requester_id?.toString(),
          assigneeId: ticket.responder_id?.toString(),
          ageDays: FreshdeskService.calculateTicketAge(ticket.created_at),
          tagsJson: ticket.tags || [],
          customJson: ticket.custom_fields || {},
          createdAt: new Date(ticket.created_at),
          lastUpdateAt: new Date(ticket.updated_at)
        };

        const newTicket = await this.storage.createTicket(ticketData);
        console.log(`✅ Created new ticket ${newTicket.id} from Freshdesk ticket ${freshdeskTicketId}`);
        return { success: true, ticketId: newTicket.id };
      }
    } catch (error) {
      console.error(`❌ Failed to import Freshdesk ticket ${freshdeskTicketId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get Freshdesk connection status
   */
  static getConnectionStatus(): { connected: boolean; domain?: string; error?: string } {
    try {
      if (!freshdeskService.isAvailable()) {
        return {
          connected: false,
          error: 'Freshdesk API credentials not configured'
        };
      }

      // Process domain using same logic as FreshdeskService
      let domain = process.env.FRESHDESK_DOMAIN;
      if (domain) {
        // Remove protocol if present
        domain = domain.replace(/^https?:\/\//, '');
        // Extract subdomain from formats like "gpnet.freshdesk.com" or "gpnet"
        const match = domain.match(/^([^.]+)(?:\.freshdesk\.com)?/);
        domain = match ? match[1] : domain;
        // Remove any trailing slashes or paths
        domain = domain.split('/')[0];
        // Add back the .freshdesk.com suffix for display
        domain = `${domain}.freshdesk.com`;
      }

      return {
        connected: true,
        domain: domain
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
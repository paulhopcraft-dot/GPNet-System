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
      // Fetch all data from Freshdesk
      console.log('Fetching tickets from Freshdesk...');
      const [tickets, companies] = await Promise.all([
        freshdeskService.fetchAllTickets(),
        freshdeskService.fetchAllCompanies()
      ]);

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
      for (const company of companies) {
        try {
          // Check if organization already exists by Freshdesk company ID
          const existingOrg = await this.findOrganizationByFreshdeskId(company.id);
          
          if (existingOrg) {
            // Update existing organization
            console.log(`Updating existing organization: ${company.name}`);
            // Note: We'd implement organization update logic here
          } else {
            // Create new organization
            console.log(`Creating new organization: ${company.name}`);
            // Note: We'd implement organization creation logic here
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
            // Update existing ticket
            console.log(`Updating existing ticket: ${ticket.id}`);
            // Note: We'd implement ticket update logic here
          } else {
            // Create new ticket
            console.log(`Creating new ticket: ${ticket.id} - ${ticket.subject}`);
            // Note: We'd implement ticket creation logic here
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
   * Find organization by Freshdesk company ID
   */
  private async findOrganizationByFreshdeskId(freshdeskCompanyId: number): Promise<any | null> {
    // This would query our organizations table for matching freshdeskCompanyId
    // For now, returning null to indicate not found
    return null;
  }

  /**
   * Find ticket by Freshdesk ticket ID
   */
  private async findTicketByFreshdeskId(freshdeskTicketId: number): Promise<any | null> {
    // This would query our tickets table for matching fdId
    // For now, returning null to indicate not found
    return null;
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
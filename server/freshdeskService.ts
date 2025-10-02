import type { 
  Ticket, 
  FreshdeskTicket, 
  InsertFreshdeskTicket, 
  InsertFreshdeskSyncLog 
} from "@shared/schema";

// Freshdesk API types
interface FreshdeskTicketResponse {
  id: number;
  subject: string;
  description: string;
  status: number;
  priority: number;
  type: string;
  requester_id: number;
  responder_id?: number;
  company_id?: number;
  product_id?: number;
  group_id?: number;
  created_at: string;
  updated_at: string;
  fr_escalated: boolean;
  spam: boolean;
  email_config_id?: number;
  fwd_emails: string[];
  reply_cc_emails: string[];
  cc_emails: string[];
  is_escalated: boolean;
  fr_due_by: string;
  due_by: string;
  tags: string[];
  custom_fields: Record<string, any>;
}

interface FreshdeskCreateTicketRequest {
  subject: string;
  description: string;
  status: number;
  priority: number;
  type: string;
  source: number;
  requester_id?: number;
  email?: string;
  name?: string;
  phone?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

interface FreshdeskUpdateTicketRequest {
  status?: number;
  priority?: number;
  subject?: string;
  description?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

// Freshdesk status mappings
const FRESHDESK_STATUS = {
  OPEN: 2,
  PENDING: 3,
  RESOLVED: 4,
  CLOSED: 5
} as const;

const FRESHDESK_PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4
} as const;

// GPNet to Freshdesk status mapping
const STATUS_MAPPING = {
  'NEW': FRESHDESK_STATUS.OPEN,
  'ANALYSING': FRESHDESK_STATUS.PENDING,
  'AWAITING_REVIEW': FRESHDESK_STATUS.PENDING,
  'READY_TO_SEND': FRESHDESK_STATUS.PENDING,
  'COMPLETE': FRESHDESK_STATUS.RESOLVED
} as const;

const PRIORITY_MAPPING = {
  'low': FRESHDESK_PRIORITY.LOW,
  'medium': FRESHDESK_PRIORITY.MEDIUM,
  'high': FRESHDESK_PRIORITY.HIGH,
  'urgent': FRESHDESK_PRIORITY.URGENT
} as const;

export class FreshdeskService {
  private apiKey: string | null;
  private domain: string | null;
  private baseUrl: string | null;

  constructor() {
    this.apiKey = process.env.FRESHDESK_API_KEY || null;
    let domain = process.env.FRESHDESK_DOMAIN || null;
    
    // Extract just the subdomain from various formats
    if (domain) {
      // Remove protocol if present
      domain = domain.replace(/^https?:\/\//, '');
      // Extract subdomain from formats like "gpnet.freshdesk.com" or "gpnet"
      const match = domain.match(/^([^.]+)(?:\.freshdesk\.com)?/);
      domain = match ? match[1] : domain;
      // Remove any trailing slashes or paths
      domain = domain.split('/')[0];
    }
    
    this.domain = domain;
    this.baseUrl = this.domain ? `https://${this.domain}.freshdesk.com/api/v2` : null;
  }

  /**
   * Check if Freshdesk integration is available
   */
  isAvailable(): boolean {
    return !!(this.apiKey && this.domain);
  }

  /**
   * Get authentication headers for Freshdesk API
   */
  private getAuthHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('Freshdesk API key not configured');
    }

    const auth = Buffer.from(`${this.apiKey}:X`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make HTTP request to Freshdesk API
   */
  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('Freshdesk domain not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getAuthHeaders();

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Freshdesk API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      console.error('Freshdesk API request failed:', error);
      throw error;
    }
  }

  /**
   * Create a new ticket in Freshdesk
   */
  async createTicket(gpnetTicket: Ticket, workerData?: any): Promise<FreshdeskTicketResponse | null> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available, skipping ticket creation');
      return null;
    }

    try {
      const ticketData: FreshdeskCreateTicketRequest = {
        subject: `GPNet Case: ${gpnetTicket.id} - ${workerData?.firstName || 'Worker'} ${workerData?.lastName || ''}`.trim(),
        description: this.generateTicketDescription(gpnetTicket, workerData),
        status: STATUS_MAPPING[gpnetTicket.status as keyof typeof STATUS_MAPPING] || FRESHDESK_STATUS.OPEN,
        priority: PRIORITY_MAPPING[gpnetTicket.priority as keyof typeof PRIORITY_MAPPING] || FRESHDESK_PRIORITY.MEDIUM,
        type: 'Question',
        source: 2, // Email
        tags: this.generateTags(gpnetTicket),
        custom_fields: {
          gpnet_ticket_id: gpnetTicket.id,
          case_type: gpnetTicket.caseType,
          claim_type: gpnetTicket.claimType || '',
          compliance_status: gpnetTicket.complianceStatus || 'compliant'
        }
      };

      // Add worker contact info if available
      if (workerData?.email) {
        ticketData.email = workerData.email;
      }
      if (workerData?.firstName && workerData?.lastName) {
        ticketData.name = `${workerData.firstName} ${workerData.lastName}`;
      }
      if (workerData?.phone) {
        ticketData.phone = workerData.phone;
      }

      const response = await this.makeRequest<FreshdeskTicketResponse>('/tickets', 'POST', ticketData);
      console.log(`Created Freshdesk ticket ${response.id} for GPNet ticket ${gpnetTicket.id}`);
      
      return response;
    } catch (error) {
      console.error('Failed to create Freshdesk ticket:', error);
      throw error;
    }
  }

  /**
   * Update an existing Freshdesk ticket
   */
  async updateTicket(freshdeskTicketId: number, updates: FreshdeskUpdateTicketRequest): Promise<FreshdeskTicketResponse | null> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available, skipping ticket update');
      return null;
    }

    try {
      const response = await this.makeRequest<FreshdeskTicketResponse>(
        `/tickets/${freshdeskTicketId}`, 
        'PUT', 
        updates
      );
      console.log(`Updated Freshdesk ticket ${freshdeskTicketId}`);
      return response;
    } catch (error) {
      console.error(`Failed to update Freshdesk ticket ${freshdeskTicketId}:`, error);
      throw error;
    }
  }

  /**
   * Sync GPNet ticket status to Freshdesk
   */
  async syncTicketStatus(gpnetTicket: Ticket, freshdeskTicketId: number): Promise<FreshdeskTicketResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const updates: FreshdeskUpdateTicketRequest = {
      status: STATUS_MAPPING[gpnetTicket.status as keyof typeof STATUS_MAPPING] || FRESHDESK_STATUS.OPEN,
      priority: PRIORITY_MAPPING[gpnetTicket.priority as keyof typeof PRIORITY_MAPPING] || FRESHDESK_PRIORITY.MEDIUM,
      tags: this.generateTags(gpnetTicket),
      custom_fields: {
        gpnet_ticket_id: gpnetTicket.id,
        case_type: gpnetTicket.caseType,
        claim_type: gpnetTicket.claimType || '',
        compliance_status: gpnetTicket.complianceStatus || 'compliant',
        rtw_step: gpnetTicket.rtwStep || '',
        last_updated: new Date().toISOString()
      }
    };

    return await this.updateTicket(freshdeskTicketId, updates);
  }

  /**
   * Get a Freshdesk ticket by ID
   */
  async getTicket(freshdeskTicketId: number): Promise<FreshdeskTicketResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await this.makeRequest<FreshdeskTicketResponse>(`/tickets/${freshdeskTicketId}`);
    } catch (error) {
      console.error(`Failed to get Freshdesk ticket ${freshdeskTicketId}:`, error);
      throw error;
    }
  }

  /**
   * Add a note to a Freshdesk ticket
   */
  async addNote(freshdeskTicketId: number, note: string, isPrivate: boolean = false): Promise<any> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const noteData = {
        body: note,
        private: isPrivate
      };

      return await this.makeRequest(`/tickets/${freshdeskTicketId}/notes`, 'POST', noteData);
    } catch (error) {
      console.error(`Failed to add note to Freshdesk ticket ${freshdeskTicketId}:`, error);
      throw error;
    }
  }

  /**
   * Generate ticket description for Freshdesk
   */
  private generateTicketDescription(gpnetTicket: Ticket, workerData?: any): string {
    let description = `**GPNet Case Management Ticket**\n\n`;
    description += `**Case ID:** ${gpnetTicket.id}\n`;
    description += `**Case Type:** ${gpnetTicket.caseType}\n`;
    description += `**Status:** ${gpnetTicket.status}\n`;
    description += `**Priority:** ${gpnetTicket.priority}\n`;

    if (gpnetTicket.claimType) {
      description += `**Claim Type:** ${gpnetTicket.claimType}\n`;
    }

    if (gpnetTicket.companyName) {
      description += `**Company:** ${gpnetTicket.companyName}\n`;
    }

    if (workerData) {
      description += `\n**Worker Information:**\n`;
      description += `**Name:** ${workerData.firstName} ${workerData.lastName}\n`;
      description += `**Email:** ${workerData.email}\n`;
      description += `**Phone:** ${workerData.phone}\n`;
      if (workerData.roleApplied) {
        description += `**Role Applied:** ${workerData.roleApplied}\n`;
      }
    }

    if (gpnetTicket.caseType === 'injury') {
      description += `\n**RTW Information:**\n`;
      description += `**Current Step:** ${gpnetTicket.rtwStep}\n`;
      description += `**Compliance Status:** ${gpnetTicket.complianceStatus}\n`;
      description += `**Jurisdiction:** ${gpnetTicket.workplaceJurisdiction}\n`;
    }

    description += `\n**Created:** ${gpnetTicket.createdAt}\n`;
    description += `**Last Updated:** ${gpnetTicket.updatedAt}\n`;

    description += `\n---\n*This ticket was automatically created by GPNet Case Management System*`;

    return description;
  }

  /**
   * Generate tags for Freshdesk ticket
   */
  private generateTags(gpnetTicket: Ticket): string[] {
    const tags = ['gpnet', gpnetTicket.caseType];

    if (gpnetTicket.claimType) {
      tags.push(gpnetTicket.claimType);
    }

    if (gpnetTicket.priority) {
      tags.push(`priority:${gpnetTicket.priority}`);
    }

    if (gpnetTicket.complianceStatus) {
      tags.push(`compliance:${gpnetTicket.complianceStatus}`);
    }

    if (gpnetTicket.rtwStep) {
      tags.push(`rtw:${gpnetTicket.rtwStep}`);
    }

    tags.push(`status:${gpnetTicket.status}`);

    return tags;
  }

  /**
   * Fetch all tickets from Freshdesk with pagination and rate limiting
   */
  async fetchAllTickets(updatedSince?: string): Promise<FreshdeskTicketResponse[]> {
    if (!this.isAvailable()) {
      throw new Error('Freshdesk integration not available. Please configure FRESHDESK_API_KEY and FRESHDESK_DOMAIN.');
    }

    const tickets: FreshdeskTicketResponse[] = [];
    let page = 1;
    const perPage = 100; // Maximum allowed by Freshdesk API
    
    console.log('Starting to fetch all tickets from Freshdesk...');
    
    while (true) {
      console.log(`Fetching tickets page ${page}...`);
      
      try {
        let endpoint = `/tickets?page=${page}&per_page=${perPage}&include=stats`;
        if (updatedSince) {
          endpoint += `&updated_since=${encodeURIComponent(updatedSince)}`;
        }
        
        const pageTickets = await this.makeRequest<FreshdeskTicketResponse[]>(endpoint);
        
        if (pageTickets.length === 0) {
          console.log(`No more tickets found on page ${page}`);
          break; // No more tickets
        }
        
        tickets.push(...pageTickets);
        console.log(`Fetched ${pageTickets.length} tickets from page ${page}. Total so far: ${tickets.length}`);
        
        if (pageTickets.length < perPage) {
          console.log('Last page reached (fewer tickets than per_page limit)');
          break; // Last page
        }
        
        page++;
        
        // Rate limiting: small delay between requests to respect API limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        
        // If we hit rate limits, wait longer and retry
        if (error instanceof Error && error.message.includes('429')) {
          console.log('Rate limit hit, waiting 60 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue; // Retry the same page
        }
        
        throw error; // Re-throw other errors
      }
    }
    
    console.log(`Successfully fetched ${tickets.length} total tickets from Freshdesk`);
    return tickets;
  }

  /**
   * Fetch all companies from Freshdesk
   */
  async fetchAllCompanies(): Promise<{ id: number; name: string; domains?: string[] }[]> {
    if (!this.isAvailable()) {
      throw new Error('Freshdesk integration not available');
    }

    const companies: any[] = [];
    let page = 1;
    const perPage = 100;
    
    console.log('Starting to fetch all companies from Freshdesk...');
    
    while (true) {
      console.log(`Fetching companies page ${page}...`);
      
      try {
        const pageCompanies = await this.makeRequest<any[]>(`/companies?page=${page}&per_page=${perPage}`);
        
        if (pageCompanies.length === 0) {
          break;
        }
        
        companies.push(...pageCompanies);
        console.log(`Fetched ${pageCompanies.length} companies from page ${page}. Total: ${companies.length}`);
        
        if (pageCompanies.length < perPage) {
          break;
        }
        
        page++;
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error fetching companies page ${page}:`, error);
        throw error;
      }
    }
    
    console.log(`Successfully fetched ${companies.length} total companies from Freshdesk`);
    return companies;
  }

  /**
   * Get a single company from Freshdesk by ID
   */
  async getCompany(companyId: number): Promise<{ id: number; name: string; domains?: string[]; description?: string } | null> {
    if (!this.isAvailable()) {
      throw new Error('Freshdesk integration not available');
    }

    try {
      const company = await this.makeRequest<any>(`/companies/${companyId}`);
      return company;
    } catch (error) {
      console.error(`Failed to fetch company ${companyId}:`, error);
      return null;
    }
  }

  /**
   * Fetch all contacts from Freshdesk  
   */
  async fetchAllContacts(): Promise<{ id: number; name: string; email: string; company_id?: number }[]> {
    if (!this.isAvailable()) {
      throw new Error('Freshdesk integration not available');
    }

    const contacts: any[] = [];
    let page = 1;
    const perPage = 100;
    
    console.log('Starting to fetch all contacts from Freshdesk...');
    
    while (true) {
      console.log(`Fetching contacts page ${page}...`);
      
      try {
        const pageContacts = await this.makeRequest<any[]>(`/contacts?page=${page}&per_page=${perPage}`);
        
        if (pageContacts.length === 0) {
          break;
        }
        
        contacts.push(...pageContacts);
        console.log(`Fetched ${pageContacts.length} contacts from page ${page}. Total: ${contacts.length}`);
        
        if (pageContacts.length < perPage) {
          break;
        }
        
        page++;
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error fetching contacts page ${page}:`, error);
        throw error;
      }
    }
    
    console.log(`Successfully fetched ${contacts.length} total contacts from Freshdesk`);
    return contacts;
  }

  /**
   * Map Freshdesk status number to readable string
   */
  static mapStatusToString(statusNumber: number): string {
    const statusMap: Record<number, string> = {
      2: 'Open',
      3: 'Pending', 
      4: 'Resolved',
      5: 'Closed',
      6: 'Waiting on Customer',
      7: 'Waiting on Third Party'
    };
    return statusMap[statusNumber] || 'Unknown';
  }

  /**
   * Map Freshdesk priority number to readable string
   */
  static mapPriorityToString(priorityNumber: number): string {
    const priorityMap: Record<number, string> = {
      1: 'Low',
      2: 'Medium',
      3: 'High', 
      4: 'Urgent'
    };
    return priorityMap[priorityNumber] || 'Medium';
  }

  /**
   * Calculate ticket age in days
   */
  static calculateTicketAge(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Create sync log entry
   */
  createSyncLog(
    gpnetTicketId: string,
    freshdeskTicketId: number | null,
    operation: string,
    direction: 'to_freshdesk' | 'from_freshdesk',
    status: 'success' | 'failed' | 'skipped',
    details?: any,
    errorMessage?: string
  ): InsertFreshdeskSyncLog {
    return {
      gpnetTicketId,
      freshdeskTicketId,
      operation,
      direction,
      status,
      details: details ? JSON.stringify(details) : null,
      errorMessage,
      retryCount: 0
    };
  }

  /**
   * Get all conversations/replies for a ticket
   */
  async getTicketConversations(ticketId: number): Promise<any[]> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available, skipping conversation fetch');
      return [];
    }

    try {
      const conversations = await this.makeRequest<any[]>(`/tickets/${ticketId}/conversations`);
      console.log(`Fetched ${conversations.length} conversation messages for ticket ${ticketId}`);
      return conversations;
    } catch (error) {
      console.error(`Failed to fetch conversations for ticket ${ticketId}:`, error);
      return [];
    }
  }

  /**
   * Get all private notes for a ticket
   */
  async getTicketNotes(ticketId: number): Promise<any[]> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available, skipping notes fetch');
      return [];
    }

    try {
      // Notes are typically included in conversations with private=true
      const conversations = await this.getTicketConversations(ticketId);
      const notes = conversations.filter(conv => conv.private === true);
      console.log(`Fetched ${notes.length} private notes for ticket ${ticketId}`);
      return notes;
    } catch (error) {
      console.error(`Failed to fetch notes for ticket ${ticketId}:`, error);
      return [];
    }
  }

  /**
   * Get ticket with conversations and notes (comprehensive data)
   */
  async getTicketWithConversations(ticketId: number): Promise<{
    ticket?: any;
    conversations: any[];
    notes: any[];
  }> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available');
      return { conversations: [], notes: [] };
    }

    try {
      const [ticket, conversations] = await Promise.all([
        this.makeRequest<any>(`/tickets/${ticketId}`).catch(() => null),
        this.getTicketConversations(ticketId)
      ]);

      const notes = conversations.filter(conv => conv.private === true);
      const replies = conversations.filter(conv => conv.private !== true);

      console.log(`Fetched ticket ${ticketId} with ${replies.length} replies and ${notes.length} notes`);
      
      return {
        ticket,
        conversations: replies,
        notes
      };
    } catch (error) {
      console.error(`Failed to fetch comprehensive ticket data for ${ticketId}:`, error);
      return { conversations: [], notes: [] };
    }
  }

  /**
   * Get all attachments for a ticket
   */
  async getTicketAttachments(ticketId: number): Promise<any[]> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available, skipping attachment fetch');
      return [];
    }

    try {
      // Get conversations first since attachments are linked to conversations
      const conversations = await this.getTicketConversations(ticketId);
      const attachments: any[] = [];

      // Extract attachments from each conversation
      for (const conversation of conversations) {
        if (conversation.attachments && Array.isArray(conversation.attachments)) {
          for (const attachment of conversation.attachments) {
            attachments.push({
              ...attachment,
              conversationId: conversation.id,
              ticketId,
              conversationCreatedAt: conversation.created_at
            });
          }
        }
      }

      console.log(`Fetched ${attachments.length} attachments for ticket ${ticketId}`);
      return attachments;
    } catch (error) {
      console.error(`Failed to fetch attachments for ticket ${ticketId}:`, error);
      return [];
    }
  }

  /**
   * Download an attachment by its URL
   */
  async downloadAttachment(attachmentUrl: string): Promise<Buffer | null> {
    if (!this.isAvailable()) {
      console.log('Freshdesk integration not available');
      return null;
    }

    try {
      const headers = this.getAuthHeaders();
      delete headers['Content-Type']; // Remove content-type for file downloads

      const response = await fetch(attachmentUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      console.log(`Downloaded attachment: ${attachmentUrl} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      console.error(`Failed to download attachment from ${attachmentUrl}:`, error);
      return null;
    }
  }

  /**
   * Get all tickets with their attachments (for backfill operations)
   */
  async fetchAllTicketsWithAttachments(): Promise<Array<{
    ticket: any;
    attachments: any[];
  }>> {
    if (!this.isAvailable()) {
      throw new Error('Freshdesk integration not available');
    }

    const tickets = await this.fetchAllTickets();
    const ticketsWithAttachments: Array<{ ticket: any; attachments: any[] }> = [];

    console.log(`Fetching attachments for ${tickets.length} tickets...`);

    for (const ticket of tickets) {
      try {
        const attachments = await this.getTicketAttachments(ticket.id);
        
        if (attachments.length > 0) {
          ticketsWithAttachments.push({
            ticket,
            attachments
          });
          console.log(`Ticket ${ticket.id}: ${attachments.length} attachments`);
        }

        // Rate limiting between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to fetch attachments for ticket ${ticket.id}:`, error);
        // Continue with other tickets
      }
    }

    console.log(`Found ${ticketsWithAttachments.length} tickets with attachments`);
    return ticketsWithAttachments;
  }
}

export const freshdeskService = new FreshdeskService();
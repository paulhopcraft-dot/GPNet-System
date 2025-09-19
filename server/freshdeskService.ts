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
    this.domain = process.env.FRESHDESK_DOMAIN || null;
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
}

export const freshdeskService = new FreshdeskService();
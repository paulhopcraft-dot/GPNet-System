import { storage } from './storage';
import type { WorkerInfoSheet } from '@shared/schema';

interface EscalationContact {
  name: string;
  email: string;
  role: string;
}

const ESCALATION_CHAIN: EscalationContact[] = [
  { name: 'Zora', email: 'zora@gpnet.com', role: 'Primary Coordinator' },
  { name: 'Wayne', email: 'wayne@gpnet.com', role: 'Senior Coordinator' },
  { name: 'Michelle', email: 'michelle@gpnet.com', role: 'Case Manager' }
];

const ESCALATION_INTERVAL_DAYS = 14;

export class WorkerInfoSheetService {
  
  /**
   * Request Worker Information Sheet for a ticket
   */
  async requestWorkerInfoSheet(ticketId: string, workerId: string): Promise<WorkerInfoSheet> {
    // Check if one already exists
    const existing = await storage.getWorkerInfoSheetByTicketId(ticketId);
    if (existing && existing.status !== 'returned') {
      console.log(`Worker Info Sheet already exists for ticket ${ticketId}`);
      return existing;
    }

    // CRITICAL: Get organizationId from ticket for multi-tenant partitioning
    const ticket = await storage.getTicket(ticketId);
    if (!ticket || !ticket.organizationId) {
      throw new Error(`Cannot request Worker Info Sheet: ticket ${ticketId} has no organizationId`);
    }

    // Create new request with organizationId
    const sheet = await storage.createWorkerInfoSheet({
      organizationId: ticket.organizationId, // CRITICAL: Multi-tenant partitioning
      ticketId,
      workerId,
      requestedAt: new Date(),
      status: 'pending',
      escalationLevel: 0
    });

    console.log(`✅ Worker Info Sheet requested for ticket ${ticketId} (org: ${ticket.organizationId}, assigned to ${ESCALATION_CHAIN[0].name})`);
    
    // TODO: Send initial email to employer requesting the sheet (use per-tenant Freshdesk settings)
    await this.sendRequestEmail(sheet, ESCALATION_CHAIN[0], ticket.organizationId);

    return sheet;
  }

  /**
   * Mark Worker Info Sheet as returned
   */
  async markReturned(sheetId: string): Promise<WorkerInfoSheet> {
    const sheet = await storage.markWorkerInfoSheetReturned(sheetId);
    console.log(`✅ Worker Info Sheet ${sheetId} marked as returned`);
    
    // Update ticket with worker info if available
    await this.updateTicketWithWorkerInfo(sheet);
    
    return sheet;
  }

  /**
   * Check all pending Worker Info Sheets for escalation
   * Called by background job every 6 hours
   * CRITICAL: Processes each organization separately for multi-tenant isolation
   */
  async checkAndEscalate(): Promise<void> {
    // CRITICAL: Get all organizations to process each tenant separately
    const allOrganizations = await storage.getAllOrganizations();
    console.log(`Checking Worker Info Sheets for ${allOrganizations.length} organizations...`);

    for (const org of allOrganizations) {
      // CRITICAL: Filter sheets by organizationId to prevent cross-tenant leakage
      const pendingSheets = await storage.getPendingWorkerInfoSheets(org.id);
      console.log(`  ${org.name}: ${pendingSheets.length} pending sheets`);

      const now = new Date();
      
      for (const sheet of pendingSheets) {
        const daysSinceRequest = this.calculateDaysDifference(sheet.requestedAt, now);
        const daysSinceLastEscalation = sheet.lastEscalatedAt 
          ? this.calculateDaysDifference(sheet.lastEscalatedAt, now)
          : daysSinceRequest;

        const currentLevel = sheet.escalationLevel || 0;
        const shouldEscalate = daysSinceLastEscalation >= ESCALATION_INTERVAL_DAYS;

        if (shouldEscalate && currentLevel < ESCALATION_CHAIN.length - 1) {
          await this.escalate(sheet, org.id);
        } else if (currentLevel >= ESCALATION_CHAIN.length - 1 && daysSinceLastEscalation >= ESCALATION_INTERVAL_DAYS) {
          // Already at Michelle (final escalation), keep sending reminders every 14 days
          await this.sendFinalEscalationReminder(sheet, org.id);
        }
      }
    }

    console.log('✅ Worker Info Sheet escalation check complete (all organizations processed)');
  }

  /**
   * Escalate Worker Info Sheet to next level
   */
  private async escalate(sheet: WorkerInfoSheet, organizationId: string): Promise<void> {
    const newLevel = (sheet.escalationLevel || 0) + 1;
    
    if (newLevel >= ESCALATION_CHAIN.length) {
      console.warn(`Cannot escalate Worker Info Sheet ${sheet.id} beyond final level`);
      return;
    }

    const escalatedSheet = await storage.escalateWorkerInfoSheet(sheet.id);
    const assignedTo = ESCALATION_CHAIN[newLevel];

    console.log(`⬆️ Worker Info Sheet ${sheet.id} escalated to ${assignedTo.name} (Level ${newLevel}) for org ${organizationId}`);
    
    // Send escalation email (with per-tenant Freshdesk settings)
    await this.sendEscalationEmail(escalatedSheet, assignedTo, organizationId);
  }

  /**
   * Send final escalation reminder (when already at Michelle)
   */
  private async sendFinalEscalationReminder(sheet: WorkerInfoSheet, organizationId: string): Promise<void> {
    const michelle = ESCALATION_CHAIN[ESCALATION_CHAIN.length - 1];
    console.log(`📧 Sending final reminder for Worker Info Sheet ${sheet.id} to ${michelle.name} for org ${organizationId}`);
    
    // TODO: Send reminder email (with per-tenant Freshdesk settings)
    await this.sendReminderEmail(sheet, michelle, organizationId);
  }

  /**
   * Update ticket with worker information when sheet is returned
   */
  private async updateTicketWithWorkerInfo(sheet: WorkerInfoSheet): Promise<void> {
    try {
      const ticket = await storage.getTicket(sheet.ticketId);
      const worker = await storage.getWorker(sheet.workerId);
      
      if (ticket && worker) {
        // In real implementation, this would parse the returned Worker Info Sheet form
        // and update worker details (manager name, company, etc.)
        console.log(`✅ Worker Info Sheet returned for ticket ${ticket.id} - worker ${worker.id}`);
        
        // TODO: When Worker Info Sheet form parsing is implemented:
        // 1. Extract manager name, company, job role, physical demands
        // 2. Update worker record via storage.updateWorkerStatus()
        // 3. Update ticket with any relevant flags or next steps
      }
    } catch (error) {
      console.error('Failed to update ticket with worker info:', error);
    }
  }

  // Email sending methods (placeholders for actual email integration)
  // CRITICAL: All methods accept organizationId to use per-tenant Freshdesk credentials

  private async sendRequestEmail(sheet: WorkerInfoSheet, assignedTo: EscalationContact, organizationId: string): Promise<void> {
    console.log(`📧 [TODO] Send Worker Info Sheet request email to ${assignedTo.name} for org ${organizationId}`);
    // In real implementation, this would:
    // 1. Get employer contact details from ticket
    // 2. Get organization-specific Freshdesk credentials/settings
    // 3. Send email with Worker Info Sheet form/template
    // 4. CC the assigned coordinator (Zora initially)
    // 5. Use organization's email domain and branding
  }

  private async sendEscalationEmail(sheet: WorkerInfoSheet, assignedTo: EscalationContact, organizationId: string): Promise<void> {
    console.log(`📧 [TODO] Send escalation email to ${assignedTo.name} for org ${organizationId}`);
    // In real implementation, this would:
    // 1. Get organization-specific Freshdesk credentials/settings
    // 2. Send email to next level in escalation chain
    // 3. Include case details and reason for escalation
    // 4. Request immediate action
    // 5. Use organization's email domain (not hardcoded @gpnet.com)
  }

  private async sendReminderEmail(sheet: WorkerInfoSheet, assignedTo: EscalationContact, organizationId: string): Promise<void> {
    console.log(`📧 [TODO] Send reminder email to ${assignedTo.name} for org ${organizationId}`);
    // In real implementation, this would:
    // 1. Get organization-specific Freshdesk credentials/settings
    // 2. Send reminder email
    // 3. Highlight urgency (14 days overdue)
    // 4. Request escalation to management if needed
    // 5. Use organization's email domain and branding
  }

  // Helper methods

  private calculateDaysDifference(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get escalation status for a Worker Info Sheet
   */
  async getEscalationStatus(sheetId: string): Promise<{
    currentLevel: number;
    assignedTo: EscalationContact;
    daysPending: number;
    daysUntilNextEscalation: number;
    status: string;
  }> {
    const sheet = await storage.getWorkerInfoSheet(sheetId);
    if (!sheet) {
      throw new Error(`Worker Info Sheet ${sheetId} not found`);
    }

    const currentLevel = sheet.escalationLevel || 0;
    const assignedTo = ESCALATION_CHAIN[currentLevel] || ESCALATION_CHAIN[ESCALATION_CHAIN.length - 1];
    
    const now = new Date();
    const daysPending = this.calculateDaysDifference(sheet.requestedAt, now);
    const daysSinceLastEscalation = sheet.lastEscalatedAt
      ? this.calculateDaysDifference(sheet.lastEscalatedAt, now)
      : daysPending;
    
    const daysUntilNextEscalation = Math.max(0, ESCALATION_INTERVAL_DAYS - daysSinceLastEscalation);

    return {
      currentLevel,
      assignedTo,
      daysPending,
      daysUntilNextEscalation,
      status: sheet.status
    };
  }

  /**
   * Get all overdue Worker Info Sheets (pending > 14 days)
   * CRITICAL: Accepts organizationId for multi-tenant filtering
   */
  async getOverdueSheets(organizationId?: string): Promise<WorkerInfoSheet[]> {
    // CRITICAL: Pass organizationId to filter by tenant
    const pendingSheets = await storage.getPendingWorkerInfoSheets(organizationId);
    const now = new Date();
    
    return pendingSheets.filter(sheet => {
      const daysPending = this.calculateDaysDifference(sheet.requestedAt, now);
      return daysPending > ESCALATION_INTERVAL_DAYS;
    });
  }
}

export const workerInfoSheetService = new WorkerInfoSheetService();

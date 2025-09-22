import { storage } from './storage';
import { companyMatchingService } from './companyMatchingService';
import { z } from 'zod';
import type { Ticket, AdminUser } from '../shared/schema';

// Allocation request schema
export const AllocationRequestSchema = z.object({
  ticketId: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  requiredSpecializations: z.array(z.string()).optional(),
  organizationId: z.string().optional(),
  manualOverride: z.boolean().default(false)
});

export type AllocationRequest = z.infer<typeof AllocationRequestSchema>;

// Allocation result types
export interface AllocationResult {
  coordinatorId: string;
  coordinator: AdminUser;
  confidence: number;
  assignmentReason: string;
  workloadBefore: number;
  workloadAfter: number;
  estimatedCompletionTime?: number;
}

export interface WorkloadInfo {
  coordinatorId: string;
  activeTickets: number;
  highPriorityTickets: number;
  averageCompletionTime: number;
  specializations: string[];
  availability: 'available' | 'busy' | 'unavailable';
  lastAssignmentDate?: Date;
}

export interface AllocationConflict {
  type: 'workload_overload' | 'specialization_mismatch' | 'company_conflict' | 'availability_conflict';
  severity: 'low' | 'medium' | 'high';
  description: string;
  coordinatorId: string;
}

// Coordinator specialization types
export type CoordinatorSpecialization = 
  | 'general_coordination'
  | 'occupational_health'
  | 'legal_compliance'
  | 'complex_claims'
  | 'mental_health'
  | 'safety_critical'
  | 'high_volume'
  | 'company_specialist';

// Auto-allocation configuration
interface AllocationConfig {
  maxWorkloadPerCoordinator: number;
  priorityWeights: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  specializationBonus: number;
  companyExperienceBonus: number;
  workloadBalanceWeight: number;
  responseTimeWeight: number;
  availabilityThreshold: number;
}

const DEFAULT_ALLOCATION_CONFIG: AllocationConfig = {
  maxWorkloadPerCoordinator: 25, // Maximum active tickets per coordinator
  priorityWeights: {
    urgent: 100,
    high: 75,
    medium: 50,
    low: 25
  },
  specializationBonus: 30, // Bonus points for matching specialization
  companyExperienceBonus: 20, // Bonus for previous work with company
  workloadBalanceWeight: 0.4, // How much workload balance matters (0-1)
  responseTimeWeight: 0.3, // How much response time matters (0-1) 
  availabilityThreshold: 80 // Minimum availability percentage required
};

/**
 * Intelligent Auto-Allocation Service
 * 
 * Automatically assigns tickets to coordinators using sophisticated algorithms that consider:
 * - Workload balancing across coordinators
 * - Coordinator specializations and expertise
 * - Company-based routing preferences
 * - Priority and urgency of tickets
 * - Historical performance and response times
 * - Availability and conflict detection
 */
export class AutoAllocationService {
  private config: AllocationConfig;
  
  constructor(config: Partial<AllocationConfig> = {}) {
    this.config = { ...DEFAULT_ALLOCATION_CONFIG, ...config };
  }
  
  /**
   * Get current allocation configuration
   */
  getConfig(): AllocationConfig {
    return { ...this.config };
  }
  
  /**
   * Update allocation configuration
   */
  updateConfig(updates: Partial<AllocationConfig>): AllocationConfig {
    this.config = { ...this.config, ...updates };
    console.log('Allocation configuration updated:', updates);
    return { ...this.config };
  }
  
  /**
   * Automatically assign a ticket to the best available coordinator
   */
  async allocateTicket(request: AllocationRequest): Promise<AllocationResult> {
    console.log('Starting auto-allocation for ticket:', request.ticketId);
    
    // Handle manual override option
    if (request.manualOverride) {
      console.log('Manual override requested - skipping automated assignment');
      throw new Error('Manual override requested - coordinator must be assigned manually');
    }
    
    try {
      // Step 1: Get ticket details
      const ticket = await this.getTicketForAllocation(request.ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${request.ticketId}`);
      }
      
      // Step 2: Get all available coordinators
      const availableCoordinators = await this.getAvailableCoordinators();
      if (availableCoordinators.length === 0) {
        throw new Error('No available coordinators found for allocation');
      }
      
      // Step 3: Calculate workload for each coordinator
      const workloadInfo = await this.calculateCoordinatorWorkloads(availableCoordinators);
      
      // Step 4: Score each coordinator for this ticket
      const scoredCoordinators = await this.scoreCoordinatorsForTicket(
        ticket, 
        request, 
        availableCoordinators, 
        workloadInfo
      );
      
      // Step 5: Detect conflicts and filter coordinators
      const viableCoordinators = await this.filterViableCoordinators(
        scoredCoordinators,
        ticket,
        workloadInfo
      );
      
      if (viableCoordinators.length === 0) {
        throw new Error('No viable coordinators available after conflict detection');
      }
      
      // Step 6: Select the best coordinator
      const bestCoordinator = viableCoordinators[0]; // Already sorted by score
      
      // Step 7: Assign the ticket
      await this.assignTicketToCoordinator(ticket.id, bestCoordinator.coordinator.id);
      
      // Step 8: Log the allocation
      await this.logAllocation(ticket, bestCoordinator, request);
      
      console.log(`Ticket ${request.ticketId} allocated to coordinator ${bestCoordinator.coordinator.id} with confidence ${bestCoordinator.confidence}`);
      
      return bestCoordinator;
      
    } catch (error) {
      console.error('Auto-allocation failed:', error);
      throw error;
    }
  }
  
  /**
   * Analyze potential allocation conflicts before assignment
   */
  async detectAllocationConflicts(ticketId: string, coordinatorId: string): Promise<AllocationConflict[]> {
    const conflicts: AllocationConflict[] = [];
    
    try {
      const ticket = await this.getTicketForAllocation(ticketId);
      const coordinator = await storage.getAdminUser(coordinatorId);
      
      if (!ticket || !coordinator) {
        return conflicts;
      }
      
      // Check workload overload
      const workload = await this.getCoordinatorWorkload(coordinatorId);
      if (workload.activeTickets >= this.config.maxWorkloadPerCoordinator) {
        conflicts.push({
          type: 'workload_overload',
          severity: 'high',
          description: `Coordinator has ${workload.activeTickets} active tickets, exceeding limit of ${this.config.maxWorkloadPerCoordinator}`,
          coordinatorId
        });
      }
      
      // Check specialization mismatch
      if (ticket.priority === 'urgent' && !this.hasRequiredSpecialization(coordinator, ['safety_critical', 'occupational_health'])) {
        conflicts.push({
          type: 'specialization_mismatch',
          severity: 'medium',
          description: 'Urgent ticket requires safety or health specialization',
          coordinatorId
        });
      }
      
      // Check company conflicts (if coordinator is already handling conflicting cases)
      if (ticket.organizationId) {
        const conflictingTickets = await this.getConflictingCompanyTickets(coordinatorId, ticket.organizationId);
        if (conflictingTickets.length > 3) {
          conflicts.push({
            type: 'company_conflict',
            severity: 'low',
            description: `Coordinator already handling ${conflictingTickets.length} tickets for this company`,
            coordinatorId
          });
        }
      }
      
      return conflicts;
      
    } catch (error) {
      console.error('Error detecting allocation conflicts:', error);
      return conflicts;
    }
  }
  
  /**
   * Get current workload statistics for all coordinators
   */
  async getCoordinatorWorkloads(): Promise<WorkloadInfo[]> {
    const coordinators = await this.getAvailableCoordinators();
    return await this.calculateCoordinatorWorkloads(coordinators);
  }
  
  /**
   * Rebalance workloads by redistributing tickets
   */
  async rebalanceWorkloads(): Promise<{
    redistributions: number;
    balanceImprovement: number;
    details: string[];
  }> {
    console.log('Starting workload rebalancing');
    
    const workloads = await this.getCoordinatorWorkloads();
    const redistributions: string[] = [];
    let redistributionCount = 0;
    
    // Find overloaded and underloaded coordinators
    const maxWorkload = Math.max(...workloads.map(w => w.activeTickets));
    const minWorkload = Math.min(...workloads.map(w => w.activeTickets));
    const balanceBefore = maxWorkload - minWorkload;
    
    // Simple rebalancing: move tickets from overloaded to underloaded coordinators
    const overloaded = workloads.filter(w => w.activeTickets > this.config.maxWorkloadPerCoordinator * 0.8);
    const underloaded = workloads.filter(w => w.activeTickets < this.config.maxWorkloadPerCoordinator * 0.6);
    
    for (const over of overloaded) {
      for (const under of underloaded) {
        const transferableTickets = await this.getTransferableTickets(over.coordinatorId);
        
        if (transferableTickets.length > 0 && over.activeTickets > under.activeTickets + 2) {
          const ticketToMove = transferableTickets[0];
          await this.assignTicketToCoordinator(ticketToMove.id, under.coordinatorId);
          
          redistributions.push(`Moved ticket ${ticketToMove.id} from ${over.coordinatorId} to ${under.coordinatorId}`);
          redistributionCount++;
          
          // Update workloads
          over.activeTickets--;
          under.activeTickets++;
          
          if (redistributionCount >= 10) break; // Limit redistributions per run
        }
      }
      if (redistributionCount >= 10) break;
    }
    
    const newWorkloads = await this.getCoordinatorWorkloads();
    const newMaxWorkload = Math.max(...newWorkloads.map(w => w.activeTickets));
    const newMinWorkload = Math.min(...newWorkloads.map(w => w.activeTickets));
    const balanceAfter = newMaxWorkload - newMinWorkload;
    
    console.log(`Rebalancing complete: ${redistributionCount} redistributions, balance improved by ${balanceBefore - balanceAfter}`);
    
    return {
      redistributions: redistributionCount,
      balanceImprovement: balanceBefore - balanceAfter,
      details: redistributions
    };
  }
  
  // ===== PRIVATE HELPER METHODS =====
  
  private async getTicketForAllocation(ticketId: string): Promise<Ticket | null> {
    try {
      const ticket = await storage.getTicket(ticketId);
      return ticket || null;
    } catch (error) {
      console.error('Error getting ticket for allocation:', error);
      return null;
    }
  }
  
  private async getAvailableCoordinators(): Promise<AdminUser[]> {
    try {
      // Get all active admin users who can act as coordinators
      const admins = await storage.getAllAdminUsers();
      
      // Filter to only active coordinators (could be enhanced with role filtering)
      return admins.filter(admin => 
        admin.status === 'active' && 
        !admin.isArchived &&
        this.isCoordinator(admin)
      );
    } catch (error) {
      console.error('Error getting available coordinators:', error);
      return [];
    }
  }
  
  private isCoordinator(admin: AdminUser): boolean {
    // Check if admin has coordinator permissions
    const permissions = admin.permissions as any;
    if (!permissions) return true; // Default: all admins can coordinate
    
    return permissions.canCoordinate !== false;
  }
  
  private async calculateCoordinatorWorkloads(coordinators: AdminUser[]): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];
    
    for (const coordinator of coordinators) {
      try {
        const activeTickets = await this.getCoordinatorActiveTicketCount(coordinator.id);
        const highPriorityTickets = await this.getCoordinatorHighPriorityTicketCount(coordinator.id);
        const avgCompletionTime = await this.getAverageCompletionTime(coordinator.id);
        const specializations = this.getCoordinatorSpecializations(coordinator);
        const availability = await this.calculateAvailability(coordinator.id);
        
        workloads.push({
          coordinatorId: coordinator.id,
          activeTickets,
          highPriorityTickets,
          averageCompletionTime: avgCompletionTime,
          specializations,
          availability: activeTickets >= this.config.maxWorkloadPerCoordinator ? 'unavailable' :
                      activeTickets >= this.config.maxWorkloadPerCoordinator * 0.8 ? 'busy' : 'available'
        });
      } catch (error) {
        console.error(`Error calculating workload for coordinator ${coordinator.id}:`, error);
        
        // Default workload info
        workloads.push({
          coordinatorId: coordinator.id,
          activeTickets: 0,
          highPriorityTickets: 0,
          averageCompletionTime: 0,
          specializations: ['general_coordination'],
          availability: 'available'
        });
      }
    }
    
    return workloads;
  }
  
  private async scoreCoordinatorsForTicket(
    ticket: Ticket,
    request: AllocationRequest,
    coordinators: AdminUser[],
    workloadInfo: WorkloadInfo[]
  ): Promise<AllocationResult[]> {
    const results: AllocationResult[] = [];
    
    for (const coordinator of coordinators) {
      const workload = workloadInfo.find(w => w.coordinatorId === coordinator.id);
      if (!workload) continue;
      
      let score = 0;
      const reasons: string[] = [];
      
      // Base score from availability
      if (workload.availability === 'available') {
        score += 50;
        reasons.push('available');
      } else if (workload.availability === 'busy') {
        score += 25;
        reasons.push('busy but manageable');
      } else {
        score += 0; // Unavailable coordinators get no base score
        reasons.push('overloaded');
      }
      
      // Workload balance bonus (fewer active tickets = higher score)
      const workloadBonus = Math.max(0, (this.config.maxWorkloadPerCoordinator - workload.activeTickets) * 2);
      score += workloadBonus * this.config.workloadBalanceWeight;
      if (workloadBonus > 0) {
        reasons.push(`workload balance (+${Math.round(workloadBonus * this.config.workloadBalanceWeight)})`);
      }
      
      // Priority handling bonus
      const priority = request.priority || ticket.priority || 'medium';
      const priorityBonus = this.config.priorityWeights[priority as keyof typeof this.config.priorityWeights] || 50;
      
      if (priority === 'urgent' && workload.specializations.includes('safety_critical')) {
        score += priorityBonus + this.config.specializationBonus;
        reasons.push('safety specialist for urgent case');
      } else {
        score += priorityBonus * 0.5; // Base priority handling
      }
      
      // Specialization matching
      if (request.requiredSpecializations) {
        const matchingSpecs = request.requiredSpecializations.filter(spec => 
          workload.specializations.includes(spec)
        );
        if (matchingSpecs.length > 0) {
          score += this.config.specializationBonus * matchingSpecs.length;
          reasons.push(`specialization match: ${matchingSpecs.join(', ')}`);
        }
      }
      
      // Company experience bonus
      if (ticket.organizationId) {
        const companyExperience = await this.getCoordinatorCompanyExperience(coordinator.id, ticket.organizationId);
        if (companyExperience > 0) {
          score += this.config.companyExperienceBonus;
          reasons.push(`company experience (${companyExperience} cases)`);
        }
      }
      
      // Response time bonus
      if (workload.averageCompletionTime > 0) {
        const responseBonus = Math.max(0, (480 - workload.averageCompletionTime) / 10); // 480 minutes = 8 hours
        score += responseBonus * this.config.responseTimeWeight;
        if (responseBonus > 0) {
          reasons.push(`fast response time (+${Math.round(responseBonus * this.config.responseTimeWeight)})`);
        }
      }
      
      // Calculate final confidence (0-100)
      const confidence = Math.min(100, Math.max(0, Math.round(score)));
      
      results.push({
        coordinatorId: coordinator.id,
        coordinator,
        confidence,
        assignmentReason: reasons.join(', '),
        workloadBefore: workload.activeTickets,
        workloadAfter: workload.activeTickets + 1,
        estimatedCompletionTime: workload.averageCompletionTime
      });
    }
    
    // Sort by confidence score (highest first)
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  
  private async filterViableCoordinators(
    scoredCoordinators: AllocationResult[],
    ticket: Ticket,
    workloadInfo: WorkloadInfo[]
  ): Promise<AllocationResult[]> {
    const viable: AllocationResult[] = [];
    
    for (const result of scoredCoordinators) {
      const conflicts = await this.detectAllocationConflicts(ticket.id, result.coordinatorId);
      const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
      
      // Exclude coordinators with high severity conflicts
      if (highSeverityConflicts.length === 0) {
        viable.push(result);
      }
    }
    
    return viable;
  }
  
  private async assignTicketToCoordinator(ticketId: string, coordinatorId: string): Promise<void> {
    try {
      await storage.updateTicket(ticketId, { assignedTo: coordinatorId });
      console.log(`Ticket ${ticketId} assigned to coordinator ${coordinatorId}`);
    } catch (error) {
      console.error('Error assigning ticket to coordinator:', error);
      throw error;
    }
  }
  
  private async logAllocation(ticket: Ticket, result: AllocationResult, request: AllocationRequest): Promise<void> {
    try {
      // Create audit log entry
      await storage.createAuditEvent({
        eventType: 'TICKET_AUTO_ALLOCATED',
        eventCategory: 'allocation',
        actorId: 'system',
        actorType: 'system',
        targetType: 'ticket',
        targetId: ticket.id,
        companyId: ticket.organizationId,
        action: `Auto-allocated ticket to coordinator ${result.coordinator.firstName} ${result.coordinator.lastName}`,
        details: {
          coordinatorId: result.coordinatorId,
          confidence: result.confidence,
          reason: result.assignmentReason,
          workloadBefore: result.workloadBefore,
          workloadAfter: result.workloadAfter,
          request: request
        },
        result: 'success',
        riskLevel: 'low'
      });
    } catch (error) {
      console.error('Error logging allocation:', error);
      // Don't throw - allocation succeeded, logging is secondary
    }
  }
  
  // ===== HELPER QUERY METHODS =====
  
  private async getCoordinatorActiveTicketCount(coordinatorId: string): Promise<number> {
    try {
      // Count tickets assigned to this coordinator that are not complete
      const tickets = await storage.getTicketsByAssignee(coordinatorId);
      return tickets.filter((t: Ticket) => !['COMPLETE', 'CLOSED', 'RESOLVED'].includes(t.status)).length;
    } catch (error) {
      console.error('Error getting coordinator active ticket count:', error);
      return 0;
    }
  }
  
  private async getCoordinatorHighPriorityTicketCount(coordinatorId: string): Promise<number> {
    try {
      const tickets = await storage.getTicketsByAssignee(coordinatorId);
      return tickets.filter((t: Ticket) => 
        ['high', 'urgent'].includes(t.priority || 'medium') && 
        !['COMPLETE', 'CLOSED', 'RESOLVED'].includes(t.status)
      ).length;
    } catch (error) {
      console.error('Error getting coordinator high priority ticket count:', error);
      return 0;
    }
  }
  
  private async getAverageCompletionTime(coordinatorId: string): Promise<number> {
    try {
      // This would require completion time tracking - simplified for now
      return 240; // 4 hours default
    } catch (error) {
      return 240;
    }
  }
  
  private getCoordinatorSpecializations(coordinator: AdminUser): CoordinatorSpecialization[] {
    // Extract specializations from coordinator permissions or profile
    const permissions = coordinator.permissions as any;
    
    if (permissions?.specializations) {
      return permissions.specializations;
    }
    
    // Default specializations based on admin roles
    return ['general_coordination'];
  }
  
  private async calculateAvailability(coordinatorId: string): Promise<'available' | 'busy' | 'unavailable'> {
    const activeTickets = await this.getCoordinatorActiveTicketCount(coordinatorId);
    
    if (activeTickets >= this.config.maxWorkloadPerCoordinator) {
      return 'unavailable';
    } else if (activeTickets >= this.config.maxWorkloadPerCoordinator * 0.8) {
      return 'busy';
    } else {
      return 'available';
    }
  }
  
  private async getCoordinatorCompanyExperience(coordinatorId: string, organizationId: string): Promise<number> {
    try {
      // Count previous tickets handled for this organization
      const tickets = await storage.getTicketsByAssignee(coordinatorId);
      return tickets.filter((t: Ticket) => t.organizationId === organizationId).length;
    } catch (error) {
      console.error('Error getting coordinator company experience:', error);
      return 0;
    }
  }
  
  private hasRequiredSpecialization(coordinator: AdminUser, requiredSpecs: string[]): boolean {
    const coordSpecs = this.getCoordinatorSpecializations(coordinator);
    return requiredSpecs.some(spec => coordSpecs.includes(spec as CoordinatorSpecialization));
  }
  
  private async getConflictingCompanyTickets(coordinatorId: string, organizationId: string): Promise<Ticket[]> {
    try {
      const tickets = await storage.getTicketsByAssignee(coordinatorId);
      return tickets.filter((t: Ticket) => 
        t.organizationId === organizationId && 
        !['COMPLETE', 'CLOSED', 'RESOLVED'].includes(t.status)
      );
    } catch (error) {
      console.error('Error getting conflicting company tickets:', error);
      return [];
    }
  }
  
  private async getTransferableTickets(coordinatorId: string): Promise<Ticket[]> {
    try {
      const tickets = await storage.getTicketsByAssignee(coordinatorId);
      
      // Only transfer non-urgent, recently assigned tickets
      return tickets.filter((t: Ticket) => 
        !['COMPLETE', 'CLOSED', 'RESOLVED'].includes(t.status) &&
        t.priority !== 'urgent' &&
        t.status === 'NEW' // Only newly assigned tickets
      );
    } catch (error) {
      console.error('Error getting transferable tickets:', error);
      return [];
    }
  }
  
  private async getCoordinatorWorkload(coordinatorId: string): Promise<WorkloadInfo> {
    const activeTickets = await this.getCoordinatorActiveTicketCount(coordinatorId);
    const highPriorityTickets = await this.getCoordinatorHighPriorityTicketCount(coordinatorId);
    
    return {
      coordinatorId,
      activeTickets,
      highPriorityTickets,
      averageCompletionTime: await this.getAverageCompletionTime(coordinatorId),
      specializations: ['general_coordination'],
      availability: activeTickets >= this.config.maxWorkloadPerCoordinator ? 'unavailable' :
                  activeTickets >= this.config.maxWorkloadPerCoordinator * 0.8 ? 'busy' : 'available'
    };
  }
}

// Export singleton instance
export const autoAllocationService = new AutoAllocationService();
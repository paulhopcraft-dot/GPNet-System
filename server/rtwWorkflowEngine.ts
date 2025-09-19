/**
 * RTW Complex Claims Workflow Engine - Simplified Version
 * 
 * Automates the 4-stage RTW compliance process:
 * 1. Eligibility Assessment (Week 1-2)
 * 2. Month 2 Review (Week 8-9)  
 * 3. Month 3 Assessment (Week 12-13)
 * 4. Non-compliance Escalation (Month 4+)
 */

import { IStorage } from './storage';
import { RtwWorkflowStep, RtwStepId, RtwComplianceStatus, RtwOutcome } from '@shared/schema';

export interface WorkflowEngineConfig {
  storage: IStorage;
  enableAutomaticProgression: boolean;
}

export interface WorkflowStepDefinition {
  stepId: RtwStepId;
  title: string;
  description: string;
  daysFromInjury: number;
  deadlineDays: number;
  nextStepId?: RtwStepId;
  legislationRefs: string[];
}

export class RtwWorkflowEngine {
  private storage: IStorage;
  private config: WorkflowEngineConfig;
  
  // Workflow step definitions based on WIRC Act requirements
  private readonly WORKFLOW_STEPS: WorkflowStepDefinition[] = [
    {
      stepId: "eligibility_assessment",
      title: "Eligibility Assessment",
      description: "Initial RTW eligibility assessment and capacity evaluation",
      daysFromInjury: 7,
      deadlineDays: 14,
      nextStepId: "month_2_review",
      legislationRefs: ["WIRC-s104", "WIRC-s105", "CLAIMS_MANUAL-5.1"]
    },
    {
      stepId: "month_2_review",
      title: "Month 2 Review", 
      description: "8-week capacity review and RTW progress assessment",
      daysFromInjury: 56,
      deadlineDays: 7,
      nextStepId: "month_3_assessment",
      legislationRefs: ["WIRC-s111", "WIRC-s113", "CLAIMS_MANUAL-5.1.1"]
    },
    {
      stepId: "month_3_assessment",
      title: "Month 3 Assessment",
      description: "12-week comprehensive assessment and compliance review", 
      daysFromInjury: 84,
      deadlineDays: 7,
      nextStepId: "non_compliance_escalation",
      legislationRefs: ["WIRC-s115", "WIRC-s113", "CLAIMS_MANUAL-5.1.6"]
    },
    {
      stepId: "non_compliance_escalation",
      title: "Non-compliance Escalation",
      description: "Warning letters, payment suspension, and termination procedures",
      daysFromInjury: 112,
      deadlineDays: 30,
      legislationRefs: ["WIRC-s116", "CLAIMS_MANUAL-5.1.2", "CLAIMS_MANUAL-5.1.3"]
    }
  ];

  constructor(config: WorkflowEngineConfig) {
    this.storage = config.storage;
    this.config = config;
  }

  /**
   * Initialize RTW workflow for a new case
   */
  async initializeWorkflow(ticketId: string, injuryDate: Date): Promise<RtwWorkflowStep> {
    console.log(`Initializing RTW workflow for ticket ${ticketId}`);
    
    const firstStep = this.WORKFLOW_STEPS[0];
    const deadlineDate = new Date(injuryDate);
    deadlineDate.setDate(deadlineDate.getDate() + firstStep.daysFromInjury + firstStep.deadlineDays);

    const workflowStep = await this.storage.createRtwWorkflowStep({
      ticketId,
      stepId: firstStep.stepId,
      status: "pending",
      startDate: injuryDate.toISOString().split('T')[0],
      deadlineDate: deadlineDate.toISOString().split('T')[0],
      legislationRefs: firstStep.legislationRefs,
      notes: `${firstStep.title}: ${firstStep.description}`,
      createdBy: "system"
    });

    // Create initial compliance audit
    await this.storage.createComplianceAudit({
      ticketId,
      action: "workflow_initialization", 
      actorId: "system",
      actorName: "RTW Workflow Engine",
      sourceVersion: "1.0",
      checksum: `rtw-init-${Date.now()}`,
      legislationRefs: firstStep.legislationRefs,
      result: `RTW workflow initialized: ${firstStep.title}`
    });

    // Update ticket RTW status
    await this.storage.updateTicketRtwStatus(ticketId, firstStep.stepId, "compliant", {
      date: deadlineDate.toISOString().split('T')[0],
      type: "assessment_deadline"
    });

    console.log(`RTW workflow initialized for ticket ${ticketId} - Step: ${firstStep.stepId}`);
    return workflowStep;
  }

  /**
   * Complete a workflow step with outcome
   */
  async completeWorkflowStep(
    stepId: string,
    outcome: RtwOutcome,
    completedBy: string,
    notes?: string
  ): Promise<void> {
    console.log(`Completing workflow step ${stepId} with outcome: ${outcome}`);

    const step = await this.storage.getRtwWorkflowStep(stepId);
    if (!step) {
      throw new Error(`Workflow step not found: ${stepId}`);
    }

    // Update step status
    await this.storage.updateRtwWorkflowStep(stepId, {
      status: "completed",
      completedDate: new Date().toISOString().split('T')[0],
      notes: notes ? `${step.notes || ''}\nCompleted: ${notes}` : step.notes
    });

    // Create completion audit
    await this.storage.createComplianceAudit({
      ticketId: step.ticketId,
      action: "step_completion",
      actorId: completedBy,
      actorName: completedBy,
      sourceVersion: "1.0",
      checksum: `step-complete-${Date.now()}`,
      legislationRefs: step.legislationRefs || [],
      result: `Step completed with outcome: ${outcome}. ${notes || ''}`
    });

    // Handle different outcomes
    const stepConfig = this.WORKFLOW_STEPS.find(s => s.stepId === step.stepId);
    
    if (outcome === "completed" && this.config.enableAutomaticProgression) {
      // Normal progression to next step
      if (stepConfig?.nextStepId) {
        await this.progressToNextStep(step, stepConfig.nextStepId);
      } else {
        // This was the final step - mark workflow as completed
        await this.storage.updateTicketRtwStatus(step.ticketId, "workflow_completed", "compliant");
      }
    } else if (outcome === "escalated") {
      // Jump directly to non-compliance escalation
      await this.storage.updateTicketRtwStatus(step.ticketId, "non_compliance_escalation", "non_compliant");
      if (step.stepId !== "non_compliance_escalation") {
        await this.progressToNextStep(step, "non_compliance_escalation");
      }
    } else if (outcome === "terminated" || outcome === "withdrawn") {
      // Terminal outcomes - mark workflow as completed
      await this.storage.updateTicketRtwStatus(step.ticketId, "workflow_completed", 
        outcome === "terminated" ? "non_compliant" : "compliant");
    }

    // Always update ticket status for completion
    await this.storage.updateTicketRtwStatus(step.ticketId, step.stepId, 
      outcome === "completed" ? "compliant" : "non_compliant");
  }

  /**
   * Progress workflow to the next step
   */
  private async progressToNextStep(currentStep: RtwWorkflowStep, nextStepId: RtwStepId): Promise<void> {
    console.log(`Progressing from ${currentStep.stepId} to ${nextStepId} for ticket ${currentStep.ticketId}`);

    // Find next step configuration
    const nextStepConfig = this.WORKFLOW_STEPS.find(s => s.stepId === nextStepId);
    if (!nextStepConfig) {
      throw new Error(`Invalid next step ID: ${nextStepId}`);
    }

    // Get injury date from eligibility assessment step (the first step always anchors to injury date)
    const allSteps = await this.storage.getRtwWorkflowStepsByTicket(currentStep.ticketId);
    const eligibilityStep = allSteps.find(step => step.stepId === "eligibility_assessment");
    
    if (!eligibilityStep?.startDate) {
      throw new Error(`Cannot find eligibility assessment step with injury date for ticket ${currentStep.ticketId}`);
    }
    
    const injuryDate = new Date(eligibilityStep.startDate);

    // Calculate proper deadline based on injury date + days from injury + deadline days
    const startDate = new Date(injuryDate);
    startDate.setDate(startDate.getDate() + nextStepConfig.daysFromInjury);
    
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + nextStepConfig.deadlineDays);

    // Check if next step already exists (idempotency)
    const existingSteps = await this.storage.getRtwWorkflowStepsByTicket(currentStep.ticketId);
    const existingNextStep = existingSteps.find(step => step.stepId === nextStepConfig.stepId && step.status === "pending");
    
    if (existingNextStep) {
      console.log(`Step ${nextStepConfig.stepId} already exists for ticket ${currentStep.ticketId}, skipping creation`);
      return;
    }

    // Create next workflow step
    await this.storage.createRtwWorkflowStep({
      ticketId: currentStep.ticketId,
      stepId: nextStepConfig.stepId,
      status: "pending",
      startDate: startDate.toISOString().split('T')[0],
      deadlineDate: deadlineDate.toISOString().split('T')[0],
      legislationRefs: nextStepConfig.legislationRefs,
      notes: `${nextStepConfig.title}: ${nextStepConfig.description}`,
      createdBy: "system"
    });

    // Update ticket RTW status
    await this.storage.updateTicketRtwStatus(currentStep.ticketId, nextStepConfig.stepId, "compliant", {
      date: deadlineDate.toISOString().split('T')[0],
      type: "step_deadline"
    });

    // Create progression audit
    await this.storage.createComplianceAudit({
      ticketId: currentStep.ticketId,
      action: "workflow_progression",
      actorId: "system",
      actorName: "RTW Workflow Engine",
      sourceVersion: "1.0",
      checksum: `progression-${Date.now()}`,
      legislationRefs: nextStepConfig.legislationRefs,
      result: `Progressed to ${nextStepConfig.title} stage`
    });

    console.log(`Successfully progressed to ${nextStepId} for ticket ${currentStep.ticketId}`);
  }

  /**
   * Record worker participation event
   */
  async recordWorkerParticipation(
    ticketId: string,
    eventType: string,
    participationLevel: "full" | "partial" | "none" | "refused",
    notes?: string
  ): Promise<void> {
    console.log(`Recording worker participation for ticket ${ticketId}: ${eventType} - ${participationLevel}`);

    await this.storage.createWorkerParticipationEvent({
      ticketId,
      eventType,
      eventDate: new Date().toISOString().split('T')[0],
      participationStatus: participationLevel,
      legislationBasis: ["WIRC-s111", "WIRC-s113"],
      complianceNotes: notes || `Worker ${participationLevel} participation in ${eventType}`,
      createdBy: "system"
    });

    // Create compliance audit based on participation
    const riskLevel = participationLevel === "refused" ? "high" : 
                     participationLevel === "none" ? "medium" : "low";

    await this.storage.createComplianceAudit({
      ticketId,
      action: "participation_assessment",
      actorId: "system",
      actorName: "RTW Workflow Engine",
      sourceVersion: "1.0",
      checksum: `participation-${Date.now()}`,
      legislationRefs: ["WIRC-s111", "WIRC-s113"],
      result: `Worker participation: ${participationLevel} - Risk level: ${riskLevel}. ${notes || ''}`
    });
  }

  /**
   * Get workflow summary for a ticket
   */
  async getWorkflowSummary(ticketId: string) {
    const allSteps = await this.storage.getRtwWorkflowStepsByTicket(ticketId);
    const currentStep = allSteps.find(step => step.status === "pending") || 
                       allSteps.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
    const complianceAudits = await this.storage.getComplianceAuditByTicket(ticketId);
    const participationEvents = await this.storage.getWorkerParticipationEventsByTicket(ticketId);

    // Determine overall status based on current step and audits
    const hasRefusedParticipation = participationEvents.some(event => 
      event.participationStatus === "refused"
    );
    const overallStatus: RtwComplianceStatus = hasRefusedParticipation ? "non_compliant" : "compliant";

    return {
      currentStep,
      allSteps,
      complianceAudits,
      participationEvents,
      overallStatus
    };
  }

  /**
   * Process workflow progression for all active cases
   * Note: This method would typically be called by a scheduled job/cron
   */
  async processWorkflowProgression(): Promise<void> {
    console.log("Processing RTW workflow progression for all active cases");
    
    try {
      // Get all tickets with active RTW workflows (exclude completed and terminal states)
      const allTickets = await this.storage.getAllTickets();
      const rtwTickets = allTickets.filter(ticket => 
        ticket.rtwStep && 
        ticket.rtwStep !== "workflow_completed" && 
        ticket.rtwStep !== "completed"
      );
      
      let processedCount = 0;
      
      for (const ticket of rtwTickets) {
        // Get current workflow step for this ticket
        const currentStep = await this.storage.getCurrentRtwStep(ticket.id);
        
        if (currentStep && currentStep.status === "pending" && currentStep.deadlineDate) {
          const now = new Date();
          const deadlineDate = new Date(currentStep.deadlineDate);
          const daysOverdue = Math.ceil((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOverdue > 0) {
            console.log(`Step ${currentStep.stepId} for ticket ${ticket.id} is ${daysOverdue} days overdue`);
            
            // Update ticket to non-compliant status
            await this.storage.updateTicketRtwStatus(ticket.id, currentStep.stepId, "non_compliant", {
              date: new Date().toISOString().split('T')[0],
              type: "overdue_deadline"
            });
            
            // Create overdue audit
            await this.storage.createComplianceAudit({
              ticketId: ticket.id,
              action: "deadline_overdue",
              actorId: "system",
              actorName: "RTW Workflow Engine",
              sourceVersion: "1.0",
              checksum: `overdue-${Date.now()}`,
              legislationRefs: currentStep.legislationRefs || [],
              result: `Step ${currentStep.stepId} overdue by ${daysOverdue} days - immediate action required`
            });
            
            processedCount++;
          }
        }
      }

      console.log(`Processed ${processedCount} overdue workflow steps from ${rtwTickets.length} active RTW cases`);
    } catch (error) {
      console.error("Error processing workflow progression:", error);
    }
  }
}

/**
 * Factory function to create workflow engine instance
 */
export function createRtwWorkflowEngine(storage: IStorage): RtwWorkflowEngine {
  return new RtwWorkflowEngine({
    storage,
    enableAutomaticProgression: true
  });
}
import { IStorage } from './storage';
import { EmailService } from './emailService';
import { normalizeJotformPayload } from './jotformPayloadNormalizer';
import { EnhancedRiskAssessmentService } from './riskAssessmentService';

export interface SimulationConfig {
  workerCount: number;
  healthCheckTypes: string[];
  includeManagerEmails: boolean;
  includeFreshdeskTickets: boolean;
  simulateDelays: boolean;
}

export interface SimulationResult {
  workersCreated: number;
  ticketsCreated: number;
  formsSubmitted: number;
  emailsSent: number;
  freshdeskTicketsCreated: number;
  timeline: SimulationEvent[];
  summary: {
    totalProcessingTime: number;
    completedWorkflows: number;
    pendingWorkflows: number;
  };
}

export interface SimulationEvent {
  timestamp: Date;
  eventType: 'worker_created' | 'invitation_sent' | 'form_submitted' | 'ticket_created' | 'email_sent' | 'freshdesk_created' | 'analysis_completed';
  description: string;
  data?: any;
}

export class WorkflowSimulator {
  private storage: IStorage;
  private emailService: EmailService;
  private riskAssessmentService: EnhancedRiskAssessmentService;
  private timeline: SimulationEvent[] = [];

  constructor(storage: IStorage, emailService: EmailService) {
    this.storage = storage;
    this.emailService = emailService;
    this.riskAssessmentService = new EnhancedRiskAssessmentService(storage);
  }

  private addEvent(eventType: SimulationEvent['eventType'], description: string, data?: any) {
    this.timeline.push({
      timestamp: new Date(),
      eventType,
      description,
      data
    });
  }

  async runCompleteWorkflowSimulation(config: SimulationConfig): Promise<SimulationResult> {
    const startTime = Date.now();
    this.timeline = [];
    
    console.log('🚀 Starting complete workflow simulation...');
    this.addEvent('worker_created', `Starting simulation with ${config.workerCount} workers`);

    const results = {
      workersCreated: 0,
      ticketsCreated: 0,
      formsSubmitted: 0,
      emailsSent: 0,
      freshdeskTicketsCreated: 0,
      timeline: this.timeline,
      summary: {
        totalProcessingTime: 0,
        completedWorkflows: 0,
        pendingWorkflows: 0
      }
    };

    // Create test workers and simulate complete workflows
    for (let i = 0; i < config.workerCount; i++) {
      try {
        const healthCheckType = config.healthCheckTypes[i % config.healthCheckTypes.length];
        await this.simulateCompleteWorkerJourney(i + 1, healthCheckType, config);
        results.workersCreated++;
        results.ticketsCreated++;
        results.formsSubmitted++;
        
        if (config.includeManagerEmails) {
          results.emailsSent++;
        }
        
        if (config.includeFreshdeskTickets) {
          results.freshdeskTicketsCreated++;
        }

        if (config.simulateDelays) {
          await this.delay(500); // Small delay between workers
        }
      } catch (error) {
        console.error(`Error simulating worker ${i + 1}:`, error);
        this.addEvent('worker_created', `Failed to simulate worker ${i + 1}: ${error}`, { error });
      }
    }

    const endTime = Date.now();
    results.summary.totalProcessingTime = endTime - startTime;
    results.summary.completedWorkflows = results.formsSubmitted;
    results.summary.pendingWorkflows = results.workersCreated - results.formsSubmitted;

    console.log('✅ Workflow simulation completed:', results.summary);
    this.addEvent('analysis_completed', 'Simulation completed', results.summary);

    return results;
  }

  private async simulateCompleteWorkerJourney(workerIndex: number, healthCheckType: string, config: SimulationConfig) {
    // Step 1: Create worker
    const worker = await this.createTestWorker(workerIndex);
    this.addEvent('worker_created', `Created worker: ${worker.firstName} ${worker.lastName}`, { workerId: worker.id });

    // Step 2: Create invitation/ticket
    const ticket = await this.createTestTicket(worker.id, healthCheckType);
    this.addEvent('ticket_created', `Created ${healthCheckType} ticket for ${worker.firstName}`, { ticketId: ticket.id });

    // Step 3: Simulate form submission
    const formData = this.generateRealisticFormData(healthCheckType, worker);
    const submission = await this.simulateFormSubmission(ticket.id, worker.id, formData);
    this.addEvent('form_submitted', `${worker.firstName} submitted ${healthCheckType} form`, { submissionId: submission.id });

    // Step 4: Trigger analysis and status updates
    await this.runAnalysisAndUpdates(ticket.id, formData, healthCheckType);
    this.addEvent('analysis_completed', `Analysis completed for ${worker.firstName}`, { ticketId: ticket.id });

    // Step 5: Send manager notification (if enabled)
    if (config.includeManagerEmails) {
      await this.simulateManagerNotification(worker, healthCheckType, ticket.id);
      this.addEvent('email_sent', `Manager notification sent for ${worker.firstName}`, { ticketId: ticket.id });
    }

    // Step 6: Create Freshdesk ticket (if enabled)
    if (config.includeFreshdeskTickets) {
      await this.simulateFreshdeskIntegration(ticket, worker);
      this.addEvent('freshdesk_created', `Freshdesk ticket created for ${worker.firstName}`, { ticketId: ticket.id });
    }

    console.log(`✅ Completed workflow for ${worker.firstName} ${worker.lastName} (${healthCheckType})`);
  }

  private async createTestWorker(index: number) {
    const firstNames = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'John', 'Anna', 'Robert', 'Maria'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const roles = ['Warehouse Operator', 'Forklift Driver', 'Machine Operator', 'Assembly Worker', 'Quality Inspector', 'Maintenance Technician'];
    const sites = ['Melbourne Warehouse', 'Sydney Distribution', 'Brisbane Facility', 'Perth Operations', 'Adelaide Hub'];

    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@testcompany.com.au`;

    return await this.storage.createWorker({
      firstName,
      lastName,
      email,
      phone: `04${Math.floor(Math.random() * 90000000 + 10000000)}`,
      dateOfBirth: this.generateRandomDate(new Date('1970-01-01'), new Date('2000-12-31')),
      roleApplied: roles[index % roles.length],
      site: sites[index % sites.length]
    });
  }

  private async createTestTicket(workerId: string, healthCheckType: string) {
    const caseTypeMapping: Record<string, string> = {
      'pre_employment': 'pre_employment',
      'injury': 'injury',
      'mental_health': 'mental_health',
      'prevention': 'prevention',
      'general_health': 'general_health',
      'exit_check': 'exit_check'
    };

    return await this.storage.createTicket({
      workerId,
      caseType: caseTypeMapping[healthCheckType] || 'pre_employment',
      status: "NEW",
      priority: "medium",
      formType: healthCheckType
    });
  }

  private generateRealisticFormData(healthCheckType: string, worker: any) {
    const baseData = {
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email,
      phone: worker.phone,
      dateOfBirth: worker.dateOfBirth,
      position: worker.roleApplied,
      department: worker.site
    };

    switch (healthCheckType) {
      case 'pre_employment':
        return {
          ...baseData,
          medicalConditions: Math.random() > 0.7 ? ['Back pain'] : [],
          currentMedications: Math.random() > 0.8 ? ['Paracetamol'] : [],
          liftingCapacity: Math.floor(Math.random() * 30 + 10), // 10-40kg
          hasInjuries: Math.random() > 0.8,
          smoker: Math.random() > 0.7,
          fitnessLevel: ['Poor', 'Fair', 'Good', 'Excellent'][Math.floor(Math.random() * 4)],
          signature: `${worker.firstName}_${worker.lastName}_signature_${Date.now()}`
        };

      case 'injury':
        return {
          ...baseData,
          incidentDate: this.generateRandomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
          incidentLocation: 'Warehouse Floor',
          injuryType: ['Cut', 'Strain', 'Bruise', 'Sprain'][Math.floor(Math.random() * 4)],
          bodyPart: ['Back', 'Hand', 'Leg', 'Shoulder', 'Arm'][Math.floor(Math.random() * 5)],
          severity: ['Minor', 'Moderate', 'Major'][Math.floor(Math.random() * 3)],
          treatmentRequired: Math.random() > 0.5,
          workAbility: Math.random() > 0.3 ? 'Modified duties' : 'Unable to work',
          signature: `${worker.firstName}_${worker.lastName}_injury_signature_${Date.now()}`
        };

      case 'mental_health':
        return {
          ...baseData,
          stressLevel: Math.floor(Math.random() * 10 + 1), // 1-10
          sleepQuality: ['Poor', 'Fair', 'Good', 'Excellent'][Math.floor(Math.random() * 4)],
          workPressure: Math.random() > 0.6 ? 'High' : 'Moderate',
          supportNeeded: Math.random() > 0.7,
          urgencyLevel: Math.random() > 0.9 ? 'High' : 'Medium',
          signature: `${worker.firstName}_${worker.lastName}_mental_signature_${Date.now()}`
        };

      default:
        return {
          ...baseData,
          generalHealth: 'Good',
          signature: `${worker.firstName}_${worker.lastName}_general_signature_${Date.now()}`
        };
    }
  }

  private async simulateFormSubmission(ticketId: string, workerId: string, formData: any) {
    return await this.storage.createFormSubmission({
      ticketId,
      workerId,
      rawData: formData
    });
  }

  private async runAnalysisAndUpdates(ticketId: string, formData: any, healthCheckType: string) {
    // Create RiskInput array in the correct format
    const riskInputs = [{
      type: 'form' as const,
      content: formData,
      timestamp: new Date(),
      source: `${healthCheckType}_simulation`
    }];
    
    // Simulate risk assessment
    const analysisResult = await this.riskAssessmentService.assessRisk(riskInputs);
    
    // Create analysis record
    await this.storage.createAnalysis({
      ticketId,
      fitClassification: analysisResult.fitClassification,
      ragScore: analysisResult.ragScore as "green" | "amber" | "red",
      recommendations: analysisResult.recommendations,
      notes: `Simulation analysis: ${analysisResult.triggerReasons.join('; ')}`
    });

    // Update ticket status
    await this.storage.updateTicketStatus(ticketId, "AWAITING_REVIEW");
  }

  private async simulateManagerNotification(worker: any, healthCheckType: string, ticketId: string) {
    if (!this.emailService.isAvailable()) {
      console.log(`📧 Would send manager notification for ${worker.firstName} ${worker.lastName} (${healthCheckType})`);
      return;
    }

    // In a real scenario, we'd get the manager email from company data
    const managerEmail = 'manager@testcompany.com.au';
    
    try {
      await this.emailService.sendManagerNotification(
        managerEmail,
        `${worker.firstName} ${worker.lastName}`,
        healthCheckType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        ticketId
      );
    } catch (error) {
      console.log(`📧 Manager notification simulated for ${worker.firstName} ${worker.lastName}`);
    }
  }

  private async simulateFreshdeskIntegration(ticket: any, worker: any) {
    try {
      const { freshdeskService } = await import("./freshdeskService");
      
      if (freshdeskService.isAvailable()) {
        const freshdeskTicket = await freshdeskService.createTicket(ticket, worker);
        
        if (freshdeskTicket) {
          await this.storage.createFreshdeskTicket({
            gpnetTicketId: ticket.id,
            freshdeskTicketId: freshdeskTicket.id,
            freshdeskUrl: `https://simulation.freshdesk.com/tickets/${freshdeskTicket.id}`,
            syncStatus: 'synced',
            freshdeskData: freshdeskTicket
          });
        }
      } else {
        console.log(`🎫 Would create Freshdesk ticket for ${worker.firstName} ${worker.lastName}`);
      }
    } catch (error) {
      console.log(`🎫 Freshdesk integration simulated for ${worker.firstName} ${worker.lastName}`);
    }
  }

  private generateRandomDate(start: Date, end: Date): string {
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Quick simulation methods for testing specific scenarios
  async simulatePreEmploymentWorkflow(workerCount: number = 1): Promise<SimulationResult> {
    return this.runCompleteWorkflowSimulation({
      workerCount,
      healthCheckTypes: ['pre_employment'],
      includeManagerEmails: true,
      includeFreshdeskTickets: true,
      simulateDelays: false
    });
  }

  async simulateInjuryWorkflow(workerCount: number = 1): Promise<SimulationResult> {
    return this.runCompleteWorkflowSimulation({
      workerCount,
      healthCheckTypes: ['injury'],
      includeManagerEmails: true,
      includeFreshdeskTickets: true,
      simulateDelays: false
    });
  }

  async simulateMixedWorkflows(workerCount: number = 5): Promise<SimulationResult> {
    return this.runCompleteWorkflowSimulation({
      workerCount,
      healthCheckTypes: ['pre_employment', 'injury', 'mental_health', 'prevention', 'general_health'],
      includeManagerEmails: true,
      includeFreshdeskTickets: true,
      simulateDelays: true
    });
  }
}
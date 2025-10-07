import { storage } from './storage';
import type { Ticket, Worker, Injury } from '@shared/schema';

export interface RiskFactors {
  isOffWork: boolean;
  hasLongAbsence: boolean;
  hasMusculoskeletalInjury: boolean;
  hasRepetitiveTasks: boolean;
  hasPsychosocialRisk: boolean;
  hasNoRtwPlan: boolean;
  isSeekingSuitableDuties: boolean;
  hasDelayedRecovery: boolean;
}

export interface RiskAssessment {
  level: 'Low' | 'Medium' | 'High';
  score: number;
  factors: string[];
  recommendations: string[];
}

export interface StatusDetermination {
  status: string;
  confidence: number;
  reasoning: string;
}

export interface NextStepRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  urgency: 'routine' | 'urgent' | 'critical';
  assignedTo?: string;
  dueInDays?: number;
}

export class RuleEngine {
  
  /**
   * Derive risk level based on multiple factors (RAG scoring)
   */
  async deriveRisk(ticketId: string): Promise<RiskAssessment> {
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
    const injury = await storage.getInjuryByTicket(ticketId);
    
    const factors = this.extractRiskFactors(ticket, worker ?? null, injury ?? null);
    const score = this.calculateRiskScore(factors);
    const level = this.mapScoreToRAG(score);
    const factorDescriptions = this.describeRiskFactors(factors);
    const recommendations = this.generateRecommendations(factors, level);

    return {
      level,
      score,
      factors: factorDescriptions,
      recommendations
    };
  }

  /**
   * Derive current case status from available data
   */
  async deriveCurrentStatus(ticketId: string): Promise<StatusDetermination> {
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
    const injury = await storage.getInjuryByTicket(ticketId);
    const emails = await storage.getEmailsByTicket(ticketId);

    // Status determination logic
    const emailContent = emails.map(e => e.body.toLowerCase()).join(' ');
    const lastEmailDate = emails.length > 0 ? emails[0].sentAt : null;
    
    let status = 'Unknown';
    let confidence = 0.5;
    let reasoning = 'Insufficient data to determine status';

    // Check for seeking suitable duties (high priority indicator)
    if (emailContent.includes('seeking suitable duties') || emailContent.includes('looking for suitable work')) {
      status = 'Seeking suitable duties';
      confidence = 0.9;
      reasoning = 'Email mentions worker seeking suitable duties';
    }
    // Check for claim submitted
    else if (emailContent.includes('claim submitted') || emailContent.includes('claim lodged')) {
      status = 'Claim submitted';
      confidence = 0.85;
      reasoning = 'WorkCover claim has been submitted';
    }
    // Check for injury check completed
    else if (emailContent.includes('injury check completed') || emailContent.includes('assessment completed')) {
      status = 'Injury check completed';
      confidence = 0.8;
      reasoning = 'Initial injury assessment has been completed';
    }
    // Check if off work
    else if (worker?.statusOffWork) {
      status = 'Off work';
      confidence = 0.75;
      reasoning = 'Worker is currently off work';
    }
    // Check for active RTW planning
    else if (worker?.rtwPlanPresent) {
      status = 'RTW planning in progress';
      confidence = 0.7;
      reasoning = 'Return to work plan is in place';
    }
    // Default to case type based status
    else if (ticket.caseType) {
      status = `${ticket.caseType} - Initial assessment`;
      confidence = 0.6;
      reasoning = 'Status derived from case type';
    }

    return {
      status,
      confidence,
      reasoning
    };
  }

  /**
   * Derive next steps based on current case state
   */
  async deriveNextSteps(ticketId: string): Promise<NextStepRecommendation[]> {
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
    const injury = await storage.getInjuryByTicket(ticketId);
    const riskAssessment = await this.deriveRisk(ticketId);
    const statusDetermination = await this.deriveCurrentStatus(ticketId);

    const steps: NextStepRecommendation[] = [];

    // High-risk cases need immediate action
    if (riskAssessment.level === 'High') {
      steps.push({
        action: 'Urgent review required - High risk case identified',
        priority: 'high',
        urgency: 'urgent',
        assignedTo: 'Senior Case Manager',
        dueInDays: 1
      });

      if (statusDetermination.status.includes('seeking suitable duties')) {
        steps.push({
          action: 'Contact employer to identify suitable duties opportunities',
          priority: 'high',
          urgency: 'urgent',
          assignedTo: 'RTW Coordinator',
          dueInDays: 2
        });
      }

      if (worker?.statusOffWork && !worker?.rtwPlanPresent) {
        steps.push({
          action: 'Develop return-to-work plan with medical restrictions',
          priority: 'high',
          urgency: 'urgent',
          assignedTo: 'RTW Specialist',
          dueInDays: 3
        });
      }
    }

    // Medium-risk cases need monitoring
    if (riskAssessment.level === 'Medium') {
      steps.push({
        action: 'Schedule follow-up assessment within 7 days',
        priority: 'medium',
        urgency: 'routine',
        dueInDays: 7
      });

      if (injury?.injuryType?.includes('musculoskeletal')) {
        steps.push({
          action: 'Request updated medical certificate from treating practitioner',
          priority: 'medium',
          urgency: 'routine',
          dueInDays: 5
        });
      }
    }

    // Worker Info Sheet logic
    if (worker && !worker.company) {
      steps.push({
        action: 'Request Worker Information Sheet from employer',
        priority: 'high',
        urgency: 'urgent',
        assignedTo: 'Case Coordinator',
        dueInDays: 1
      });
    }

    // Case type specific steps
    if (ticket.caseType === 'pre_employment') {
      steps.push({
        action: 'Obtain employer job description and physical demands analysis',
        priority: 'medium',
        urgency: 'routine',
        dueInDays: 3
      });
    }

    if (ticket.caseType === 'injury_management' && !injury) {
      steps.push({
        action: 'Document injury details and mechanism of injury',
        priority: 'high',
        urgency: 'urgent',
        dueInDays: 1
      });
    }

    // Default if no specific steps identified
    if (steps.length === 0) {
      steps.push({
        action: 'Review case details and determine appropriate assessment pathway',
        priority: 'medium',
        urgency: 'routine',
        dueInDays: 3
      });
    }

    return steps;
  }

  /**
   * Extract risk factors from case data
   */
  private extractRiskFactors(ticket: Ticket, worker: Worker | null, injury: Injury | null): RiskFactors {
    const factors: RiskFactors = {
      isOffWork: worker?.statusOffWork ?? false,
      hasLongAbsence: false,
      hasMusculoskeletalInjury: false,
      hasRepetitiveTasks: false,
      hasPsychosocialRisk: false,
      hasNoRtwPlan: (worker?.statusOffWork ?? false) && !(worker?.rtwPlanPresent ?? false),
      isSeekingSuitableDuties: false,
      hasDelayedRecovery: false
    };

    // Check absence duration
    if (worker?.dateOfInjury) {
      const daysSinceInjury = Math.floor((Date.now() - new Date(worker.dateOfInjury).getTime()) / (1000 * 60 * 60 * 24));
      factors.hasLongAbsence = daysSinceInjury > 14;
      
      if (worker.expectedRecoveryDate) {
        const expectedDays = Math.floor((new Date(worker.expectedRecoveryDate).getTime() - new Date(worker.dateOfInjury).getTime()) / (1000 * 60 * 60 * 24));
        factors.hasDelayedRecovery = daysSinceInjury > expectedDays;
      }
    }

    // Check injury type
    if (injury?.injuryType) {
      const injuryTypeLower = injury.injuryType.toLowerCase();
      factors.hasMusculoskeletalInjury = 
        injuryTypeLower.includes('musculoskeletal') ||
        injuryTypeLower.includes('back') ||
        injuryTypeLower.includes('shoulder') ||
        injuryTypeLower.includes('knee') ||
        injuryTypeLower.includes('repetitive strain');
    }

    // Check for psychosocial indicators
    if (ticket.caseType === 'mental_health' || injury?.injuryType?.toLowerCase().includes('psychological')) {
      factors.hasPsychosocialRisk = true;
    }

    return factors;
  }

  /**
   * Calculate numeric risk score (0-100)
   */
  private calculateRiskScore(factors: RiskFactors): number {
    let score = 0;

    if (factors.isOffWork) score += 20;
    if (factors.hasLongAbsence) score += 25;
    if (factors.hasMusculoskeletalInjury) score += 15;
    if (factors.hasRepetitiveTasks) score += 10;
    if (factors.hasPsychosocialRisk) score += 20;
    if (factors.hasNoRtwPlan) score += 15;
    if (factors.isSeekingSuitableDuties) score += 30;
    if (factors.hasDelayedRecovery) score += 20;

    return Math.min(score, 100);
  }

  /**
   * Map score to RAG (Red/Amber/Green) level
   */
  private mapScoreToRAG(score: number): 'Low' | 'Medium' | 'High' {
    if (score >= 60) return 'High';
    if (score >= 30) return 'Medium';
    return 'Low';
  }

  /**
   * Describe active risk factors
   */
  private describeRiskFactors(factors: RiskFactors): string[] {
    const descriptions: string[] = [];

    if (factors.isOffWork) descriptions.push('Worker currently off work');
    if (factors.hasLongAbsence) descriptions.push('Extended absence (>14 days)');
    if (factors.hasMusculoskeletalInjury) descriptions.push('Musculoskeletal injury present');
    if (factors.hasRepetitiveTasks) descriptions.push('Repetitive task exposure');
    if (factors.hasPsychosocialRisk) descriptions.push('Psychosocial risk factors identified');
    if (factors.hasNoRtwPlan) descriptions.push('No return-to-work plan in place');
    if (factors.isSeekingSuitableDuties) descriptions.push('Seeking suitable duties');
    if (factors.hasDelayedRecovery) descriptions.push('Recovery delayed beyond expected timeline');

    return descriptions;
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRecommendations(factors: RiskFactors, level: 'Low' | 'Medium' | 'High'): string[] {
    const recommendations: string[] = [];

    if (level === 'High') {
      recommendations.push('Immediate case review required');
      recommendations.push('Consider specialist referral');
    }

    if (factors.hasNoRtwPlan && factors.isOffWork) {
      recommendations.push('Urgent RTW planning required');
    }

    if (factors.isSeekingSuitableDuties) {
      recommendations.push('Engage with employer for suitable duties options');
      recommendations.push('Review capacity assessment and restrictions');
    }

    if (factors.hasLongAbsence) {
      recommendations.push('Investigate barriers to return to work');
      recommendations.push('Consider early intervention strategies');
    }

    if (factors.hasPsychosocialRisk) {
      recommendations.push('Psychosocial assessment recommended');
      recommendations.push('Consider mental health support services');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue routine monitoring');
    }

    return recommendations;
  }

  /**
   * Comprehensive case analysis (combines all derivations)
   */
  async analyzeFull(ticketId: string) {
    const [risk, status, nextSteps] = await Promise.all([
      this.deriveRisk(ticketId),
      this.deriveCurrentStatus(ticketId),
      this.deriveNextSteps(ticketId)
    ]);

    return {
      risk,
      status,
      nextSteps,
      analyzedAt: new Date()
    };
  }

  /**
   * Update ticket with derived values
   */
  async updateTicketWithAnalysis(ticketId: string) {
    const analysis = await this.analyzeFull(ticketId);
    
    await storage.updateTicketRuleEngineFields(ticketId, {
      riskLevel: analysis.risk.level,
      currentStatus: analysis.status.status,
      nextStepsJson: analysis.nextSteps
    });

    return analysis;
  }
}

export const ruleEngine = new RuleEngine();

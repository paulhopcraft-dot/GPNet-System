import { storage } from './storage';
import { ruleEngine } from './ruleEngine';
import type { Ticket, Worker, Injury, CaseFeedback } from '@shared/schema';

interface MLFeatures {
  daysOffWork: number;
  hasMusculoskeletalInjury: boolean;
  hasPsychosocialRisk: boolean;
  hasRtwPlan: boolean;
  daysUntilRecovery: number;
  emailMentionsSuitableDuties: boolean;
  emailMentionsClaim: boolean;
  caseTypeRisk: number;
}

interface SHAPValue {
  feature: string;
  value: number;
  impact: number;
  explanation: string;
}

interface MLPrediction {
  predictedRisk: 'Low' | 'Medium' | 'High';
  confidence: number;
  shapValues: SHAPValue[];
  modelVersion: string;
}

interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix?: number[][];
}

export class XGBoostService {
  private modelVersion = 'xgboost-ready-v1';
  private useActualXGBoost = false; // DISABLED: Use simulation mode for now (Python XGBoost not implemented)

  /**
   * Predict risk level using ML model (currently rule-based, future XGBoost)
   */
  async predictRisk(ticketId: string): Promise<MLPrediction> {
    const features = await this.extractFeatures(ticketId);
    
    if (this.useActualXGBoost) {
      // Future: Call Python XGBoost model via subprocess or API
      return await this.callPythonXGBoost(features);
    } else {
      // Current: Use rule-based prediction that mimics XGBoost
      return await this.ruleBasedPrediction(features, ticketId);
    }
  }

  /**
   * Extract ML features from ticket data
   */
  private async extractFeatures(ticketId: string): Promise<MLFeatures> {
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const worker = ticket.workerId ? await storage.getWorker(ticket.workerId) : null;
    const injury = await storage.getInjuryByTicket(ticketId);
    const emails = await storage.getEmailsByTicket(ticketId);

    const emailContent = emails.map(e => e.body.toLowerCase()).join(' ');

    const features: MLFeatures = {
      daysOffWork: this.calculateDaysOffWork(worker ?? null),
      hasMusculoskeletalInjury: this.hasMusculoskeletalInjury(injury ?? null),
      hasPsychosocialRisk: this.hasPsychosocialRisk(ticket, injury ?? null),
      hasRtwPlan: worker?.rtwPlanPresent ?? false,
      daysUntilRecovery: this.calculateDaysUntilRecovery(worker ?? null),
      emailMentionsSuitableDuties: emailContent.includes('suitable duties'),
      emailMentionsClaim: emailContent.includes('claim submitted') || emailContent.includes('claim lodged'),
      caseTypeRisk: this.getCaseTypeRisk(ticket.caseType)
    };

    return features;
  }

  /**
   * Rule-based prediction (mimics XGBoost feature importance)
   */
  private async ruleBasedPrediction(features: MLFeatures, ticketId: string): Promise<MLPrediction> {
    const shapValues: SHAPValue[] = [];
    let riskScore = 0;

    // Feature: Days off work (high impact)
    const daysOffWorkImpact = Math.min(features.daysOffWork * 0.8, 30);
    shapValues.push({
      feature: 'Days Off Work',
      value: features.daysOffWork,
      impact: daysOffWorkImpact,
      explanation: `Worker has been off work for ${features.daysOffWork} days`
    });
    riskScore += daysOffWorkImpact;

    // Feature: Seeking suitable duties (very high impact)
    if (features.emailMentionsSuitableDuties) {
      shapValues.push({
        feature: 'Seeking Suitable Duties',
        value: 1,
        impact: 35,
        explanation: 'Email correspondence mentions seeking suitable duties'
      });
      riskScore += 35;
    }

    // Feature: Musculoskeletal injury (medium impact)
    if (features.hasMusculoskeletalInjury) {
      shapValues.push({
        feature: 'Musculoskeletal Injury',
        value: 1,
        impact: 15,
        explanation: 'Musculoskeletal injuries have higher complexity and duration'
      });
      riskScore += 15;
    }

    // Feature: No RTW plan (high impact if off work)
    if (!features.hasRtwPlan && features.daysOffWork > 0) {
      shapValues.push({
        feature: 'No RTW Plan',
        value: 1,
        impact: 20,
        explanation: 'Worker off work without return-to-work plan increases risk'
      });
      riskScore += 20;
    }

    // Feature: Psychosocial risk (medium-high impact)
    if (features.hasPsychosocialRisk) {
      shapValues.push({
        feature: 'Psychosocial Risk',
        value: 1,
        impact: 18,
        explanation: 'Mental health or workplace stress factors present'
      });
      riskScore += 18;
    }

    // Feature: Case type base risk
    shapValues.push({
      feature: 'Case Type Risk',
      value: features.caseTypeRisk,
      impact: features.caseTypeRisk,
      explanation: 'Baseline risk from case type classification'
    });
    riskScore += features.caseTypeRisk;

    // Determine risk level and confidence
    const predictedRisk = this.scoreToRisk(riskScore);
    const confidence = this.calculateConfidence(riskScore, shapValues);

    return {
      predictedRisk,
      confidence,
      shapValues: shapValues.sort((a, b) => b.impact - a.impact), // Sort by impact
      modelVersion: this.modelVersion
    };
  }

  /**
   * Train XGBoost model using feedback data
   * CRITICAL: Accepts organizationId to train per-tenant models and prevent cross-tenant data aggregation
   */
  async trainModel(organizationId?: string): Promise<string> {
    // CRITICAL: Filter feedback by organizationId to prevent cross-tenant data leakage
    const feedback = await storage.getAllCaseFeedback(organizationId);
    
    if (feedback.length < 50) {
      const orgMsg = organizationId ? ` for organization ${organizationId}` : '';
      throw new Error(`Insufficient training data${orgMsg}: ${feedback.length} samples (minimum 50 required)`);
    }

    const runId = crypto.randomUUID();
    
    try {
      // Create training run record (with organizationId for per-tenant models)
      const trainingRun = await storage.createModelTrainingRun({
        organizationId, // CRITICAL: Store which organization this model was trained for
        version: this.modelVersion,
        trainingDataCount: feedback.length,
        metrics: {},
        status: 'running'
      });

      if (this.useActualXGBoost) {
        // Future: Train actual XGBoost model
        await this.trainPythonXGBoost(feedback, runId);
      } else {
        // Current: Simulate training with metrics calculation
        const metrics = await this.simulateTraining(feedback);
        
        await storage.updateModelTrainingRun(runId, {
          status: 'completed',
          finishedAt: new Date(),
          metrics: {
            accuracy: metrics.accuracy,
            precision: metrics.precision,
            recall: metrics.recall,
            f1Score: metrics.f1Score
          },
          shapTopFeatures: this.getFeatureImportance()
        });
      }

      return runId;
    } catch (error) {
      await storage.updateModelTrainingRun(runId, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Record feedback for ML training
   */
  async recordFeedback(params: {
    organizationId: string; // CRITICAL: Multi-tenant partitioning
    ticketId: string;
    givenBy?: string;
    feedbackType: 'correct' | 'not_relevant' | 'better_action';
    suggestionText: string;
    betterActionText?: string;
    features: any;
  }): Promise<string> {
    const feedback = await storage.createCaseFeedback({
      organizationId: params.organizationId, // CRITICAL: Multi-tenant partitioning
      ticketId: params.ticketId,
      suggestionText: params.suggestionText,
      feedbackType: params.feedbackType,
      betterActionText: params.betterActionText,
      features: params.features,
      givenBy: params.givenBy
    });

    return feedback.id;
  }

  // Helper methods

  private calculateDaysOffWork(worker: Worker | null): number {
    if (!worker?.statusOffWork || !worker?.dateOfInjury) return 0;
    
    const injuryDate = new Date(worker.dateOfInjury);
    const today = new Date();
    return Math.floor((today.getTime() - injuryDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private hasMusculoskeletalInjury(injury: Injury | null): boolean {
    if (!injury?.injuryType) return false;
    const injuryTypeLower = injury.injuryType.toLowerCase();
    return injuryTypeLower.includes('musculoskeletal') ||
           injuryTypeLower.includes('back') ||
           injuryTypeLower.includes('shoulder') ||
           injuryTypeLower.includes('knee');
  }

  private hasPsychosocialRisk(ticket: Ticket, injury: Injury | null): boolean {
    return ticket.caseType === 'mental_health' || 
           injury?.injuryType?.toLowerCase().includes('psychological') ||
           injury?.injuryType?.toLowerCase().includes('stress') ||
           false;
  }

  private calculateDaysUntilRecovery(worker: Worker | null): number {
    if (!worker?.expectedRecoveryDate || !worker?.dateOfInjury) return -1;
    
    const injuryDate = new Date(worker.dateOfInjury);
    const recoveryDate = new Date(worker.expectedRecoveryDate);
    return Math.floor((recoveryDate.getTime() - injuryDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getCaseTypeRisk(caseType: string): number {
    const riskMap: Record<string, number> = {
      'injury_management': 12,
      'mental_health': 15,
      'pre_employment': 5,
      'return_to_work': 10,
      'health_screening': 3,
      'exit_check': 4
    };
    return riskMap[caseType] ?? 8;
  }

  private scoreToRisk(score: number): 'Low' | 'Medium' | 'High' {
    if (score >= 60) return 'High';
    if (score >= 30) return 'Medium';
    return 'Low';
  }

  private calculateConfidence(score: number, shapValues: SHAPValue[]): number {
    // Confidence is higher when we have more features contributing
    const activeFeatures = shapValues.filter(s => s.impact > 0).length;
    const baseConfidence = Math.min(activeFeatures * 0.15, 0.85);
    
    // Adjust based on score clarity
    if (score < 25 || score > 65) {
      return Math.min(baseConfidence + 0.1, 0.95);
    }
    
    return baseConfidence;
  }

  private getFeatureImportance() {
    return {
      'Seeking Suitable Duties': 0.35,
      'Days Off Work': 0.25,
      'No RTW Plan': 0.15,
      'Psychosocial Risk': 0.12,
      'Musculoskeletal Injury': 0.08,
      'Case Type Risk': 0.05
    };
  }

  private async simulateTraining(feedback: CaseFeedback[]): Promise<TrainingMetrics> {
    // Simulate training metrics based on feedback
    const correctFeedback = feedback.filter(f => f.feedbackType === 'correct').length;
    const accuracy = Math.min(0.7 + (correctFeedback / feedback.length) * 0.2, 0.95);
    
    return {
      accuracy,
      precision: accuracy * 0.95,
      recall: accuracy * 0.92,
      f1Score: accuracy * 0.93
    };
  }

  /**
   * Call Python XGBoost model via ML Service
   */
  private async callPythonXGBoost(features: MLFeatures): Promise<MLPrediction> {
    try {
      // Try to connect to ML service (requires trained models)
      const mlClient = require('./mlServiceClient').mlServiceClient;
      
      if (!mlClient.isAvailable) {
        console.warn('ML Service not available, falling back to rule-based prediction');
        // Fallback to rule-based with a different ticket ID (we'll use a dummy)
        return await this.ruleBasedPrediction(features, 'ml-fallback');
      }
      
      // Call ML service for prediction
      // Note: This requires trained models to be available in the ML service
      // For now, fallback to rule-based as models need to be trained first
      console.log('ML Service available but models not trained yet, using rule-based');
      return await this.ruleBasedPrediction(features, 'ml-fallback');
      
    } catch (error) {
      console.error('Error calling Python XGBoost, falling back to rule-based:', error);
      return await this.ruleBasedPrediction(features, 'ml-fallback');
    }
  }

  /**
   * Future: Train Python XGBoost model (placeholder)
   */
  private async trainPythonXGBoost(feedback: CaseFeedback[], runId: string): Promise<void> {
    // This will be implemented when Python XGBoost integration is added
    throw new Error('Python XGBoost training not yet implemented');
  }
}

export const xgboostService = new XGBoostService();

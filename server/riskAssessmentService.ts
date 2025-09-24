import { PreEmploymentFormData, InjuryFormData } from "../shared/schema";
import type { IStorage } from './storage.js';

export interface RiskInput {
  type: 'form' | 'email' | 'medical_record' | 'manual_update' | 'follow_up';
  content: any;
  timestamp: Date;
  source: string;
}

export interface RiskAssessmentResult {
  ragScore: "green" | "amber" | "red";
  fitClassification: string;
  confidence: number; // 0-100% confidence in assessment
  riskFactors: string[];
  recommendations: string[];
  triggerReasons: string[];
  assessmentHistory?: RiskAssessmentResult[];
  
  // FLAGGING RULES (Traffic Light System) - Manager-facing outputs
  managerFlag: {
    color: "green" | "yellow" | "red";
    actionStatement: string;
    requiresReport: boolean;
  };
}

export interface EmailRiskAnalysis {
  medicalTerms: string[];
  riskKeywords: string[];
  workCapacityIndicators: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  suggestedAction: string;
}

export class EnhancedRiskAssessmentService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  private riskKeywords = {
    high: ['severe', 'critical', 'emergency', 'unable to work', 'permanent disability', 'surgery required', 'hospitalization', 'major injury'],
    medium: ['moderate', 'treatment required', 'work restrictions', 'modified duties', 'physiotherapy', 'specialist referral', 'ongoing pain'],
    low: ['minor', 'improving', 'return to work', 'no restrictions', 'cleared for duty', 'fully recovered']
  };

  private medicalTerms = [
    'fracture', 'sprain', 'strain', 'contusion', 'laceration', 'burn', 'concussion',
    'herniated disc', 'carpal tunnel', 'tendonitis', 'arthritis', 'inflammation',
    'chronic pain', 'acute pain', 'mobility issues', 'range of motion'
  ];

  /**
   * Comprehensive risk assessment that combines multiple inputs
   */
  async assessRisk(inputs: RiskInput[], existingRagScore?: "green" | "amber" | "red", organizationId?: string): Promise<RiskAssessmentResult> {
    const risks: string[] = [];
    const recommendations: string[] = [];
    const triggerReasons: string[] = [];
    let ragScore: "green" | "amber" | "red" = existingRagScore || "green";
    let fitClassification = "fit";
    let confidence = 100;

    // Process each input
    for (const input of inputs) {
      const inputResult = await this.processInput(input);
      
      // Escalate risk level if new input suggests higher risk
      if (this.getRiskLevel(inputResult.ragScore) > this.getRiskLevel(ragScore)) {
        ragScore = inputResult.ragScore;
        triggerReasons.push(`${input.type} assessment indicated ${ragScore} risk`);
      }

      risks.push(...inputResult.riskFactors);
      recommendations.push(...inputResult.recommendations);
      
      // Adjust confidence based on input quality and recency
      confidence = Math.min(confidence, inputResult.confidence);
    }

    // Determine fit classification based on final RAG score
    fitClassification = this.determineFitClassification(ragScore, risks);

    // CRITICAL: Check probation period validation for pre-employment checks
    if (organizationId && this.isPreEmploymentAssessment(inputs)) {
      const probationValidation = await this.validateProbationRequirements(organizationId);
      
      if (!probationValidation.isValid) {
        // Override fit classification to force probation configuration
        fitClassification = "probation_required";
        ragScore = "red"; // Force red to block recommendation
        risks.push("Probation period not configured");
        recommendations.push("Configure probation period in organization settings before proceeding");
        triggerReasons.push("BDD Compliance: Probation period validation failed");
        
        // Update confidence to reflect validation failure
        confidence = Math.min(confidence, 50);
      }
    }

    // Generate manager flag based on traffic light system
    const managerFlag = this.generateManagerFlag(ragScore, inputs);

    return {
      ragScore,
      fitClassification,
      confidence,
      riskFactors: Array.from(new Set(risks)), // Remove duplicates
      recommendations: Array.from(new Set(recommendations)),
      triggerReasons,
      managerFlag
    };
  }

  /**
   * Analyze email content for risk indicators
   */
  analyzeEmailContent(emailContent: string, subject: string): EmailRiskAnalysis {
    const content = (emailContent + ' ' + subject).toLowerCase();
    const medicalTerms: string[] = [];
    const riskKeywords: string[] = [];
    const workCapacityIndicators: string[] = [];
    let urgencyLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for medical terms
    this.medicalTerms.forEach(term => {
      if (content.includes(term.toLowerCase())) {
        medicalTerms.push(term);
      }
    });

    // Check for high risk keywords
    this.riskKeywords.high.forEach(keyword => {
      if (content.includes(keyword)) {
        riskKeywords.push(keyword);
        urgencyLevel = 'high';
      }
    });

    // Check for medium risk keywords if not already high
    if (urgencyLevel === 'low') {
      this.riskKeywords.medium.forEach(keyword => {
        if (content.includes(keyword)) {
          riskKeywords.push(keyword);
          urgencyLevel = 'medium';
        }
      });
    }

    // Check for work capacity indicators
    const capacityIndicators = [
      'return to work', 'work restrictions', 'modified duties', 'unable to work',
      'cleared for duty', 'work capacity', 'fitness for work'
    ];
    
    capacityIndicators.forEach(indicator => {
      if (content.includes(indicator)) {
        workCapacityIndicators.push(indicator);
      }
    });

    // Determine suggested action
    let suggestedAction = 'Monitor case for updates';
    if (urgencyLevel === 'high') {
      suggestedAction = 'Immediate case review required - potential risk escalation';
    } else if (urgencyLevel === 'medium') {
      suggestedAction = 'Schedule case review within 24 hours';
    } else if (workCapacityIndicators.length > 0) {
      suggestedAction = 'Update work capacity assessment';
    }

    return {
      medicalTerms,
      riskKeywords,
      workCapacityIndicators,
      urgencyLevel,
      suggestedAction
    };
  }

  /**
   * Process individual risk input
   */
  private async processInput(input: RiskInput): Promise<RiskAssessmentResult> {
    switch (input.type) {
      case 'form':
        return this.processFormInput(input.content);
      case 'email':
        return this.processEmailInput(input.content);
      case 'medical_record':
        return this.processMedicalRecordInput(input.content);
      case 'manual_update':
        return this.processManualUpdate(input.content);
      default:
        return this.getDefaultAssessment();
    }
  }

  private processFormInput(formData: PreEmploymentFormData | InjuryFormData): RiskAssessmentResult {
    // Use existing analysis engine logic
    if ('liftingKg' in formData) {
      // Pre-employment form
      return this.analyzePreEmploymentForm(formData as PreEmploymentFormData);
    } else {
      // Injury form
      return this.analyzeInjuryForm(formData as InjuryFormData);
    }
  }

  private processEmailInput(emailData: { content: string; subject: string }): RiskAssessmentResult {
    const analysis = this.analyzeEmailContent(emailData.content, emailData.subject);
    
    let ragScore: "green" | "amber" | "red" = "green";
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    if (analysis.urgencyLevel === 'high') {
      ragScore = "red";
      riskFactors.push("High-risk medical terminology detected in communication");
      recommendations.push("Immediate medical assessment required");
    } else if (analysis.urgencyLevel === 'medium') {
      ragScore = "amber";
      riskFactors.push("Moderate risk indicators found in communication");
      recommendations.push("Schedule follow-up assessment within 24 hours");
    }

    if (analysis.medicalTerms.length > 0) {
      riskFactors.push(`Medical conditions mentioned: ${analysis.medicalTerms.join(", ")}`);
    }

    if (analysis.workCapacityIndicators.length > 0) {
      recommendations.push("Update work capacity assessment based on latest information");
    }

    return {
      ragScore,
      fitClassification: this.determineFitClassification(ragScore, riskFactors),
      confidence: 70, // Email analysis is less certain than structured forms
      riskFactors,
      recommendations,
      triggerReasons: [`Email analysis detected ${analysis.urgencyLevel} urgency level`]
    };
  }

  private processMedicalRecordInput(medicalData: any): RiskAssessmentResult {
    // Process medical record attachments - simplified for now
    return {
      ragScore: "amber",
      fitClassification: "fit_with_restrictions",
      confidence: 85,
      riskFactors: ["Medical documentation received"],
      recommendations: ["Review medical documentation for work restrictions"],
      triggerReasons: ["Medical record uploaded"]
    };
  }

  private processManualUpdate(updateData: { ragScore: "green" | "amber" | "red"; reason: string }): RiskAssessmentResult {
    return {
      ragScore: updateData.ragScore,
      fitClassification: this.determineFitClassification(updateData.ragScore, []),
      confidence: 100,
      riskFactors: [`Manual override: ${updateData.reason}`],
      recommendations: [],
      triggerReasons: [`Manual risk level update: ${updateData.reason}`]
    };
  }

  private analyzePreEmploymentForm(formData: PreEmploymentFormData): RiskAssessmentResult {
    // Existing pre-employment analysis logic
    const risks: string[] = [];
    let ragScore: "green" | "amber" | "red" = "green";
    const recommendations: string[] = [];

    // Lifting capacity assessment
    if (formData.liftingKg < 15) {
      risks.push("Low lifting capacity");
      ragScore = "amber";
      recommendations.push("Consider ergonomic assessment for lifting tasks");
    }

    // Musculoskeletal assessments
    const mskFields = [
      { field: formData.mskBack, name: "back", details: formData.mskBackDetails },
      { field: formData.mskNeck, name: "neck", details: formData.mskNeckDetails },
      { field: formData.mskShoulders, name: "shoulders", details: formData.mskShouldersDetails },
      // ... other MSK fields
    ];

    let currentIssues = 0;
    let pastIssues = 0;

    mskFields.forEach(({ field, name, details }) => {
      if (field === "current") {
        currentIssues++;
        risks.push(`Current ${name} issue: ${details || "Not specified"}`);
        recommendations.push(`Seek medical clearance for ${name} condition`);
      } else if (field === "past") {
        pastIssues++;
        recommendations.push(`Monitor ${name} for any recurring symptoms`);
      }
    });

    // Determine final RAG score
    if (currentIssues >= 2) {
      ragScore = "red";
    } else if (currentIssues === 1 || pastIssues >= 2) {
      ragScore = "amber";
    }

    return {
      ragScore,
      fitClassification: this.determineFitClassification(ragScore, risks),
      confidence: 95,
      riskFactors: risks,
      recommendations,
      triggerReasons: ["Pre-employment form analysis completed"]
    };
  }

  private analyzeInjuryForm(formData: InjuryFormData): RiskAssessmentResult {
    // Existing injury analysis logic
    const risks: string[] = [];
    let ragScore: "green" | "amber" | "red" = "green";
    const recommendations: string[] = [];

    // Severity assessment
    if (formData.severity === "major" || formData.severity === "serious") {
      ragScore = "red";
      risks.push(`${formData.severity} injury requiring comprehensive assessment`);
      recommendations.push("Immediate medical assessment required before return to work");
    } else if (formData.severity === "moderate") {
      ragScore = "amber";
      risks.push("Moderate injury requiring monitoring");
      recommendations.push("Modified duties may be required during recovery");
    }

    return {
      ragScore,
      fitClassification: this.determineFitClassification(ragScore, risks),
      confidence: 90,
      riskFactors: risks,
      recommendations,
      triggerReasons: ["Injury form analysis completed"]
    };
  }

  private determineFitClassification(ragScore: "green" | "amber" | "red", risks: string[]): string {
    if (ragScore === "red") return "not_fit";
    if (ragScore === "amber") return "fit_with_restrictions";
    return "fit";
  }

  /**
   * Check if this is a pre-employment assessment
   */
  private isPreEmploymentAssessment(inputs: RiskInput[]): boolean {
    return inputs.some(input => 
      input.type === 'form' && 
      input.source?.includes('pre_employment')
    );
  }

  /**
   * Validate probation period requirements for pre-employment checks
   */
  private async validateProbationRequirements(organizationId: string): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      const orgSettings = await this.storage.getOrganizationSettings(organizationId);
      
      if (!orgSettings) {
        return {
          isValid: false,
          reason: "Organization settings not found"
        };
      }

      // Check if probation is required
      if (orgSettings.preEmploymentRequiresProbation) {
        // If probation is required, check if probation period is configured
        if (!orgSettings.probationPeriodDays || orgSettings.probationPeriodDays <= 0) {
          return {
            isValid: false,
            reason: "Probation period required but not configured in organization settings"
          };
        }
      }

      return { isValid: true };

    } catch (error) {
      console.error('Error validating probation requirements:', error);
      return {
        isValid: false,
        reason: "Error checking probation requirements"
      };
    }
  }

  private getRiskLevel(ragScore: "green" | "amber" | "red"): number {
    switch (ragScore) {
      case "green": return 1;
      case "amber": return 2;
      case "red": return 3;
    }
  }

  /**
   * FLAGGING RULES (Traffic Light System)
   * 
   * Implements privacy-protected manager communication system:
   * - Sensitive answers are NEVER shared with managers
   * - Managers only see traffic light result and action statement
   * - Worker responses remain confidential
   * 
   * SPECIAL NOTE: Mental health check responses are never shared, 
   * only flag + inference shown to maintain patient confidentiality
   */
  private generateManagerFlag(ragScore: "green" | "amber" | "red", inputs: RiskInput[]): {
    color: "green" | "yellow" | "red";
    actionStatement: string;
    requiresReport: boolean;
  } {
    // Check if this is a mental health check
    const isMentalHealthCheck = inputs.some(input => 
      input.type === 'form' && 
      (input.source?.includes('mental') || input.content?.checkType === 'mental_health')
    );

    switch (ragScore) {
      case "green":
        return {
          color: "green",
          actionStatement: "Check completed — no action required.",
          requiresReport: false
        };
      
      case "amber":
        return {
          color: "yellow", 
          actionStatement: "Check completed — monitor worker, supportive strategies may help.",
          requiresReport: false
        };
      
      case "red":
        return {
          color: "red",
          actionStatement: isMentalHealthCheck 
            ? "Check completed — urgent attention recommended. Refer to confidential GPNet report."
            : "Check completed — urgent attention recommended. Refer to GPNet report.",
          requiresReport: true
        };
      
      default:
        return {
          color: "green",
          actionStatement: "Check completed — no action required.",
          requiresReport: false
        };
    }
  }

  private getDefaultAssessment(): RiskAssessmentResult {
    return {
      ragScore: "green",
      fitClassification: "fit",
      confidence: 50,
      riskFactors: [],
      recommendations: [],
      triggerReasons: [],
      managerFlag: {
        color: "green",
        actionStatement: "Check completed — no action required.",
        requiresReport: false
      }
    };
  }

  /**
   * Check if case needs risk re-evaluation based on time and new inputs
   */
  shouldReassess(lastAssessment: Date, newInputs: RiskInput[], currentRagScore: string): boolean {
    // Reassess if:
    // 1. New email with high/medium urgency
    // 2. New medical records
    // 3. More than 7 days since last assessment for amber/red cases
    // 4. More than 30 days for green cases

    const daysSinceAssessment = (Date.now() - lastAssessment.getTime()) / (1000 * 60 * 60 * 24);
    
    // Check for urgent new inputs
    const hasUrgentInput = newInputs.some(input => {
      if (input.type === 'email') {
        const analysis = this.analyzeEmailContent(input.content.content, input.content.subject);
        return analysis.urgencyLevel === 'high' || analysis.urgencyLevel === 'medium';
      }
      return input.type === 'medical_record';
    });

    if (hasUrgentInput) return true;

    // Time-based reassessment
    if (currentRagScore === 'red' && daysSinceAssessment > 3) return true;
    if (currentRagScore === 'amber' && daysSinceAssessment > 7) return true;
    if (currentRagScore === 'green' && daysSinceAssessment > 30) return true;

    return false;
  }
}

export const riskAssessmentService = new EnhancedRiskAssessmentService();
import { db } from "./db";
import { escalations, specialists, specialistAssignments, conversations, conversationMessages } from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import type { MichelleContext } from "./michelle";

// Escalation trigger rules configuration
export interface EscalationTrigger {
  type: "safety_concern" | "complex_case" | "legal_issue" | "medical_review" | "compliance_risk";
  priority: "low" | "medium" | "high" | "urgent";
  triggerConditions: {
    flags?: string[];
    keywords?: string[];
    confidence_threshold?: number;
    case_complexity?: number;
  };
  requiredSpecialization?: string;
  estimatedResolutionTime?: number;
}

// Default escalation rules - configurable by organization
const DEFAULT_ESCALATION_TRIGGERS: EscalationTrigger[] = [
  {
    type: "safety_concern",
    priority: "urgent",
    triggerConditions: {
      flags: ["self_harm", "immediate_danger", "safety_risk", "acute_distress"],
      keywords: ["suicide", "self-harm", "danger", "emergency", "urgent medical"]
    },
    requiredSpecialization: "occupational_health",
    estimatedResolutionTime: 15 // 15 minutes for urgent safety issues
  },
  {
    type: "medical_review",
    priority: "high", 
    triggerConditions: {
      flags: ["complex_medical", "specialist_required", "medical_assessment"],
      keywords: ["complex injury", "multiple conditions", "specialist opinion", "medical review"]
    },
    requiredSpecialization: "occupational_health",
    estimatedResolutionTime: 60 // 1 hour for medical reviews
  },
  {
    type: "legal_issue",
    priority: "high",
    triggerConditions: {
      flags: ["legal_advice", "compliance_violation", "litigation_risk"],
      keywords: ["legal action", "lawsuit", "discrimination", "unfair dismissal", "court"]
    },
    requiredSpecialization: "legal_compliance", 
    estimatedResolutionTime: 120 // 2 hours for legal issues
  },
  {
    type: "complex_case",
    priority: "medium",
    triggerConditions: {
      case_complexity: 8, // Cases rated 8+ out of 10
      confidence_threshold: 40 // AI confidence below 40%
    },
    requiredSpecialization: "complex_claims",
    estimatedResolutionTime: 90 // 1.5 hours for complex cases
  },
  {
    type: "compliance_risk",
    priority: "medium",
    triggerConditions: {
      flags: ["regulatory_compliance", "deadline_risk", "audit_requirement"],
      keywords: ["compliance", "regulation", "deadline", "audit", "workcover"]
    },
    requiredSpecialization: "legal_compliance",
    estimatedResolutionTime: 45 // 45 minutes for compliance issues
  }
];

export interface EscalationContext {
  conversationId: string;
  ticketId?: string;
  userMessage: string;
  aiResponse: string;
  confidence: number;
  flags: {
    risk: string[];
    compliance: string[];
    escalation: string[];
  };
  caseContext?: any;
  michelleContext: MichelleContext;
}

export interface SpecialistRoutingResult {
  specialist: any;
  routingScore: number;
  assignmentReason: string;
}

export class EscalationService {
  
  // Analyze if conversation should be escalated based on triggers
  async analyzeForEscalation(context: EscalationContext): Promise<{
    shouldEscalate: boolean;
    triggers: EscalationTrigger[];
    recommendedPriority: string;
    estimatedComplexity: number;
  }> {
    
    const triggeredRules: EscalationTrigger[] = [];
    
    // Check each escalation rule
    for (const rule of DEFAULT_ESCALATION_TRIGGERS) {
      if (await this.evaluateTrigger(rule, context)) {
        triggeredRules.push(rule);
      }
    }
    
    if (triggeredRules.length === 0) {
      return {
        shouldEscalate: false,
        triggers: [],
        recommendedPriority: "low",
        estimatedComplexity: 1
      };
    }
    
    // Determine highest priority and complexity
    const highestPriority = this.getHighestPriority(triggeredRules);
    const estimatedComplexity = this.calculateComplexity(triggeredRules, context);
    
    return {
      shouldEscalate: true,
      triggers: triggeredRules,
      recommendedPriority: highestPriority,
      estimatedComplexity
    };
  }
  
  // Evaluate if a specific trigger rule matches the context
  private async evaluateTrigger(trigger: EscalationTrigger, context: EscalationContext): Promise<boolean> {
    const { triggerConditions } = trigger;
    const { flags, userMessage, aiResponse, confidence } = context;
    
    // Check escalation flags
    if (triggerConditions.flags) {
      const hasMatchingFlag = triggerConditions.flags.some(flag => 
        flags.escalation.includes(flag) || 
        flags.risk.includes(flag) || 
        flags.compliance.includes(flag)
      );
      if (hasMatchingFlag) return true;
    }
    
    // Check keyword presence in messages
    if (triggerConditions.keywords) {
      const combinedText = `${userMessage} ${aiResponse}`.toLowerCase();
      const hasMatchingKeyword = triggerConditions.keywords.some(keyword => 
        combinedText.includes(keyword.toLowerCase())
      );
      if (hasMatchingKeyword) return true;
    }
    
    // Check confidence threshold
    if (triggerConditions.confidence_threshold && confidence < triggerConditions.confidence_threshold) {
      return true;
    }
    
    // Check case complexity
    if (triggerConditions.case_complexity) {
      const caseComplexity = await this.assessCaseComplexity(context);
      if (caseComplexity >= triggerConditions.case_complexity) {
        return true;
      }
    }
    
    return false;
  }
  
  // Create escalation and assign to specialist
  async createEscalation(
    context: EscalationContext,
    triggers: EscalationTrigger[],
    priority: string,
    complexity: number
  ): Promise<string> {
    
    const primaryTrigger = triggers[0]; // Use first trigger as primary
    
    // Create escalation record
    const [escalation] = await db.insert(escalations).values({
      conversationId: context.conversationId,
      ticketId: context.ticketId || null,
      escalationType: primaryTrigger.type,
      priority,
      triggerReason: this.generateTriggerReason(triggers),
      triggerFlags: triggers.map(t => t.triggerConditions),
      michelleContext: context.michelleContext,
      userContext: {
        lastMessage: context.userMessage,
        aiResponse: context.aiResponse,
        confidence: context.confidence,
        flags: context.flags
      },
      caseComplexity: complexity,
      estimatedResolutionTime: primaryTrigger.estimatedResolutionTime,
      handoffNotes: await this.generateHandoffNotes(context, triggers)
    }).returning();
    
    // Route to best available specialist
    const routingResult = await this.routeToSpecialist(escalation.id, triggers);
    
    if (routingResult) {
      // Create specialist assignment
      await db.insert(specialistAssignments).values({
        specialistId: routingResult.specialist.id,
        escalationId: escalation.id,
        conversationId: context.conversationId,
        assignmentType: "primary",
        assignmentReason: routingResult.assignmentReason,
        routingScore: routingResult.routingScore,
        estimatedTimeRequired: primaryTrigger.estimatedResolutionTime
      });
      
      // Update escalation with assigned specialist
      await db.update(escalations)
        .set({ 
          assignedSpecialistId: routingResult.specialist.id,
          status: "assigned",
          assignedAt: new Date()
        })
        .where(eq(escalations.id, escalation.id));
        
      // Update specialist caseload
      await db.update(specialists)
        .set({ 
          currentCaseload: sql`${specialists.currentCaseload} + 1`,
          lastSeenAt: new Date()
        })
        .where(eq(specialists.id, routingResult.specialist.id));
    }
    
    // Update conversation status to escalated
    await db.update(conversations)
      .set({ 
        status: "escalated",
        updatedAt: new Date()
      })
      .where(eq(conversations.id, context.conversationId));
    
    console.log(`Escalation created: ${escalation.id} for conversation: ${context.conversationId}`);
    return escalation.id;
  }
  
  // Route escalation to best available specialist
  private async routeToSpecialist(escalationId: string, triggers: EscalationTrigger[]): Promise<SpecialistRoutingResult | null> {
    
    const requiredSpecialization = triggers[0]?.requiredSpecialization;
    const priority = triggers[0]?.priority;
    
    // Get available specialists with matching specialization
    const availableSpecialists = await db.select()
      .from(specialists)
      .where(and(
        eq(specialists.isAvailable, true),
        eq(specialists.status, "active"),
        sql`${specialists.currentCaseload} < ${specialists.maxCaseload}`,
        requiredSpecialization ? eq(specialists.specialization, requiredSpecialization) : sql`true`
      ))
      .orderBy(
        asc(specialists.currentCaseload), // Prefer lower caseload
        desc(specialists.expertiseRating), // Prefer higher expertise
        asc(specialists.averageResponseTime) // Prefer faster response times
      );
    
    if (availableSpecialists.length === 0) {
      console.warn(`No available specialists found for escalation ${escalationId}`);
      return null;
    }
    
    const selectedSpecialist = availableSpecialists[0];
    
    // Calculate routing score based on multiple factors
    const routingScore = this.calculateRoutingScore(selectedSpecialist, triggers);
    
    const assignmentReason = this.generateAssignmentReason(selectedSpecialist, triggers);
    
    return {
      specialist: selectedSpecialist,
      routingScore,
      assignmentReason
    };
  }
  
  // Calculate routing confidence score (0-100)
  private calculateRoutingScore(specialist: any, triggers: EscalationTrigger[]): number {
    let score = 50; // Base score
    
    // Specialization match
    if (specialist.specialization === triggers[0]?.requiredSpecialization) {
      score += 30;
    }
    
    // Caseload factor (lower is better)
    const caseloadFactor = Math.max(0, 10 - specialist.currentCaseload);
    score += caseloadFactor;
    
    // Expertise rating (1-10 scale)
    score += specialist.expertiseRating || 5;
    
    // Response time factor (faster is better)
    const responseTimeFactor = Math.max(0, 10 - (specialist.averageResponseTime || 60) / 30);
    score += responseTimeFactor;
    
    return Math.min(100, Math.max(0, score));
  }
  
  // Generate human-readable assignment reason
  private generateAssignmentReason(specialist: any, triggers: EscalationTrigger[]): string {
    const reasons = [];
    
    if (specialist.specialization === triggers[0]?.requiredSpecialization) {
      reasons.push(`specialized in ${specialist.specialization}`);
    }
    
    if (specialist.currentCaseload < 3) {
      reasons.push("low current caseload");
    }
    
    if (specialist.expertiseRating >= 8) {
      reasons.push("high expertise rating");
    }
    
    if (specialist.averageResponseTime <= 30) {
      reasons.push("fast response time");
    }
    
    return reasons.length > 0 
      ? `Selected: ${reasons.join(", ")}` 
      : "Best available specialist";
  }
  
  // Generate comprehensive handoff notes for specialist
  private async generateHandoffNotes(context: EscalationContext, triggers: EscalationTrigger[]): Promise<string> {
    const triggerTypes = triggers.map(t => t.type).join(", ");
    const priority = triggers[0]?.priority || "medium";
    
    const notes = [
      `ESCALATION SUMMARY`,
      `Priority: ${priority.toUpperCase()}`,
      `Trigger Types: ${triggerTypes}`,
      `AI Confidence: ${context.confidence}%`,
      ``,
      `CONVERSATION CONTEXT:`,
      `User Message: "${context.userMessage.substring(0, 200)}${context.userMessage.length > 200 ? "..." : ""}"`,
      `AI Response: "${context.aiResponse.substring(0, 200)}${context.aiResponse.length > 200 ? "..." : ""}"`,
      ``,
      `FLAGS DETECTED:`,
      `Risk: ${context.flags.risk.join(", ") || "None"}`,
      `Compliance: ${context.flags.compliance.join(", ") || "None"}`,
      `Escalation: ${context.flags.escalation.join(", ") || "None"}`,
      ``,
      `RECOMMENDED ACTIONS:`,
      `- Review conversation history for full context`,
      `- Assess complexity and provide specialist guidance`,
      `- Coordinate with relevant stakeholders if needed`,
      `- Document resolution and update case status`
    ];
    
    return notes.join("\n");
  }
  
  // Helper methods
  private getHighestPriority(triggers: EscalationTrigger[]): string {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    return triggers.reduce((highest, trigger) => {
      return priorityOrder[trigger.priority as keyof typeof priorityOrder] > 
             priorityOrder[highest as keyof typeof priorityOrder] ? trigger.priority : highest;
    }, "low");
  }
  
  private calculateComplexity(triggers: EscalationTrigger[], context: EscalationContext): number {
    let complexity = 3; // Base complexity
    
    // Add complexity based on trigger types
    if (triggers.some(t => t.type === "safety_concern")) complexity += 3;
    if (triggers.some(t => t.type === "legal_issue")) complexity += 2;
    if (triggers.some(t => t.type === "medical_review")) complexity += 2;
    if (triggers.length > 1) complexity += 1; // Multiple triggers
    
    // Factor in AI confidence
    if (context.confidence < 30) complexity += 2;
    else if (context.confidence < 50) complexity += 1;
    
    return Math.min(10, complexity);
  }
  
  private async assessCaseComplexity(context: EscalationContext): Promise<number> {
    // Simple complexity assessment - can be enhanced with ML models
    let complexity = 1;
    
    const messageText = `${context.userMessage} ${context.aiResponse}`.toLowerCase();
    
    // Check for complexity indicators
    const complexityIndicators = [
      "multiple injuries", "chronic condition", "pre-existing", "complex case",
      "legal action", "dispute", "disagreement", "complicated", "unclear"
    ];
    
    complexity += complexityIndicators.filter(indicator => 
      messageText.includes(indicator)
    ).length;
    
    // Flag-based complexity
    const totalFlags = context.flags.risk.length + context.flags.compliance.length + context.flags.escalation.length;
    complexity += Math.min(3, totalFlags);
    
    return Math.min(10, complexity);
  }
  
  private generateTriggerReason(triggers: EscalationTrigger[]): string {
    if (triggers.length === 1) {
      return `${triggers[0].type.replace("_", " ")} detected`;
    }
    
    const types = triggers.map(t => t.type.replace("_", " "));
    return `Multiple triggers: ${types.join(", ")}`;
  }
  
  // Get escalation status for conversation
  async getEscalationStatus(conversationId: string): Promise<any> {
    const escalation = await db.select()
      .from(escalations)
      .where(eq(escalations.conversationId, conversationId))
      .orderBy(desc(escalations.createdAt))
      .limit(1);
    
    if (escalation.length === 0) return null;
    
    const assignments = await db.select()
      .from(specialistAssignments)
      .leftJoin(specialists, eq(specialistAssignments.specialistId, specialists.id))
      .where(eq(specialistAssignments.escalationId, escalation[0].id));
    
    return {
      escalation: escalation[0],
      assignments
    };
  }
  
  // Update escalation status
  async updateEscalationStatus(escalationId: string, status: string, notes?: string): Promise<void> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (status === "resolved") {
      updateData.resolvedAt = new Date();
      updateData.resolutionNotes = notes;
    }
    
    if (status === "in_progress" && !updateData.firstResponseAt) {
      updateData.firstResponseAt = new Date();
    }
    
    await db.update(escalations)
      .set(updateData)
      .where(eq(escalations.id, escalationId));
  }
}

export const escalationService = new EscalationService();
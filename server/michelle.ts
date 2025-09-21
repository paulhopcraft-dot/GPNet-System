import OpenAI from "openai";
import { db } from "./db";
import { conversations, conversationMessages, tickets, workers, organizations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { escalationService } from "./escalationService";
import type { EscalationContext } from "./escalationService";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MichelleContext {
  conversationType: "client_scoped" | "universal_admin" | "case_specific";
  organizationId?: string;
  ticketId?: string;
  workerId?: string;
  userRole?: "admin" | "client_user";
  isImpersonating?: boolean;
}

export interface ConversationResponse {
  conversationId: string;
  response: string;
  nextStepSuggestion?: string;
  confidence: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class MichelleAI {
  
  async startConversation(context: MichelleContext): Promise<string> {
    const sessionId = uuidv4();
    
    const [conversation] = await db.insert(conversations).values({
      organizationId: context.organizationId || null,
      ticketId: context.ticketId || null,
      workerId: context.workerId || null,
      conversationType: context.conversationType,
      sessionId,
      title: this.generateConversationTitle(context),
      status: "active",
      isPrivate: context.conversationType === "universal_admin",
      accessLevel: context.userRole === "admin" ? "restricted" : "standard"
    }).returning();

    return conversation.id;
  }

  async sendMessage(
    conversationId: string, 
    userMessage: string, 
    context: MichelleContext,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConversationResponse> {
    
    // Get conversation context
    const conversation = await this.getConversationWithContext(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Build case context for AI
    const caseContext = await this.buildCaseContext(conversation, context);
    
    // Get conversation history
    const messages = await this.getConversationHistory(conversationId);
    
    // Create system prompt based on context
    const systemPrompt = this.createSystemPrompt(context, caseContext);
    
    // Prepare messages for OpenAI
    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      })),
      { role: "user" as const, content: userMessage }
    ];

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: openaiMessages,
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || "{}");
    
    // Store user message
    await db.insert(conversationMessages).values({
      conversationId,
      role: "user",
      content: userMessage,
      caseContext,
      ipAddress,
      userAgent
    });

    // Store AI response
    await db.insert(conversationMessages).values({
      conversationId,
      role: "assistant", 
      content: aiResponse.response || "I apologize, but I couldn't generate a proper response.",
      messageType: aiResponse.messageType || "text",
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      model: "gpt-5",
      confidence: aiResponse.confidence || 85,
      caseContext,
      nextStepSuggestion: aiResponse.nextStep,
      ipAddress,
      userAgent
    });

    // Update conversation metadata
    await db.update(conversations)
      .set({ 
        updatedAt: new Date(),
        summary: aiResponse.summary 
      })
      .where(eq(conversations.id, conversationId));

    // Check for escalation triggers
    const escalationContext: EscalationContext = {
      conversationId,
      ticketId: conversation.ticketId || undefined,
      userMessage,
      aiResponse: aiResponse.response || "",
      confidence: aiResponse.confidence || 85,
      flags: aiResponse.flags || { risk: [], compliance: [], escalation: [] },
      caseContext,
      michelleContext: context
    };

    const escalationAnalysis = await escalationService.analyzeForEscalation(escalationContext);

    let finalResponse = aiResponse.response;
    let finalNextStep = aiResponse.nextStep;

    // Handle escalation if needed
    if (escalationAnalysis.shouldEscalate) {
      console.log(`Escalation triggered for conversation ${conversationId}:`, escalationAnalysis.triggers.map(t => t.type));
      
      const escalationId = await escalationService.createEscalation(
        escalationContext,
        escalationAnalysis.triggers,
        escalationAnalysis.recommendedPriority,
        escalationAnalysis.estimatedComplexity
      );

      // Modify response to inform user about escalation
      finalResponse = this.generateEscalationResponse(escalationAnalysis, escalationId);
      finalNextStep = "Waiting for specialist review - you will be contacted shortly";

      // Store escalation message
      await db.insert(conversationMessages).values({
        conversationId,
        role: "assistant",
        content: finalResponse,
        messageType: "escalation",
        model: "gpt-5",
        confidence: 100,
        caseContext: { ...caseContext, escalationId, escalationType: escalationAnalysis.triggers[0]?.type },
        nextStepSuggestion: finalNextStep,
        ipAddress,
        userAgent
      });
    }

    return {
      conversationId,
      response: finalResponse,
      nextStepSuggestion: finalNextStep,
      confidence: aiResponse.confidence || 85,
      tokenUsage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0
      }
    };
  }

  private async getConversationWithContext(conversationId: string) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    
    return conversation;
  }

  private async buildCaseContext(conversation: any, context: MichelleContext) {
    const caseContext: any = {
      conversationType: conversation.conversationType,
      timestamp: new Date().toISOString()
    };

    // Add case-specific context
    if (conversation.ticketId) {
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, conversation.ticketId))
        .limit(1);
      
      if (ticket) {
        caseContext.case = {
          id: ticket.id,
          type: ticket.caseType,
          status: ticket.status,
          priority: ticket.priority,
          nextStep: ticket.nextStep,
          companyName: ticket.companyName
        };
      }
    }

    // Add worker context
    if (conversation.workerId) {
      const [worker] = await db
        .select()
        .from(workers)
        .where(eq(workers.id, conversation.workerId))
        .limit(1);
      
      if (worker) {
        caseContext.worker = {
          id: worker.id,
          name: `${worker.firstName} ${worker.lastName}`,
          role: worker.roleApplied
        };
      }
    }

    // Add organization context for client-scoped conversations
    if (conversation.organizationId && context.conversationType === "client_scoped") {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, conversation.organizationId))
        .limit(1);
      
      if (org) {
        caseContext.organization = {
          name: org.name,
          slug: org.slug
        };
      }
    }

    return caseContext;
  }

  async getConversationHistory(conversationId: string, limit = 20) {
    return await db
      .select({
        role: conversationMessages.role,
        content: conversationMessages.content,
        timestamp: conversationMessages.timestamp
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(desc(conversationMessages.timestamp))
      .limit(limit);
  }

  private createSystemPrompt(context: MichelleContext, caseContext: any): string {
    const basePrompt = `You are Michelle, an AI assistant for GPNet's pre-employment and workplace health management system. You help with case management, health assessments, and return-to-work planning.

RESPONSE FORMAT: Always respond with valid JSON in this format:
{
  "response": "Your conversational response here",
  "nextStep": "Suggested next action (optional)",
  "confidence": 85,
  "messageType": "text",
  "summary": "Brief conversation summary"
}

TONE AND LANGUAGE:
- Professional but warm and supportive
- Use "reported" or "perceived" language when discussing health conditions
- Never provide medical advice or diagnoses
- Always suggest consulting healthcare professionals for medical concerns
- Be empathetic especially for injury-related cases

PRIVACY AND COMPLIANCE:
- Respect PHI (Protected Health Information) guidelines
- Only discuss information relevant to the current context
- Maintain confidentiality boundaries based on user access level`;

    if (context.conversationType === "universal_admin") {
      return `${basePrompt}

ADMIN MODE: You have platform-wide access but must redact PHI appropriately. You can:
- Analyze trends across multiple organizations (anonymized)
- Provide system insights and recommendations
- Help with platform administration
- NEVER expose specific worker details cross-tenant without proper authorization

Current context: Admin user${context.isImpersonating ? ' (impersonating)' : ''}`;
    }

    if (context.conversationType === "case_specific" && caseContext.case) {
      return `${basePrompt}

CASE-SPECIFIC MODE: You're helping with case ${caseContext.case.id}
Case Type: ${caseContext.case.type}
Status: ${caseContext.case.status}
Next Step: ${caseContext.case.nextStep}
${caseContext.worker ? `Worker: ${caseContext.worker.name} (${caseContext.worker.role})` : ''}

Focus on helping progress this specific case through the appropriate workflow.`;
    }

    return `${basePrompt}

CLIENT-SCOPED MODE: You're helping with ${caseContext.organization?.name || 'client'} organization.
You can access and discuss cases, workers, and data only within this organization's scope.
Always propose relevant next steps to keep cases progressing efficiently.`;
  }

  private generateConversationTitle(context: MichelleContext): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    switch (context.conversationType) {
      case "universal_admin":
        return `Admin Chat - ${timeStr}`;
      case "case_specific":
        return `Case Discussion - ${timeStr}`;
      default:
        return `Client Chat - ${timeStr}`;
    }
  }

  private generateEscalationResponse(escalationAnalysis: any, escalationId: string): string {
    const triggerTypes = escalationAnalysis.triggers.map((t: any) => t.type).join(", ");
    const priority = escalationAnalysis.recommendedPriority;
    
    let escalationMessage = "";
    
    // Customize message based on escalation type and priority
    if (escalationAnalysis.triggers.some((t: any) => t.type === "safety_concern")) {
      escalationMessage = `I understand you have a safety concern that requires immediate specialist attention. I'm connecting you with one of our occupational health specialists who will review your case and contact you shortly.`;
    } else if (escalationAnalysis.triggers.some((t: any) => t.type === "medical_review")) {
      escalationMessage = `Your case requires specialized medical review that goes beyond my expertise. I'm forwarding this to one of our medical specialists who will provide you with the appropriate guidance.`;
    } else if (escalationAnalysis.triggers.some((t: any) => t.type === "legal_issue")) {
      escalationMessage = `I've identified that your situation may have legal compliance aspects that require specialist review. I'm escalating this to our legal compliance team to ensure you receive accurate guidance.`;
    } else if (escalationAnalysis.triggers.some((t: any) => t.type === "complex_case")) {
      escalationMessage = `Your case appears to be quite complex and would benefit from human specialist review. I'm transferring you to one of our experienced case coordinators who can provide more detailed assistance.`;
    } else {
      escalationMessage = `I'm connecting you with one of our human specialists who can provide more comprehensive assistance with your situation.`;
    }

    const priorityNote = priority === "urgent" 
      ? " This has been marked as urgent priority."
      : priority === "high" 
      ? " This has been marked as high priority." 
      : "";

    const handoffMessage = `\n\nYour conversation reference is: ${escalationId.substring(0, 8)}. A specialist will review your case and contact you within the appropriate timeframe.${priorityNote}`;

    return escalationMessage + handoffMessage;
  }

  async archiveConversation(conversationId: string) {
    await db
      .update(conversations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
}

export const michelle = new MichelleAI();
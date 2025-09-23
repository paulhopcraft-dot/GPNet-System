import OpenAI from "openai";
import { db } from "./db";
import { conversations, conversationMessages, tickets, workers, organizations, externalEmails, aiRecommendations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { escalationService } from "./escalationService";
import type { EscalationContext } from "./escalationService";
import type { ParsedEmail } from "./emailParsingService";
import type { MatchResult } from "./caseMatchingService";

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

export interface EmailAnalysisResult {
  summary: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  extractedActions: string[];
  keyEntities: {
    people: string[];
    dates: string[];
    medicalTerms: string[];
    locations: string[];
  };
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  confidence: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AiRecommendationResult {
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    suggestedAction: string;
    actionDetails: any;
    estimatedTimeframe: string;
    reasoning: string;
    confidence: number;
  }>;
  overallAssessment: string;
  nextSteps: string[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class MichelleAI {
  
  async startConversation(context: MichelleContext): Promise<string> {
    const sessionId = uuidv4();
    
    const [conversation] = await db.insert(conversations).values({
      companyId: context.organizationId || null,
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

    // Check for valid OpenAI API key
    const isValidApiKey = process.env.OPENAI_API_KEY && 
                         process.env.OPENAI_API_KEY.startsWith('sk-') && 
                         !process.env.OPENAI_API_KEY.includes('****') && 
                         !process.env.OPENAI_API_KEY.includes('youtube') &&
                         !process.env.OPENAI_API_KEY.includes('http');

    let aiResponse;
    let response;

    if (isValidApiKey) {
      // Call OpenAI
      response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: openaiMessages,
        response_format: { type: "json_object" },
      });

      aiResponse = JSON.parse(response.choices[0].message.content || "{}");
    } else {
      // Demo mode with intelligent responses
      aiResponse = this.generateDemoResponse(userMessage, context, caseContext);
      response = {
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100
        }
      };
    }
    
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

  /**
   * Analyze an email using AI to extract key information and insights
   */
  async analyzeEmail(
    parsedEmail: ParsedEmail,
    matchResult?: MatchResult,
    context?: { organizationId: string; ticketId?: string }
  ): Promise<EmailAnalysisResult> {
    try {
      const systemPrompt = `You are Michelle, an AI assistant specializing in workers' compensation and RTW (Return to Work) case management.
      
Your task is to analyze incoming emails and provide structured insights to help case managers understand the content and decide on appropriate actions.

ANALYSIS REQUIREMENTS:
1. Summarize the email content concisely (2-3 sentences)
2. Determine urgency level based on content and context
3. Extract specific actionable items mentioned in the email
4. Identify key entities (people, dates, medical terms, locations)
5. Assess the sentiment/tone of the email
6. Provide confidence score for your analysis

URGENCY LEVELS:
- CRITICAL: Safety concerns, emergency medical situations, legal deadlines
- HIGH: Medical appointments, time-sensitive documents, escalating issues
- MEDIUM: Regular updates, routine requests, scheduling matters
- LOW: General inquiries, administrative updates, non-urgent communications

RESPONSE FORMAT: Respond with valid JSON only:
{
  "summary": "Brief 2-3 sentence summary",
  "urgencyLevel": "low|medium|high|critical",
  "extractedActions": ["action1", "action2"],
  "keyEntities": {
    "people": ["names mentioned"],
    "dates": ["dates found"],
    "medicalTerms": ["medical conditions, treatments"],
    "locations": ["clinics, workplaces"]
  },
  "sentiment": "positive|neutral|negative|urgent",
  "confidence": 85
}`;

      const emailContent = `
EMAIL ANALYSIS REQUEST:

From: ${parsedEmail.originalSender} ${parsedEmail.originalSenderName ? `(${parsedEmail.originalSenderName})` : ''}
Subject: ${parsedEmail.subject}
Original Subject: ${parsedEmail.originalSubject || 'N/A'}
Forwarded by: ${parsedEmail.forwardedBy}

EMAIL BODY:
${parsedEmail.body}

EXTRACTED ENTITIES:
${JSON.stringify(parsedEmail.extractedEntities, null, 2)}

CASE MATCHING CONTEXT:
${matchResult ? `
Best Match: ${matchResult.bestMatch ? `${matchResult.bestMatch.workerName} (Confidence: ${matchResult.bestMatch.confidenceScore}%)` : 'No match found'}
Match Type: ${matchResult.bestMatch?.matchType || 'N/A'}
Alternative Matches: ${matchResult.alternativeMatches.length}
` : 'No case matching performed'}

Please analyze this email and provide structured insights.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: emailContent }
        ],
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");

      return {
        summary: analysis.summary || "Unable to generate summary",
        urgencyLevel: analysis.urgencyLevel || "medium",
        extractedActions: analysis.extractedActions || [],
        keyEntities: analysis.keyEntities || { people: [], dates: [], medicalTerms: [], locations: [] },
        sentiment: analysis.sentiment || "neutral",
        confidence: analysis.confidence || 75,
        tokenUsage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0
        }
      };
    } catch (error) {
      console.error("Email analysis failed:", error);
      throw new Error(`Failed to analyze email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate AI recommendations based on email analysis and case context
   */
  async generateRecommendations(
    emailAnalysis: EmailAnalysisResult,
    parsedEmail: ParsedEmail,
    matchResult?: MatchResult,
    caseContext?: any
  ): Promise<AiRecommendationResult> {
    try {
      const systemPrompt = `You are Michelle, an AI assistant specializing in workers' compensation and RTW case management.

Your task is to generate actionable recommendations based on email analysis and case context to help managers decide on appropriate next steps.

RECOMMENDATION TYPES:
- next_step: Immediate actions to progress the case
- follow_up: Schedule follow-up communications
- escalation: Escalate to specialists or management
- document_request: Request additional documentation
- medical_review: Require medical assessment
- rtw_planning: Return to work planning activities
- compliance_check: Ensure regulatory compliance

PRIORITY LEVELS:
- URGENT: Immediate action required (within hours)
- HIGH: Action needed within 24-48 hours
- MEDIUM: Action needed within a week
- LOW: Non-urgent, can be addressed in regular workflow

RESPONSE FORMAT: Respond with valid JSON only:
{
  "recommendations": [
    {
      "type": "recommendation_type",
      "title": "Brief title",
      "description": "Detailed description of what should be done",
      "priority": "low|medium|high|urgent",
      "suggestedAction": "specific_action_type",
      "actionDetails": {"key": "value"},
      "estimatedTimeframe": "immediate|within_24h|within_week",
      "reasoning": "Why this recommendation is made",
      "confidence": 85
    }
  ],
  "overallAssessment": "Overall assessment of the situation",
  "nextSteps": ["immediate next step 1", "immediate next step 2"]
}`;

      const requestContent = `
RECOMMENDATION REQUEST:

EMAIL ANALYSIS:
Summary: ${emailAnalysis.summary}
Urgency: ${emailAnalysis.urgencyLevel}
Actions: ${emailAnalysis.extractedActions.join(', ')}
Sentiment: ${emailAnalysis.sentiment}

EMAIL DETAILS:
From: ${parsedEmail.originalSender}
Subject: ${parsedEmail.subject}
Body Preview: ${parsedEmail.body.substring(0, 500)}${parsedEmail.body.length > 500 ? '...' : ''}

CASE MATCHING:
${matchResult?.bestMatch ? `
Matched Case: ${matchResult.bestMatch.workerName}
Match Confidence: ${matchResult.bestMatch.confidenceScore}%
Match Type: ${matchResult.bestMatch.matchType}
Reasoning: ${matchResult.bestMatch.matchReasoning}
` : 'No case match found - may require manual case creation or linking'}

CASE CONTEXT:
${caseContext ? JSON.stringify(caseContext, null, 2) : 'No existing case context available'}

Based on this information, generate specific actionable recommendations for the case manager.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: requestContent }
        ],
        response_format: { type: "json_object" },
      });

      const recommendations = JSON.parse(response.choices[0].message.content || "{}");

      return {
        recommendations: recommendations.recommendations || [],
        overallAssessment: recommendations.overallAssessment || "Unable to generate assessment",
        nextSteps: recommendations.nextSteps || [],
        tokenUsage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0
        }
      };
    } catch (error) {
      console.error("Recommendation generation failed:", error);
      throw new Error(`Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store AI recommendations in the database
   */
  async storeRecommendations(
    recommendations: AiRecommendationResult,
    ticketId: string,
    externalEmailId?: string,
    conversationId?: string
  ): Promise<string[]> {
    try {
      const storedRecommendations = [];

      for (const rec of recommendations.recommendations) {
        const [stored] = await db.insert(aiRecommendations).values({
          ticketId,
          externalEmailId,
          conversationId,
          recommendationType: rec.type,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          suggestedAction: rec.suggestedAction,
          actionDetails: rec.actionDetails,
          estimatedTimeframe: rec.estimatedTimeframe,
          confidenceScore: rec.confidence,
          model: "gpt-5",
          reasoning: rec.reasoning,
          status: "pending"
        }).returning();

        storedRecommendations.push(stored.id);
      }

      return storedRecommendations;
    } catch (error) {
      console.error("Failed to store recommendations:", error);
      throw new Error(`Failed to store recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process email with full AI analysis workflow
   */
  async processEmailWithAI(
    parsedEmail: ParsedEmail,
    matchResult?: MatchResult,
    context?: { organizationId: string; ticketId?: string }
  ): Promise<{
    analysis: EmailAnalysisResult;
    recommendations: AiRecommendationResult;
    storedRecommendationIds?: string[];
  }> {
    try {
      // Analyze the email
      const analysis = await this.analyzeEmail(parsedEmail, matchResult, context);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        analysis, 
        parsedEmail, 
        matchResult,
        context
      );

      // Store recommendations if we have a ticket ID
      let storedRecommendationIds: string[] | undefined;
      if (context?.ticketId) {
        storedRecommendationIds = await this.storeRecommendations(
          recommendations,
          context.ticketId,
          undefined, // externalEmailId will be set when email is stored
          undefined  // conversationId not applicable here
        );
      }

      return {
        analysis,
        recommendations,
        storedRecommendationIds
      };
    } catch (error) {
      console.error("Email processing with AI failed:", error);
      throw error;
    }
  }

  async archiveConversation(conversationId: string) {
    await db
      .update(conversations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * Generate intelligent demo responses when OpenAI API is not available
   */
  private generateDemoResponse(userMessage: string, context: MichelleContext, caseContext: any) {
    const lowerMessage = userMessage.toLowerCase();
    let response = "Thank you for reaching out. I'm Michelle, your AI assistant for occupational health and safety matters. ";
    let nextStep = "Continue the conversation to get specific guidance";
    let confidence = 85;

    // Emergency detection
    const emergencyKeywords = ['suicide', 'kill myself', 'end it all', 'hurt myself', 'self harm', 'not worth living'];
    if (emergencyKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return {
        response: "🚨 IMMEDIATE SAFETY CONCERN DETECTED 🚨\n\nIf you or someone else is in immediate danger, please:\n• Call emergency services (000 in Australia)\n• Contact Lifeline: 13 11 14\n• Go to your nearest emergency department\n\nI cannot provide crisis counseling, but I can help you access professional support resources once safety is ensured.",
        nextStep: "Ensure immediate safety first, then we can discuss appropriate support resources",
        confidence: 100,
        messageType: "emergency"
      };
    }

    // Context-based responses
    if (context.conversationType === "universal_admin") {
      response += "[Admin Mode] I have access to platform-wide analytics and can help with system insights. ";
    } else if (context.conversationType === "case_specific" && caseContext.case) {
      response += `I'm helping with case ${caseContext.case.id} for ${caseContext.worker?.name || 'this worker'}. `;
    }

    // Content-based intelligent responses
    if (lowerMessage.includes('pre-employment') || lowerMessage.includes('pre employment')) {
      response += "I can help you with pre-employment health checks, including risk assessments, capacity evaluations, and fit-for-work determinations. What specific aspects would you like guidance on?";
      nextStep = "Provide details about the role and any specific health concerns";
    } else if (lowerMessage.includes('mental health') || lowerMessage.includes('psychological')) {
      response += "I can assist with mental health screenings and psychosocial risk assessments. All mental health discussions are handled with strict confidentiality. What type of assessment do you need?";
      nextStep = "Discuss specific mental health screening requirements";
    } else if (lowerMessage.includes('injury') || lowerMessage.includes('injured') || lowerMessage.includes('hurt')) {
      response += "I can help with injury assessments, return-to-work planning, and capacity evaluations. Please tell me about the nature of the injury and any current restrictions.";
      nextStep = "Gather detailed injury information and current functional capacity";
    } else if (lowerMessage.includes('capacity') || lowerMessage.includes('lifting')) {
      response += "I can help evaluate physical work capacity, including lifting limits, manual handling abilities, and workplace restrictions. What specific capacity assessment do you need?";
      nextStep = "Define the physical requirements of the role";
    } else if (lowerMessage.includes('return to work') || lowerMessage.includes('rtw')) {
      response += "I can assist with return-to-work planning, including graduated programs, workplace modifications, and fitness-for-duty assessments. What stage of the RTW process are you at?";
      nextStep = "Review current medical clearances and workplace requirements";
    } else if (lowerMessage.includes('medical opinion') || lowerMessage.includes('doctor')) {
      response += "I can help coordinate medical opinions and specialist consultations. For complex cases, I can escalate to our medical team. What medical guidance do you need?";
      nextStep = "Escalate to medical specialist if required";
      confidence = 90;
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('help')) {
      response += "I'm here to help with occupational health assessments, workplace safety, and case management. I can assist with pre-employment checks, injury assessments, mental health screenings, and return-to-work planning. What can I help you with today?";
      nextStep = "Specify the type of health assessment or guidance needed";
    } else {
      response += "I can help with various occupational health matters including pre-employment assessments, injury evaluations, mental health screenings, and return-to-work planning. Could you provide more details about what you need assistance with?";
      nextStep = "Clarify the specific health or safety matter you need help with";
    }

    return {
      response,
      nextStep,
      confidence,
      messageType: "text",
      summary: `Demo conversation about ${lowerMessage.includes('pre-employment') ? 'pre-employment checks' : 
                                        lowerMessage.includes('mental health') ? 'mental health assessment' :
                                        lowerMessage.includes('injury') ? 'injury assessment' : 
                                        'occupational health matters'}`
    };
  }

  /**
   * Simple chat interface for the Michelle widget
   * This wraps the more complex conversation management for easy frontend use
   */
  async chat(
    conversationId: string,
    message: string,
    userContext: MichelleContext,
    context?: {
      currentPage?: string;
      caseId?: string;
      workerName?: string;
      checkType?: string;
    }
  ): Promise<ConversationResponse> {
    try {
      // Check if conversation exists, if not create one
      const existingConversation = await this.getConversationWithContext(conversationId);
      
      if (!existingConversation) {
        // Create new conversation with the specific ID
        const michelleContext: MichelleContext = {
          conversationType: context?.caseId ? "case_specific" : "client_scoped",
          organizationId: userContext.organizationId,
          ticketId: context?.caseId,
          userRole: userContext.userRole || "client_user"
        };
        
        // Create conversation record directly with the provided ID
        await db.insert(conversations).values({
          id: conversationId,
          companyId: michelleContext.organizationId || null,
          ticketId: michelleContext.ticketId || null,
          workerId: null,
          conversationType: michelleContext.conversationType,
          sessionId: `session_${Date.now()}`,
          title: this.generateConversationTitle(michelleContext),
          status: "active",
          isPrivate: michelleContext.conversationType === "universal_admin",
          accessLevel: michelleContext.userRole === "admin" ? "restricted" : "standard"
        });
      }

      // Send message and get response
      return await this.sendMessage(conversationId, message, userContext);
      
    } catch (error) {
      console.error("Chat error:", error);
      // Fallback response for errors
      return {
        conversationId,
        response: "I apologize, but I encountered an issue processing your request. Please try again or contact support if the problem persists.",
        confidence: 50,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0
        }
      };
    }
  }
}

export const michelle = new MichelleAI();
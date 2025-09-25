import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MichelleResponse {
  reply: string;
  nextQuestions: string[];
  conversationId: string;
  mode: 'client-scoped' | 'universal';
  accessLevel: 'client' | 'admin';
  dialogueMode?: 'standard' | 'doctor' | 'triage_nurse' | 'mental_health_intake' | 'exit_guidance';
  escalationAvailable?: boolean;
  requiresEscalation?: boolean;
  emergencyAlert?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UserContext {
  userId: string;
  userType: 'client' | 'admin';
  organizationId?: string;
  permissions?: string[];
  phiAccess?: boolean;
  isSuperuser?: boolean;
}

// Simple in-memory conversation storage for demo
const conversations: Map<string, ChatMessage[]> = new Map();

export async function chatWithMichelle(
  conversationId: string,
  message: string,
  userContext: UserContext,
  context?: {
    currentPage?: string;
    caseId?: string;
    workerName?: string;
    checkType?: string;
    dialogueMode?: 'standard' | 'doctor' | 'triage_nurse' | 'mental_health_intake' | 'exit_guidance';
    healthConcerns?: string;
    preEmploymentData?: any;
  }
): Promise<MichelleResponse> {
  try {
    // Get or create conversation history
    let history = conversations.get(conversationId) || [];
    
    // Add user message to history
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // ALWAYS use OpenAI - user confirms they have working key
    const isValidApiKey = true;

    // Determine Michelle's mode based on user context
    const mode = userContext.userType === 'admin' && userContext.isSuperuser 
      ? 'universal' : 'client-scoped';
    const accessLevel = userContext.userType;
    
    // Determine dialogue mode based on context
    const dialogueMode = context?.dialogueMode || 'standard';
    const checkType = context?.checkType || 'pre_employment';
    
    // Emergency detection for mental health scenarios
    const emergencyKeywords = ['suicide', 'kill myself', 'end it all', 'hurt myself', 'self harm', 'not worth living'];
    const hasEmergencyFlag = emergencyKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    // Escalation detection for complex medical scenarios based on content
    const escalationKeywords = [
      'complex', 'unclear', 'multiple conditions', 'requires medical opinion', 'doctor needed',
      'medical complexity', 'contradictory', 'conflicting symptoms', 'unusual presentation',
      'specialist required', 'beyond scope', 'needs physician', 'medical uncertainty'
    ];
    const complexityIndicators = [
      'multiple medications', 'chronic conditions', 'previous surgeries', 
      'disability', 'compensation claim', 'work restrictions'
    ];
    
    const hasEscalationKeywords = escalationKeywords.some(keyword => message.toLowerCase().includes(keyword));
    const hasComplexityIndicators = complexityIndicators.some(indicator => message.toLowerCase().includes(indicator));
    const requiresEscalation = hasEscalationKeywords || hasComplexityIndicators;
    
    // Doctor mode enables escalation capability but doesn't force it
    const escalationAvailable = dialogueMode === 'doctor' || requiresEscalation;
    
    if (!isValidApiKey) {
      console.log('Running in demo mode - using simulated responses');
      
      let reply = "Thank you for your question. ";
      let nextQuestions: string[] = [];
      
      const lowerMessage = message.toLowerCase();
      
      // Add mode-specific context to demo responses
      if (mode === 'universal') {
        reply = "[Universal Mode] " + reply + "I have access to platform-wide data and can assist with multi-tenant insights. ";
      } else {
        reply = "[Client-Scoped Mode] " + reply + "I'm focusing on your organization's data and cases. ";
      }
      
      // Handle emergency situations first
      if (hasEmergencyFlag) {
        reply = "🚨 IMMEDIATE SAFETY CONCERN DETECTED 🚨\n\nIf you or someone else is in immediate danger, please:\n• Call emergency services (000 in Australia)\n• Contact Lifeline: 13 11 14\n• Go to your nearest emergency department\n\nI cannot provide crisis counseling, but I can help you access professional support resources once safety is ensured.";
        nextQuestions = ["Are you or someone else in immediate physical danger?", "Do you need help contacting emergency services?", "Would you like me to provide other mental health support resources?"];
        return {
          reply,
          nextQuestions,
          conversationId,
          mode,
          accessLevel,
          dialogueMode,
          emergencyAlert: true,
          escalationAvailable: false
        };
      }
      
      // Handle different dialogue modes
      if (dialogueMode === 'doctor') {
        reply += "[Doctor Mode] I'm providing structured clinical guidance without making final diagnostic determinations. ";
        if (lowerMessage.includes('concern') || lowerMessage.includes('medical')) {
          reply += "I can help you analyze health information and identify when medical opinion is needed. Based on what you've described, this may require escalation to a qualified medical practitioner.";
          nextQuestions = [
            "What specific clinical questions need medical opinion?",
            "What health factors are causing concern?",
            "Should I create a Medical Opinion Request for this case?"
          ];
        }
      } else if (dialogueMode === 'triage_nurse') {
        reply += "[Triage Nurse Mode] I'm helping assess accident urgency and next steps. ";
        if (lowerMessage.includes('accident') || lowerMessage.includes('injury')) {
          reply += "Let me help you assess this workplace incident and determine the appropriate response level.";
          nextQuestions = [
            "Is the worker conscious and responsive?",
            "Is there visible bleeding or deformity?",
            "Can the worker move the affected area?"
          ];
        }
      } else if (dialogueMode === 'mental_health_intake') {
        reply += "[Mental Health Intake] I'm using best-practice intake questions while maintaining appropriate boundaries. ";
        reply += "I'll ask about observable behaviors and workplace factors while avoiding clinical diagnosis.";
        nextQuestions = [
          "What specific behaviors or changes have you observed?",
          "How is this affecting their work attendance or performance?",
          "Are there any immediate safety concerns?"
        ];
      } else if (dialogueMode === 'exit_guidance') {
        reply += "[Exit Guidance] I'm helping you understand resignation circumstances and capture valuable feedback. ";
        if (lowerMessage.includes('exit') || lowerMessage.includes('leaving')) {
          reply += "Let me help you explore the factors behind this departure and plan appropriate follow-up.";
          nextQuestions = [
            "Were there performance issues before the resignation?",
            "Do you know the main reason they're leaving?",
            "Did they have any workplace injuries or health concerns?"
          ];
        }
      }
      
      if (lowerMessage.includes('health') || lowerMessage.includes('concern') || lowerMessage.includes('pain')) {
        reply += "I understand you have health concerns. As your occupational health assistant, I can help you understand workplace health requirements and guide you through the assessment process.";
        nextQuestions = [
          "What specific health symptoms are you experiencing?",
          "Is this related to a workplace injury?",
          "Do you need information about work restrictions?"
        ];
      } else if (lowerMessage.includes('work') || lowerMessage.includes('job') || lowerMessage.includes('role')) {
        reply += "I can help you understand how your health relates to work requirements. Let me know more about your situation.";
        nextQuestions = [
          "What type of work role are you applying for?",
          "Do you have any physical limitations?",
          "Have you had previous workplace injuries?"
        ];
      } else if (lowerMessage.includes('injury') || lowerMessage.includes('hurt') || lowerMessage.includes('accident')) {
        reply += "I'm sorry to hear about your injury. I can help guide you through the return-to-work process and understand your recovery options.";
        nextQuestions = [
          "When did this injury occur?",
          "What type of treatment have you received?",
          "Are you currently able to perform your usual duties?"
        ];
      } else {
        reply += "I'm Michelle, your AI assistant for occupational health matters. I can help with pre-employment assessments, workplace injuries, and return-to-work planning.";
        nextQuestions = [
          "Tell me about any health concerns",
          "Do you have questions about a workplace injury?",
          "What type of work role are you interested in?"
        ];
      }
      
      // Add AI response to history
      history.push({
        role: 'assistant',
        content: reply,
        timestamp: new Date()
      });

      // Update conversation storage
      conversations.set(conversationId, history);

      return {
        reply,
        nextQuestions,
        conversationId,
        mode,
        accessLevel,
        dialogueMode,
        escalationAvailable: dialogueMode === 'doctor' || requiresEscalation,
        requiresEscalation: requiresEscalation, // Content-based escalation regardless of mode
        emergencyAlert: hasEmergencyFlag
      };
    }

    // Build context-aware system prompt for real OpenAI API with mode-specific capabilities
    let systemPrompt = `You are Michelle, a helpful AI assistant specializing in occupational health and workplace safety. You work within the GPNet pre-employment health check system.

Current Mode: ${mode}
Access Level: ${accessLevel}
Dialogue Mode: ${dialogueMode}
Check Type: ${checkType}

${mode === 'universal' 
  ? 'UNIVERSAL MODE: You have access to platform-wide data across all clients and can provide insights about system-wide trends, comparative analytics, and multi-tenant patterns. You can access PHI (Protected Health Information) when appropriate for analysis. Focus on administrative oversight and system optimization.'
  : `CLIENT-SCOPED MODE: You are limited to data from ${userContext.organizationId ? 'this specific organization' : 'the current client context'} only. Focus on their specific cases, workers, and organizational needs. You cannot access or reference data from other organizations.`}

DIALOGUE MODE SPECIFIC INSTRUCTIONS:
${dialogueMode === 'doctor' ? `
DOCTOR MODE: You provide structured clinical guidance WITHOUT making final diagnostic determinations.
- Analyze health information systematically
- Identify when medical opinion is required
- Ask targeted clinical questions
- Flag complex cases for escalation
- NEVER provide final medical diagnoses
- Focus on risk assessment and guidance preparation
` : dialogueMode === 'triage_nurse' ? `
TRIAGE NURSE MODE: You assess accident urgency and determine appropriate response levels.
- Evaluate immediate danger and response needs
- Ask direct questions about injury severity
- Prioritize based on clinical urgency
- Guide appropriate medical response
- Focus on immediate safety and next steps
` : dialogueMode === 'mental_health_intake' ? `
MENTAL HEALTH INTAKE MODE: Use best-practice intake questions while maintaining boundaries.
- Focus on observable behaviors, not diagnoses
- Ask about workplace impact and safety
- Avoid clinical labeling or diagnostic language
- Prioritize immediate safety concerns
- Gather context for appropriate referrals
` : dialogueMode === 'exit_guidance' ? `
EXIT GUIDANCE MODE: Help understand resignation circumstances and capture feedback.
- Explore underlying factors for departure
- Identify potential workplace improvements
- Assess health/safety factors in leaving decision
- Guide appropriate follow-up actions
- Focus on organizational learning opportunities
` : `
STANDARD MODE: General occupational health assistance and guidance.
`}

Key guidelines:
- Be supportive and professional
- Ask one focused question at a time  
- Extract relevant health information from conversations
- Flag any serious health concerns immediately
- Keep responses concise and helpful
- Always suggest 1-3 follow-up questions
- Respect data privacy boundaries based on your current mode
- If you detect emergency keywords (suicide, self-harm, immediate danger), respond with emergency protocols immediately`;

    // CRITICAL SAFETY CHECK: Handle emergency situations BEFORE OpenAI call
    if (hasEmergencyFlag) {
      const emergencyResponse = "🚨 IMMEDIATE SAFETY CONCERN DETECTED 🚨\n\nIf you or someone else is in immediate danger, please:\n• Call emergency services (000 in Australia)\n• Contact Lifeline: 13 11 14\n• Go to your nearest emergency department\n\nI cannot provide crisis counseling, but I can help you access professional support resources once safety is ensured.";
      
      // Store emergency interaction
      history.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: emergencyResponse, timestamp: new Date() }
      );
      conversations.set(conversationId, history);
      
      return {
        reply: emergencyResponse,
        nextQuestions: ["Are you or someone else in immediate physical danger?", "Do you need help contacting emergency services?", "Would you like me to provide other mental health support resources?"],
        conversationId,
        mode,
        accessLevel,
        dialogueMode,
        emergencyAlert: true,
        escalationAvailable: false,
        requiresEscalation: false
      };
    }

    // Add organization context for client-scoped mode
    if (mode === 'client-scoped' && userContext.organizationId) {
      systemPrompt += `\n\nOrganization Context: Working with organization ID ${userContext.organizationId}`;
    }

    if (context?.currentPage) {
      systemPrompt += `\n\nCurrent context: User is viewing ${context.currentPage}`;
    }
    
    if (context?.caseId && context?.workerName) {
      systemPrompt += `\n\nCase context: Currently discussing case ${context.caseId} for worker ${context.workerName}`;
    }

    // Prepare messages for OpenAI
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (last 10 messages to keep context manageable)
    const recentHistory = history.slice(-10);
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })));

    // Add instruction for JSON format in the system prompt
    messages[0].content += `\n\nIMPORTANT: Respond in JSON format with this structure:
{
  "reply": "your helpful response here",
  "next_questions": ["question 1", "question 2", "question 3"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for conversations as per spec
      messages: messages,
      response_format: { type: "json_object" },
    });

    console.log('OpenAI response:', response.choices[0].message.content);
    const aiResponse = JSON.parse(response.choices[0].message.content || '{"reply": "I apologize, but I had trouble understanding that.", "next_questions": ["Can you rephrase that?", "What health concerns do you have?", "How can I help you today?"]}');
    
    // Add AI response to history
    history.push({
      role: 'assistant',
      content: aiResponse.reply || 'I apologize, but I had trouble understanding that. Could you please rephrase your question?',
      timestamp: new Date()
    });

    // Update conversation storage
    conversations.set(conversationId, history);

    return {
      reply: aiResponse.reply || 'How can I help you with your occupational health questions today?',
      nextQuestions: aiResponse.next_questions || [
        'Tell me about any current health concerns',
        'What type of work are you applying for?',
        'Do you have any previous workplace injuries?'
      ],
      conversationId,
      mode,
      accessLevel,
      dialogueMode,
      escalationAvailable: dialogueMode === 'doctor' || requiresEscalation,
      requiresEscalation: requiresEscalation && dialogueMode === 'doctor',
      emergencyAlert: hasEmergencyFlag
    };

  } catch (error) {
    console.error('Michelle chat error:', error);
    
    // Get history again in case of error
    let history = conversations.get(conversationId) || [];
    
    // Add user message to history even if AI fails
    if (!history.some(msg => msg.content === message && msg.role === 'user')) {
      history.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });
    }
    
    const fallbackReply = 'I apologize, but I\'m having technical difficulties right now. Please try again in a moment, or contact support if the issue persists.';
    
    // Add fallback response to history
    history.push({
      role: 'assistant',
      content: fallbackReply,
      timestamp: new Date()
    });
    
    // Update conversation storage with fallback
    conversations.set(conversationId, history);
    
    // Fallback response
    return {
      reply: fallbackReply,
      nextQuestions: [
        'Tell me about your health concerns',
        'What can I help you with today?',
        'Do you have workplace injury questions?'
      ],
      conversationId,
      mode: userContext.userType === 'admin' && userContext.isSuperuser ? 'universal' : 'client-scoped',
      accessLevel: userContext.userType
    };
  }
}

export function clearConversation(conversationId: string): void {
  conversations.delete(conversationId);
}

export function getConversationHistory(conversationId: string): ChatMessage[] {
  return conversations.get(conversationId) || [];
}

// Data access service based on user context and mode
export async function getMichelleDataContext(userContext: UserContext, storage: any) {
  const mode = userContext.userType === 'admin' && userContext.isSuperuser 
    ? 'universal' : 'client-scoped';

  if (mode === 'universal') {
    // Universal mode: Admin access to platform-wide data
    const allTickets = await storage.getAllTickets();
    const allOrganizations = await storage.getAllOrganizations();
    
    return {
      mode,
      accessLevel: userContext.userType,
      data: {
        totalTickets: allTickets.length,
        totalOrganizations: allOrganizations.length,
        recentActivity: allTickets.slice(0, 10), // Recent across all tenants
        systemWideStats: {
          red: allTickets.filter((t: any) => t.ragScore === 'red').length,
          amber: allTickets.filter((t: any) => t.ragScore === 'amber').length,
          green: allTickets.filter((t: any) => t.ragScore === 'green').length,
        },
        organizationBreakdown: allOrganizations.map((org: any) => ({
          id: org.id,
          name: org.name,
          ticketCount: allTickets.filter((t: any) => t.organizationId === org.id).length
        }))
      },
      capabilities: [
        'cross-tenant-analytics',
        'phi-access',
        'system-administration',
        'platform-insights'
      ]
    };
  } else {
    // Client-scoped mode: Limited to organization data
    const orgId = userContext.organizationId;
    if (!orgId) {
      throw new Error('Client users must have an organization context');
    }

    const orgTickets = await storage.getTicketsByOrganization(orgId);
    const orgWorkers = await storage.getWorkersByOrganization(orgId);
    
    return {
      mode,
      accessLevel: userContext.userType,
      organizationId: orgId,
      data: {
        tickets: orgTickets,
        workers: orgWorkers,
        stats: {
          total: orgTickets.length,
          new: orgTickets.filter((t: any) => t.status === 'NEW').length,
          inProgress: orgTickets.filter((t: any) => t.status === 'ANALYSING').length,
          awaiting: orgTickets.filter((t: any) => t.status === 'AWAITING_REVIEW').length,
          complete: orgTickets.filter((t: any) => t.status === 'COMPLETE').length,
          flagged: orgTickets.filter((t: any) => t.ragScore === 'red').length,
        },
        riskBreakdown: {
          red: orgTickets.filter((t: any) => t.ragScore === 'red').length,
          amber: orgTickets.filter((t: any) => t.ragScore === 'amber').length,
          green: orgTickets.filter((t: any) => t.ragScore === 'green').length,
        }
      },
      capabilities: [
        'organization-analytics',
        'case-management',
        'worker-tracking'
      ]
    };
  }
}
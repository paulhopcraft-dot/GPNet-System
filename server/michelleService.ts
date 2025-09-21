import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MichelleResponse {
  reply: string;
  nextQuestions: string[];
  conversationId: string;
  mode: 'client-scoped' | 'universal';
  accessLevel: 'client' | 'admin';
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

    // Demo mode: Simple keyword-based responses for testing (when API key is missing or invalid)
    // CHECK THIS BEFORE ATTEMPTING OPENAI API CALL
    const isValidApiKey = process.env.OPENAI_API_KEY && 
                         process.env.OPENAI_API_KEY.startsWith('sk-') && 
                         !process.env.OPENAI_API_KEY.includes('****') && 
                         !process.env.OPENAI_API_KEY.includes('youtube') &&
                         !process.env.OPENAI_API_KEY.includes('http');

    // Determine Michelle's mode based on user context
    const mode = userContext.userType === 'admin' && userContext.isSuperuser 
      ? 'universal' : 'client-scoped';
    const accessLevel = userContext.userType;
    
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
        accessLevel
      };
    }

    // Build context-aware system prompt for real OpenAI API with mode-specific capabilities
    let systemPrompt = `You are Michelle, a helpful AI assistant specializing in occupational health and workplace safety. You work within the GPNet pre-employment health check system.

Current Mode: ${mode}
Access Level: ${accessLevel}

${mode === 'universal' 
  ? 'UNIVERSAL MODE: You have access to platform-wide data across all clients and can provide insights about system-wide trends, comparative analytics, and multi-tenant patterns. You can access PHI (Protected Health Information) when appropriate for analysis. Focus on administrative oversight and system optimization.'
  : `CLIENT-SCOPED MODE: You are limited to data from ${userContext.organizationId ? 'this specific organization' : 'the current client context'} only. Focus on their specific cases, workers, and organizational needs. You cannot access or reference data from other organizations.`}

Key guidelines:
- Be supportive and professional
- Ask one focused question at a time
- Extract relevant health information from conversations
- Flag any serious health concerns
- Keep responses concise and helpful
- Always suggest 1-3 follow-up questions
- Respect data privacy boundaries based on your current mode`;

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
      accessLevel
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
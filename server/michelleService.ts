import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MichelleResponse {
  reply: string;
  nextQuestions: string[];
  conversationId: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Simple in-memory conversation storage for demo
const conversations: Map<string, ChatMessage[]> = new Map();

export async function chatWithMichelle(
  conversationId: string,
  message: string,
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

    // Build context-aware system prompt
    let systemPrompt = `You are Michelle, a helpful AI assistant specializing in occupational health and workplace safety. You work within the GPNet pre-employment health check system.

Key guidelines:
- Be supportive and professional
- Ask one focused question at a time
- Extract relevant health information from conversations
- Flag any serious health concerns
- Keep responses concise and helpful
- Always suggest 1-3 follow-up questions`;

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for conversations as per spec
      messages: messages,
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
    
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
      conversationId
    };

  } catch (error) {
    console.error('Michelle chat error:', error);
    
    // Fallback response
    return {
      reply: 'I apologize, but I\'m having technical difficulties right now. Please try again in a moment, or contact support if the issue persists.',
      nextQuestions: [
        'Tell me about your health concerns',
        'What can I help you with today?'
      ],
      conversationId
    };
  }
}

export function clearConversation(conversationId: string): void {
  conversations.delete(conversationId);
}

export function getConversationHistory(conversationId: string): ChatMessage[] {
  return conversations.get(conversationId) || [];
}
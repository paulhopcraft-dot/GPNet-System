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

    // Demo mode: Simple keyword-based responses for testing (when API key is missing or invalid)
    // CHECK THIS BEFORE ATTEMPTING OPENAI API CALL
    const isValidApiKey = process.env.OPENAI_API_KEY && 
                         process.env.OPENAI_API_KEY.startsWith('sk-') && 
                         !process.env.OPENAI_API_KEY.includes('****') && 
                         !process.env.OPENAI_API_KEY.includes('youtube') &&
                         !process.env.OPENAI_API_KEY.includes('http');

    if (!isValidApiKey) {
      console.log('Running in demo mode - using simulated responses');
      
      let reply = "Thank you for your question. ";
      let nextQuestions: string[] = [];
      
      const lowerMessage = message.toLowerCase();
      
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
        conversationId
      };
    }

    // Build context-aware system prompt for real OpenAI API
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
      conversationId
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
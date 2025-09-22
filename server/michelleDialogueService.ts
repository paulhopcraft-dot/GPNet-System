import { storage } from './storage.js';
import { z } from 'zod';

// Types for dialogue system
interface DialogueContext {
  conversationId: string;
  managerId: string;
  stage: 'greeting' | 'needs_assessment' | 'worker_collection' | 'check_selection' | 'confirmation' | 'completed';
  collectedData: {
    workerFirstName?: string;
    workerLastName?: string;
    workerEmail?: string;
    roleApplied?: string;
    urgencyLevel?: 'low' | 'normal' | 'high' | 'urgent';
    requestReason?: string;
    suggestedCheckKey?: string;
    companyName?: string;
    additionalNotes?: string;
  };
  conversationHistory: Array<{
    role: 'user' | 'michelle';
    message: string;
    timestamp: Date;
  }>;
  availableChecks: Array<{
    checkKey: string;
    checkName: string;
    description: string;
    urgencyLevel: string;
    estimatedCompletionDays: number;
  }>;
}

interface DialogueResponse {
  response: string;
  stage: DialogueContext['stage'];
  suggestedActions?: Array<{
    type: 'collect_worker_info' | 'select_check' | 'confirm_request' | 'start_over';
    label: string;
    data?: any;
  }>;
  collectedData: DialogueContext['collectedData'];
  isComplete: boolean;
  checkRequestReady: boolean;
}

// Michelle's conversational prompts and logic
class MichelleDialogueService {
  private readonly OPENAI_API_KEY: string;

  constructor() {
    this.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    if (!this.OPENAI_API_KEY) {
      console.warn('Michelle Dialogue Service: No OpenAI API key found. AI features will be limited.');
    }
  }

  /**
   * Initialize a new dialogue session
   */
  async startDialogue(managerId: string): Promise<DialogueContext> {
    const conversationId = `dialogue_${managerId}_${Date.now()}`;
    
    // Get available health checks for context
    const availableChecks = await storage.getActiveChecks();
    
    const context: DialogueContext = {
      conversationId,
      managerId,
      stage: 'greeting',
      collectedData: {},
      conversationHistory: [{
        role: 'michelle',
        message: this.getGreetingMessage(),
        timestamp: new Date()
      }],
      availableChecks: availableChecks.map(check => ({
        checkKey: check.checkKey,
        checkName: check.displayName || check.checkKey,
        description: check.description || '',
        urgencyLevel: 'normal', // Default value as checks table doesn't have this field
        estimatedCompletionDays: 5 // Default value as checks table doesn't have this field
      }))
    };

    return context;
  }

  /**
   * Process user input and generate Michelle's response
   */
  async processMessage(
    context: DialogueContext, 
    userMessage: string
  ): Promise<DialogueResponse> {
    // Add user message to conversation history
    context.conversationHistory.push({
      role: 'user',
      message: userMessage,
      timestamp: new Date()
    });

    let response: DialogueResponse;

    // Use AI to understand context and generate response
    if (this.OPENAI_API_KEY) {
      response = await this.generateAIResponse(context, userMessage);
    } else {
      response = await this.generateRuleBasedResponse(context, userMessage);
    }

    // Add Michelle's response to conversation history
    context.conversationHistory.push({
      role: 'michelle',
      message: response.response,
      timestamp: new Date()
    });

    // Update context stage and collected data
    context.stage = response.stage;
    context.collectedData = { ...context.collectedData, ...response.collectedData };

    return response;
  }

  /**
   * Generate AI-powered response using OpenAI
   */
  private async generateAIResponse(
    context: DialogueContext, 
    userMessage: string
  ): Promise<DialogueResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...context.conversationHistory.slice(-6).map(msg => ({
              role: msg.role === 'michelle' ? 'assistant' : 'user',
              content: msg.message
            })),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // Extract structured data from AI response
      return this.parseAIResponse(context, aiResponse, userMessage);

    } catch (error) {
      console.error('AI response generation failed:', error);
      // Fallback to rule-based response
      return this.generateRuleBasedResponse(context, userMessage);
    }
  }

  /**
   * Generate rule-based response for fallback
   */
  private async generateRuleBasedResponse(
    context: DialogueContext, 
    userMessage: string
  ): Promise<DialogueResponse> {
    const message = userMessage.toLowerCase();
    
    switch (context.stage) {
      case 'greeting':
        return this.handleNeedsAssessment(context, userMessage);
      
      case 'needs_assessment':
        return this.handleWorkerCollection(context, userMessage);
      
      case 'worker_collection':
        return this.handleCheckSelection(context, userMessage);
      
      case 'check_selection':
        return this.handleConfirmation(context, userMessage);
      
      case 'confirmation':
        return this.handleCompletion(context, userMessage);
      
      default:
        return {
          response: "I'm not sure how to help with that. Let's start over - what type of health check do you need help with?",
          stage: 'greeting',
          collectedData: {},
          isComplete: false,
          checkRequestReady: false
        };
    }
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(context: DialogueContext): string {
    const availableChecks = context.availableChecks
      .map(check => `- ${check.checkKey}: ${check.checkName} (${check.description})`)
      .join('\n');

    return `You are Michelle, a friendly and professional AI assistant for GPNet's pre-employment health check system. You help managers initiate health checks for their workers through natural conversation.

AVAILABLE HEALTH CHECKS:
${availableChecks}

YOUR ROLE:
- Help managers determine the right type of health check
- Collect necessary worker information
- Guide them through the process with empathy and clarity
- Be conversational, helpful, and professional

CONVERSATION STAGES:
1. greeting: Welcome and understand their needs
2. needs_assessment: Determine the right check type
3. worker_collection: Gather worker details (name, email, role)
4. check_selection: Confirm the recommended check
5. confirmation: Final review before submission
6. completed: Process complete

CURRENT STAGE: ${context.stage}
COLLECTED DATA: ${JSON.stringify(context.collectedData, null, 2)}

RESPONSE FORMAT:
Provide helpful, conversational responses. Ask one question at a time. Be encouraging and supportive, especially when dealing with workplace health matters.`;
  }

  /**
   * Parse AI response to extract structured data
   */
  private parseAIResponse(
    context: DialogueContext, 
    aiResponse: string, 
    userMessage: string
  ): DialogueResponse {
    // Simple parsing logic - can be enhanced with more sophisticated NLP
    const collectedData: any = { ...context.collectedData };
    let stage = context.stage;
    let isComplete = false;
    let checkRequestReady = false;

    // Extract email if mentioned
    const emailMatch = userMessage.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      collectedData.workerEmail = emailMatch[1];
    }

    // Extract name patterns
    const namePattern = /(?:name is|called|worker is)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i;
    const nameMatch = userMessage.match(namePattern);
    if (nameMatch) {
      collectedData.workerFirstName = nameMatch[1];
      if (nameMatch[2]) {
        collectedData.workerLastName = nameMatch[2];
      }
    }

    // Determine stage progression
    if (stage === 'greeting' && userMessage.length > 10) {
      stage = 'needs_assessment';
    } else if (stage === 'needs_assessment' && (collectedData.workerFirstName || collectedData.workerEmail)) {
      stage = 'worker_collection';
    } else if (stage === 'worker_collection' && collectedData.workerEmail && collectedData.workerFirstName) {
      stage = 'check_selection';
    } else if (stage === 'check_selection' && collectedData.suggestedCheckKey) {
      stage = 'confirmation';
      checkRequestReady = true;
    }

    // Check if ready for completion
    const requiredFields = ['workerEmail', 'workerFirstName', 'workerLastName'];
    const hasRequiredData = requiredFields.every(field => collectedData[field]);
    
    if (hasRequiredData && collectedData.suggestedCheckKey) {
      checkRequestReady = true;
      if (stage === 'confirmation') {
        isComplete = true;
        stage = 'completed';
      }
    }

    return {
      response: aiResponse,
      stage,
      collectedData,
      isComplete,
      checkRequestReady,
      suggestedActions: this.generateSuggestedActions(stage, collectedData)
    };
  }

  /**
   * Generate suggested action buttons
   */
  private generateSuggestedActions(
    stage: DialogueContext['stage'], 
    collectedData: DialogueContext['collectedData']
  ): DialogueResponse['suggestedActions'] {
    const actions: DialogueResponse['suggestedActions'] = [];

    switch (stage) {
      case 'needs_assessment':
        actions.push(
          { type: 'collect_worker_info', label: 'Pre-Employment Check', data: { checkType: 'pre_employment' } },
          { type: 'collect_worker_info', label: 'Return to Work', data: { checkType: 'return_to_work' } },
          { type: 'collect_worker_info', label: 'Injury Assessment', data: { checkType: 'injury' } }
        );
        break;
      
      case 'check_selection':
        actions.push(
          { type: 'confirm_request', label: 'Proceed with Request' },
          { type: 'start_over', label: 'Change Check Type' }
        );
        break;
      
      case 'confirmation':
        actions.push(
          { type: 'confirm_request', label: 'Submit Request' },
          { type: 'start_over', label: 'Start Over' }
        );
        break;
    }

    return actions;
  }

  /**
   * Stage-specific handlers
   */
  private handleNeedsAssessment(context: DialogueContext, message: string): DialogueResponse {
    const lowerMessage = message.toLowerCase();
    let suggestedCheck = '';
    let response = '';

    if (lowerMessage.includes('pre-employment') || lowerMessage.includes('new hire') || lowerMessage.includes('starting')) {
      suggestedCheck = 'pre_employment_standard';
      response = "I see you need a pre-employment health check. These are great for ensuring new hires are fit for their role. Let me collect some details about the worker.";
    } else if (lowerMessage.includes('return') || lowerMessage.includes('back to work') || lowerMessage.includes('injury')) {
      suggestedCheck = 'return_to_work_standard';
      response = "It sounds like you need a return-to-work assessment. These help ensure someone is ready to safely return after an injury or absence. Let me get some information about the worker.";
    } else if (lowerMessage.includes('medical') || lowerMessage.includes('fitness')) {
      suggestedCheck = 'medical_fitness';
      response = "I understand you need a medical fitness assessment. These comprehensive checks evaluate overall health and work capacity. Let me gather the worker's information.";
    } else {
      response = "I can help you with various health checks - pre-employment screenings, return-to-work assessments, or medical fitness evaluations. Could you tell me what type of situation you're dealing with?";
    }

    return {
      response: `${response} What's the worker's name?`,
      stage: 'worker_collection',
      collectedData: suggestedCheck ? { suggestedCheckKey: suggestedCheck } : {},
      isComplete: false,
      checkRequestReady: false
    };
  }

  private handleWorkerCollection(context: DialogueContext, message: string): DialogueResponse {
    const collectedData = { ...context.collectedData };
    let response = '';
    let stage: DialogueContext['stage'] = 'worker_collection';

    // Try to extract worker information
    const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      collectedData.workerEmail = emailMatch[1];
    }

    const nameWords = message.split(/\s+/).filter(word => 
      word.length > 1 && /^[A-Z][a-z]+$/.test(word)
    );

    if (nameWords.length >= 1 && !collectedData.workerFirstName) {
      collectedData.workerFirstName = nameWords[0];
      if (nameWords.length >= 2) {
        collectedData.workerLastName = nameWords[1];
      }
    }

    // Check what we still need
    if (!collectedData.workerFirstName) {
      response = "I'd be happy to help! What's the worker's full name?";
    } else if (!collectedData.workerLastName) {
      response = `Thanks! I have ${collectedData.workerFirstName} as the first name. What's their last name?`;
    } else if (!collectedData.workerEmail) {
      response = `Perfect! I have ${collectedData.workerFirstName} ${collectedData.workerLastName}. What's their email address?`;
    } else {
      // We have enough info, move to check selection
      stage = 'check_selection';
      const checkName = context.availableChecks.find(c => c.checkKey === collectedData.suggestedCheckKey)?.checkName || 'health check';
      response = `Great! I have all the details for ${collectedData.workerFirstName} ${collectedData.workerLastName} (${collectedData.workerEmail}). I recommend a ${checkName} based on your needs. Should I proceed with this request?`;
    }

    return {
      response,
      stage,
      collectedData,
      isComplete: false,
      checkRequestReady: stage === 'check_selection'
    };
  }

  private handleCheckSelection(context: DialogueContext, message: string): DialogueResponse {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('yes') || lowerMessage.includes('proceed') || lowerMessage.includes('ok')) {
      return {
        response: "Perfect! I'll create the health check request. You'll receive an email draft to review and send to the worker. Is there anything else you'd like me to note about this request?",
        stage: 'confirmation',
        collectedData: context.collectedData,
        isComplete: false,
        checkRequestReady: true
      };
    } else if (lowerMessage.includes('no') || lowerMessage.includes('different')) {
      return {
        response: "No problem! Let me suggest some other options. What specific type of health check are you looking for?",
        stage: 'needs_assessment',
        collectedData: { ...context.collectedData, suggestedCheckKey: undefined },
        isComplete: false,
        checkRequestReady: false
      };
    }

    return {
      response: "Should I proceed with creating this health check request? Just say 'yes' to continue or 'no' if you'd like to change something.",
      stage: 'check_selection',
      collectedData: context.collectedData,
      isComplete: false,
      checkRequestReady: false
    };
  }

  private handleConfirmation(context: DialogueContext, message: string): DialogueResponse {
    const lowerMessage = message.toLowerCase();
    const collectedData = { ...context.collectedData };
    
    if (message.trim().length > 5 && !lowerMessage.includes('yes') && !lowerMessage.includes('submit')) {
      // User provided additional notes
      collectedData.additionalNotes = message;
      return {
        response: "Thanks for the additional information! I've noted that down. Ready to submit the health check request?",
        stage: 'confirmation',
        collectedData,
        isComplete: false,
        checkRequestReady: true
      };
    }

    // User confirmed submission
    return {
      response: "Excellent! I've processed your health check request. The system will create the case and prepare an email draft for you to review and send. You'll be notified once everything is ready. Is there anything else I can help you with?",
      stage: 'completed',
      collectedData,
      isComplete: true,
      checkRequestReady: true
    };
  }

  private handleCompletion(context: DialogueContext, message: string): DialogueResponse {
    return {
      response: "You're all set! Feel free to start a new conversation if you need help with another health check request. Have a great day!",
      stage: 'completed',
      collectedData: context.collectedData,
      isComplete: true,
      checkRequestReady: false
    };
  }

  /**
   * Get initial greeting message
   */
  private getGreetingMessage(): string {
    return "Hi! I'm Michelle, your GPNet health check assistant. I'm here to help you set up health checks for your workers. What can I help you with today?";
  }

  /**
   * Create check request from dialogue data
   */
  async createCheckRequestFromDialogue(context: DialogueContext): Promise<any> {
    const { collectedData } = context;
    
    if (!this.isDialogueComplete(context)) {
      throw new Error('Dialogue not complete - missing required information');
    }

    // Create the check request using our existing API
    const requestData = {
      workerEmail: collectedData.workerEmail!,
      workerFirstName: collectedData.workerFirstName!,
      workerLastName: collectedData.workerLastName!,
      checkKey: collectedData.suggestedCheckKey!,
      requestReason: collectedData.additionalNotes || 'Manager-initiated via Michelle dialogue',
      urgency: collectedData.urgencyLevel || 'normal',
      managerEmail: context.managerId, // Using managerId as email for now
      dialogueContext: {
        conversationId: context.conversationId,
        stage: context.stage,
        timestamp: new Date()
      }
    };

    return requestData;
  }

  /**
   * Check if dialogue has all required information
   */
  private isDialogueComplete(context: DialogueContext): boolean {
    const { collectedData } = context;
    return !!(
      collectedData.workerEmail &&
      collectedData.workerFirstName &&
      collectedData.workerLastName &&
      collectedData.suggestedCheckKey
    );
  }
}

export { MichelleDialogueService, DialogueContext, DialogueResponse };
export default new MichelleDialogueService();
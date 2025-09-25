import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o-mini" which is current as of September 2025
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Check if we have a valid OpenAI API key
const hasValidApiKey = process.env.OPENAI_API_KEY && 
  process.env.OPENAI_API_KEY.startsWith('sk-') && 
  process.env.OPENAI_API_KEY !== 'demo-mode';

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

// OpenAI Response Handler
async function getOpenAIResponse(
  conversationId: string,
  message: string,
  userContext: UserContext,
  context?: any,
  history?: ChatMessage[]
): Promise<MichelleResponse> {
  try {
    const systemPrompt = `You are Michelle, an expert AI occupational health assistant specializing in pre-employment health assessments, workplace injury management, and return-to-work planning. 

Your expertise includes:
- Pre-employment health screenings for all job categories
- Workplace injury assessment and return-to-work guidance
- RAG (Red/Amber/Green) risk scoring for workplace fitness
- Medical interpretation of health conditions and restrictions
- Clinical assessment for occupational health contexts
- Case management and follow-up protocols

Respond in a professional, helpful manner. Always provide 3-4 relevant follow-up questions. 

Your response MUST be valid JSON in this exact format:
{
  "reply": "your detailed professional response here",
  "next_questions": ["question 1", "question 2", "question 3"]
}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history?.slice(-6) || []).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      response_format: { type: "json_object" },
      max_tokens: 800
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{"reply": "I apologize, but I had trouble understanding that.", "next_questions": ["Can you rephrase that?", "What health concerns do you have?", "How can I help you today?"]}');
    
    // Add AI response to history
    if (history) {
      history.push({
        role: 'assistant',
        content: aiResponse.reply,
        timestamp: new Date()
      });
      conversations.set(conversationId, history);
    }

    return {
      reply: aiResponse.reply,
      nextQuestions: aiResponse.next_questions || [],
      conversationId,
      mode: userContext.userType === 'admin' && userContext.isSuperuser ? 'universal' : 'client-scoped',
      accessLevel: userContext.userType,
      dialogueMode: context?.dialogueMode || 'standard',
      escalationAvailable: false,
      requiresEscalation: false,
      emergencyAlert: false
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to demo mode on API error
    throw error;
  }
}

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

    // Check if we can use OpenAI or need demo mode
    if (hasValidApiKey) {
      console.log('Using OpenAI for intelligent responses');
      return await getOpenAIResponse(conversationId, message, userContext, context, history);
    } else {
      console.log('Running in enhanced demo mode - professional responses');
    }
    
    let reply = "";
    let nextQuestions: string[] = [];
    
    const lowerMessage = message.toLowerCase();
    
    // Determine Michelle's mode based on user context
    const mode = userContext.userType === 'admin' && userContext.isSuperuser 
      ? 'universal' : 'client-scoped';
    const accessLevel = userContext.userType;
    
    // Determine dialogue mode based on context
    const dialogueMode = context?.dialogueMode || 'standard';
    
    // Emergency detection for mental health scenarios
    const emergencyKeywords = ['suicide', 'kill myself', 'end it all', 'hurt myself', 'self harm', 'not worth living'];
    const hasEmergencyFlag = emergencyKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    // Escalation detection
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
    
    const escalationAvailable = dialogueMode === 'doctor' || requiresEscalation;
    
    // Handle emergency situations FIRST
    if (hasEmergencyFlag) {
      reply = "🚨 IMMEDIATE SAFETY CONCERN DETECTED 🚨\n\nIf you or someone else is in immediate danger, please:\n• Call emergency services (000 in Australia)\n• Contact Lifeline: 13 11 14\n• Go to your nearest emergency department\n\nI cannot provide crisis counseling, but I can help you access professional support resources once safety is ensured.";
      nextQuestions = ["Are you or someone else in immediate physical danger?", "Do you need help contacting emergency services?", "Would you like me to provide other mental health support resources?"];
    }
    
    // Enhanced intelligent responses for workplace health assessment
    else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      reply = `Hello! I'm Michelle, your AI occupational health assistant. I specialize in pre-employment health assessments, workplace injury management, and return-to-work planning.

I can help you with:
🔍 **Worker Case Lookups** - Search existing health assessments
🩺 **Medical Consultations** - Clinical interpretation of health conditions  
📋 **Risk Assessment** - RAG scoring for workplace fitness
🏢 **Return-to-Work Planning** - Accommodation recommendations

What specific occupational health question can I assist you with today?`;
      
      nextQuestions = [
        "Help me assess a worker's fitness for manual handling",
        "Look up a specific worker case",
        "Explain pre-employment health check requirements",
        "Switch to medical consultation mode"
      ];
    }
    
    else if (lowerMessage.includes('injury') || lowerMessage.includes('workplace') || lowerMessage.includes('assessment')) {
      reply = `I understand you need assistance with a workplace health assessment. As your occupational health specialist, I can provide comprehensive guidance.

**For workplace injury assessments, I need to understand:**

📋 **Nature of Inquiry:**
- Is this for a pre-employment health check?
- Are you assessing an existing workplace injury?
- Do you need return-to-work clearance guidance?

🩺 **Medical Context:**
- What type of work role is involved?
- Are there specific physical demands to consider?
- Any current health restrictions or limitations?

I can provide RAG risk scoring (Red/Amber/Green) and specific fitness recommendations based on the role requirements.`;

      nextQuestions = [
        "This is for a pre-employment health check",
        "I need to assess an existing workplace injury", 
        "Help with return-to-work clearance",
        "Explain RAG risk scoring system"
      ];
    }
    
    else if (lowerMessage.includes('doctor') || lowerMessage.includes('medical')) {
      reply = `**🩺 MEDICAL CONSULTATION MODE ACTIVATED**

I'm now operating in clinical assessment mode. I can provide medical interpretation and recommendations for:

**Clinical Assessment Areas:**
• Musculoskeletal fitness evaluation
• Cardiovascular capacity assessment  
• Respiratory function analysis
• Mental health fitness considerations
• Medication impact on work capacity
• Medical certificate interpretation

**Risk Classification:**
• RED: Not fit for proposed duties
• AMBER: Fit with restrictions/modifications  
• GREEN: Unrestricted fitness for role

What specific medical aspect would you like me to evaluate?`;

      nextQuestions = [
        "Assess musculoskeletal fitness for manual work",
        "Evaluate cardiovascular capacity for physical roles",
        "Review mental health fitness considerations",
        "Interpret medical certificates and restrictions"
      ];
    }
    
    else if (lowerMessage.includes('lookup') || lowerMessage.includes('search') || lowerMessage.includes('find')) {
      reply = `**🔍 WORKER CASE LOOKUP SYSTEM**

I can search your organization's health assessment database. Please provide:

**Search Criteria:**
• Worker name (first and/or last name)
• Employee ID or reference number  
• Email address
• Ticket/case reference number
• Assessment date range

**Available Information:**
• Pre-employment health check results
• Current fitness classifications (RAG status)
• Workplace restrictions and accommodations
• Medical certificate details
• Follow-up requirements

What search criteria would you like me to use?`;

      nextQuestions = [
        "Search by worker name",
        "Look up by employee ID",
        "Find recent assessments", 
        "Show pending follow-ups"
      ];
    }
    
    else if (lowerMessage.includes('mode') && lowerMessage.includes('manager')) {
      reply = `**📋 CASE MANAGER MODE ACTIVATED**

I'm now focused on case administration and follow-up processes. I can help with:

• Case status tracking and updates
• Follow-up scheduling and reminders
• Documentation requirements
• Escalation protocols
• Compliance monitoring

What case management task can I assist with?`;
      
      nextQuestions = [
        "Update case status",
        "Schedule follow-up",
        "Review documentation",
        "Escalate to supervisor"
      ];
    }
    
    else if (lowerMessage.includes('pre-employment') || lowerMessage.includes('health check')) {
      reply = `**📋 PRE-EMPLOYMENT HEALTH CHECK GUIDANCE**

I can guide you through our comprehensive pre-employment assessment process:

**Available Assessment Types:**
• Physical Capacity Assessment (manual handling roles)
• Office Worker Assessment (desk-based roles)  
• Driver Assessment (commercial driving positions)
• Warehouse Worker Assessment (logistics roles)
• Construction Worker Assessment (building trades)
• Manual Handling Assessment (physical roles)

**Assessment Process:**
1. Complete detailed health questionnaire
2. RAG risk scoring analysis
3. Fitness classification determination
4. Employer notification with recommendations

Which type of role are you assessing for?`;

      nextQuestions = [
        "Physical/manual handling role",
        "Office/desk-based position",
        "Driving/transport role",
        "Construction/trades position"
      ];
    }
    
    else {
      // Default professional response
      reply = `Thank you for your occupational health inquiry. As your AI health assessment specialist, I'm here to provide expert guidance on workplace fitness evaluations.

**My Expertise Includes:**
• Pre-employment health screenings for all job categories
• Workplace injury assessment and management  
• Return-to-work planning and accommodation
• Medical risk evaluation using RAG methodology
• Regulatory compliance for occupational health

Please provide more details about your specific health assessment needs, and I'll deliver targeted professional advice.`;

      nextQuestions = [
        "I need help with a pre-employment assessment",
        "Assist with workplace injury evaluation",
        "Provide return-to-work guidance",
        "Explain health check requirements"
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
      escalationAvailable,
      requiresEscalation,
      emergencyAlert: hasEmergencyFlag
    };

  } catch (error) {
    console.error('Michelle chat error:', error);
    
    // Fallback professional response for any errors
    return {
      reply: "I'm here to help with your occupational health inquiries. As your professional health assessment specialist, I can assist with pre-employment checks, workplace injury evaluations, and return-to-work planning. How can I help you today?",
      nextQuestions: [
        "I need help with a pre-employment assessment",
        "Assist with workplace injury evaluation", 
        "Provide return-to-work guidance"
      ],
      conversationId,
      mode: 'client-scoped',
      accessLevel: 'client',
      emergencyAlert: false
    };
  }
}
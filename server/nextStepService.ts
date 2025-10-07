import OpenAI from 'openai';
import { FreshdeskService } from './freshdeskService';
import { storage } from './storage';
import { db } from './db';
import { externalEmails } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

interface NextStepAnalysis {
  nextStep: string;
  priority: 'low' | 'medium' | 'high';
  reasoning: string;
  urgency: 'routine' | 'urgent' | 'critical';
  assignedTo?: string;
}

export class NextStepService {
  private openai: OpenAI | null = null;
  private freshdeskService: FreshdeskService;

  constructor() {
    this.freshdeskService = new FreshdeskService();
    
    // Initialize OpenAI
    const apiKey = process.env.GPNET_OPENAI || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('✅ NextStepService: OpenAI initialized');
    } else {
      console.warn('⚠️ NextStepService: OpenAI API key not found');
    }
  }

  /**
   * Analyze a ticket and determine the intelligent next step
   */
  async analyzeAndUpdateNextStep(ticketId: string, fdId?: number): Promise<NextStepAnalysis | null> {
    if (!this.openai) {
      console.warn('OpenAI not available, cannot determine next step');
      return null;
    }

    try {
      // Get ticket details
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        console.error(`Ticket ${ticketId} not found`);
        return null;
      }

      // Build conversation context
      const conversationContext = await this.buildConversationContext(ticketId, fdId);
      
      if (!conversationContext || conversationContext.length === 0) {
        console.log(`No conversation data for ticket ${ticketId}, using default next step`);
        return {
          nextStep: 'Initial case review and triage',
          priority: 'medium',
          reasoning: 'No conversation history available yet',
          urgency: 'routine'
        };
      }

      // Analyze with OpenAI
      const analysis = await this.performAIAnalysis(ticket, conversationContext);
      
      // Update ticket with intelligent next step
      if (analysis) {
        await storage.updateTicketStep(ticketId, analysis.nextStep, analysis.assignedTo);
        console.log(`✅ Updated next step for ticket ${ticketId}: ${analysis.nextStep}`);
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing next step:', error);
      return null;
    }
  }

  /**
   * Build conversation context from Freshdesk and internal emails
   */
  private async buildConversationContext(ticketId: string, fdId?: number): Promise<string> {
    const contextParts: string[] = [];

    // Get Freshdesk conversations if available
    if (fdId && this.freshdeskService) {
      try {
        const conversations = await this.freshdeskService.getTicketConversations(fdId);
        if (conversations && conversations.length > 0) {
          // Get the last 5 most recent conversations
          const recentConversations = conversations
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);

          contextParts.push('=== FRESHDESK CONVERSATION HISTORY (Most Recent First) ===\n');
          recentConversations.forEach((conv, idx) => {
            const date = new Date(conv.created_at).toLocaleString();
            const body = this.stripHtml(conv.body_text || conv.body || '');
            const from = conv.from_email || conv.user_id || 'Unknown';
            
            contextParts.push(`\n[${idx + 1}] From: ${from} | Date: ${date}`);
            contextParts.push(`${body.substring(0, 500)}${body.length > 500 ? '...' : ''}\n`);
          });
        }
      } catch (error) {
        console.error('Failed to fetch Freshdesk conversations:', error);
      }
    }

    // Get internal emails
    try {
      const emails = await db
        .select()
        .from(externalEmails)
        .where(eq(externalEmails.ticketId, ticketId))
        .orderBy(desc(externalEmails.createdAt))
        .limit(3);

      if (emails.length > 0) {
        contextParts.push('\n=== RECENT EMAILS ===\n');
        emails.forEach((email, idx) => {
          const date = email.createdAt ? new Date(email.createdAt).toLocaleString() : 'Unknown';
          contextParts.push(`\n[${idx + 1}] From: ${email.originalSender || 'Unknown'} | Date: ${date}`);
          contextParts.push(`Subject: ${email.subject}`);
          contextParts.push(`${email.body.substring(0, 400)}${email.body.length > 400 ? '...' : ''}\n`);
        });
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    }

    return contextParts.join('\n');
  }

  /**
   * Perform AI analysis to determine next step
   */
  private async performAIAnalysis(ticket: any, conversationContext: string): Promise<NextStepAnalysis | null> {
    if (!this.openai) return null;

    const prompt = `You are an expert occupational health case manager. Analyze the following case and determine the most appropriate next step.

CASE DETAILS:
- Case Type: ${ticket.caseType}
- Worker: ${ticket.workerName}
- Company: ${ticket.company || 'Unknown'}
- Current Status: ${ticket.status}
- Current Next Step: ${ticket.nextStep || 'None set'}
- Last Step: ${ticket.lastStep || 'None'}
- Created: ${new Date(ticket.createdAt).toLocaleDateString()}

${conversationContext}

Based on the conversation history and case details, determine:
1. What should be the SPECIFIC next action/step?
2. What priority level (low/medium/high)?
3. How urgent is it (routine/urgent/critical)?
4. Brief reasoning (1-2 sentences)

Provide a SPECIFIC, actionable next step. Examples of good next steps:
- "Request updated medical certificate from treating practitioner"
- "Schedule return-to-work planning meeting with employer"
- "Review specialist report and update capacity assessment"
- "Contact worker to confirm attendance at consultant appointment"
- "Obtain employer's job description for pre-employment assessment"

Avoid vague steps like "Review case" or "Follow up". Be specific about WHAT needs to be done.

Respond in JSON format:
{
  "nextStep": "specific action to take",
  "priority": "low|medium|high",
  "urgency": "routine|urgent|critical",
  "reasoning": "brief explanation",
  "assignedTo": "role if specific expertise needed (optional)"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert occupational health case manager who provides specific, actionable next steps.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const analysis = JSON.parse(response) as NextStepAnalysis;
        console.log(`AI determined next step for ${ticket.ticketId}:`, analysis.nextStep);
        return analysis;
      }

      return null;
    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      return null;
    }
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Batch analyze all tickets that need next step updates
   */
  async analyzeAllPendingCases(): Promise<void> {
    console.log('Starting batch next step analysis...');
    
    try {
      const tickets = await storage.getAllTickets();
      const pendingTickets = tickets.filter(t => 
        !t.nextStep || 
        t.nextStep === 'Initial case review and triage' ||
        t.status !== 'COMPLETE'
      );

      console.log(`Found ${pendingTickets.length} tickets needing next step analysis`);

      for (const ticket of pendingTickets) {
        await this.analyzeAndUpdateNextStep(ticket.id, ticket.fdId ?? undefined);
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ Batch next step analysis complete');
    } catch (error) {
      console.error('Batch analysis failed:', error);
    }
  }
}

export const nextStepService = new NextStepService();

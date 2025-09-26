import { freshdeskService } from "./freshdeskService.js";
import { embeddingService } from "./embeddingService.js";
import { db } from "./db.js";
import { tickets, ticketMessages } from "@shared/schema.js";
import { eq } from "drizzle-orm";

export interface BackfillProgress {
  totalTickets: number;
  processedTickets: number;
  totalMessages: number;
  processedMessages: number;
  embeddedMessages: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
}

export interface BackfillOptions {
  months?: number; // How many months back to backfill (default: 12)
  batchSize?: number; // How many tickets to process at once (default: 10)
  includePrivateNotes?: boolean; // Whether to include private notes (default: true)
  generateEmbeddings?: boolean; // Whether to generate embeddings (default: true)
  dryRun?: boolean; // Test run without storing data (default: false)
}

/**
 * Service for backfilling Freshdesk conversation data into the RAG system
 */
export class FreshdeskRagBackfillService {
  private progress: BackfillProgress = {
    totalTickets: 0,
    processedTickets: 0,
    totalMessages: 0,
    processedMessages: 0,
    embeddedMessages: 0,
    errors: [],
    startTime: new Date()
  };

  /**
   * Backfill conversations from Freshdesk for the last N months
   */
  async backfillConversations(options: BackfillOptions = {}): Promise<BackfillProgress> {
    const {
      months = 12,
      batchSize = 10,
      includePrivateNotes = true,
      generateEmbeddings = true,
      dryRun = false
    } = options;

    console.log(`🚀 Starting Freshdesk RAG backfill: ${months} months, batch size ${batchSize}, embeddings: ${generateEmbeddings}, dry run: ${dryRun}`);
    
    this.progress = {
      totalTickets: 0,
      processedTickets: 0,
      totalMessages: 0,
      processedMessages: 0,
      embeddedMessages: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Check Freshdesk availability
      if (!freshdeskService.isAvailable()) {
        throw new Error('Freshdesk integration not available. Please configure FRESHDESK_API_KEY and FRESHDESK_DOMAIN.');
      }

      // Calculate date range
      const sinceDate = new Date();
      sinceDate.setMonth(sinceDate.getMonth() - months);
      const updatedSince = sinceDate.toISOString();

      console.log(`📅 Fetching tickets updated since: ${sinceDate.toLocaleDateString()}`);

      // Step 1: Fetch all tickets from Freshdesk
      const freshdeskTickets = await freshdeskService.fetchAllTickets(updatedSince);
      this.progress.totalTickets = freshdeskTickets.length;

      console.log(`📊 Found ${freshdeskTickets.length} tickets to process`);

      if (freshdeskTickets.length === 0) {
        console.log('✅ No tickets found to backfill');
        this.completeBackfill();
        return this.progress;
      }

      // Step 2: Process tickets in batches
      for (let i = 0; i < freshdeskTickets.length; i += batchSize) {
        const batch = freshdeskTickets.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(freshdeskTickets.length / batchSize)}`);

        await Promise.all(
          batch.map(ticket => this.processTicketConversations(ticket, includePrivateNotes, generateEmbeddings, dryRun))
        );

        // Small delay between batches to be gentle on APIs
        if (i + batchSize < freshdeskTickets.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.completeBackfill();
      console.log(`✅ Backfill completed successfully!`);
      console.log(`📊 Final stats: ${this.progress.processedTickets}/${this.progress.totalTickets} tickets, ${this.progress.processedMessages} messages, ${this.progress.embeddedMessages} embeddings`);

      return this.progress;

    } catch (error) {
      console.error('❌ Backfill failed:', error);
      this.progress.errors.push(`Fatal error: ${error}`);
      this.completeBackfill();
      throw error;
    }
  }

  /**
   * Process conversations for a single ticket
   */
  private async processTicketConversations(
    freshdeskTicket: any,
    includePrivateNotes: boolean,
    generateEmbeddings: boolean,
    dryRun: boolean
  ): Promise<void> {
    try {
      console.log(`📝 Processing ticket ${freshdeskTicket.id}: "${freshdeskTicket.subject}"`);

      // Step 1: Find corresponding GPNet ticket
      const gpnetTicket = await this.findGpnetTicket(freshdeskTicket.id);
      if (!gpnetTicket) {
        console.log(`⚠️ No GPNet ticket found for Freshdesk ticket ${freshdeskTicket.id}, skipping`);
        this.progress.processedTickets++;
        return;
      }

      // Step 2: Fetch conversations from Freshdesk
      const { conversations, notes } = await freshdeskService.getTicketWithConversations(freshdeskTicket.id);
      const allMessages = [...conversations, ...(includePrivateNotes ? notes : [])];

      console.log(`💬 Found ${conversations.length} replies and ${notes.length} notes for ticket ${freshdeskTicket.id}`);
      this.progress.totalMessages += allMessages.length;

      // Step 3: Process each message
      for (const message of allMessages) {
        await this.processMessage(gpnetTicket.id, message, generateEmbeddings, dryRun);
      }

      this.progress.processedTickets++;

    } catch (error) {
      console.error(`❌ Failed to process ticket ${freshdeskTicket.id}:`, error);
      this.progress.errors.push(`Ticket ${freshdeskTicket.id}: ${error}`);
      this.progress.processedTickets++;
    }
  }

  /**
   * Process a single message (conversation or note)
   */
  private async processMessage(
    gpnetTicketId: string,
    message: any,
    generateEmbeddings: boolean,
    dryRun: boolean
  ): Promise<void> {
    try {
      // Extract and clean text content
      const bodyText = this.extractTextFromMessage(message);
      if (!bodyText || bodyText.length < 10) {
        console.log('⏭️ Skipping message with insufficient content');
        this.progress.processedMessages++;
        return;
      }

      // Check if message already exists
      if (!dryRun) {
        const existingMessage = await db
          .select()
          .from(ticketMessages)
          .where(eq(ticketMessages.freshdeskMessageId, message.id.toString()))
          .limit(1);

        if (existingMessage.length > 0) {
          console.log(`⏭️ Message ${message.id} already exists, skipping`);
          this.progress.processedMessages++;
          return;
        }
      }

      // Prepare message data
      const messageData = {
        ticketId: gpnetTicketId,
        freshdeskMessageId: message.id.toString(),
        authorId: message.user_id?.toString(),
        authorRole: this.determineAuthorRole(message),
        authorName: message.from_email ? this.extractNameFromEmail(message.from_email) : undefined,
        authorEmail: message.from_email,
        isPrivate: message.private === true,
        bodyHtml: message.body_text || message.body,
        bodyText: bodyText,
        messageType: message.source ? 'reply' : 'note',
        incomingOrOutgoing: message.incoming ? 'incoming' : 'outgoing',
        freshdeskCreatedAt: message.created_at ? new Date(message.created_at) : undefined,
      };

      if (dryRun) {
        console.log(`🧪 DRY RUN: Would store message from ${messageData.authorRole}: ${bodyText.substring(0, 100)}...`);
        this.progress.processedMessages++;
        return;
      }

      // Store message in database
      const [storedMessage] = await db
        .insert(ticketMessages)
        .values(messageData)
        .returning({ id: ticketMessages.id });

      console.log(`✅ Stored message ${message.id} as ${storedMessage.id}`);

      // Generate embedding if requested
      if (generateEmbeddings && bodyText.length >= 50) {
        const embeddingId = await embeddingService.storeMessageEmbedding(
          storedMessage.id,
          bodyText
        );
        
        if (embeddingId) {
          this.progress.embeddedMessages++;
          console.log(`🧠 Generated embedding for message ${storedMessage.id}`);
        }
      }

      this.progress.processedMessages++;

    } catch (error) {
      console.error('❌ Failed to process message:', error);
      this.progress.errors.push(`Message ${message.id}: ${error}`);
      this.progress.processedMessages++;
    }
  }

  /**
   * Find GPNet ticket by Freshdesk ID
   */
  private async findGpnetTicket(freshdeskTicketId: number): Promise<any | null> {
    try {
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.fdId, freshdeskTicketId))
        .limit(1);

      return ticket || null;
    } catch (error) {
      console.error(`Failed to find GPNet ticket for Freshdesk ID ${freshdeskTicketId}:`, error);
      return null;
    }
  }

  /**
   * Extract clean text from Freshdesk message
   */
  private extractTextFromMessage(message: any): string {
    let text = message.body_text || message.body || '';
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, ' ');
    
    // Remove quoted content and signatures
    text = text.replace(/^>.*$/gm, '');
    text = text.replace(/On .* wrote:[\s\S]*$/g, '');
    text = text.replace(/--\s*\n[\s\S]*$/g, '');
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  /**
   * Determine author role from message
   */
  private determineAuthorRole(message: any): string {
    // If it's a private note, it's likely from an agent
    if (message.private === true) {
      return 'agent';
    }
    
    // If it has a source (email, portal, etc.), it's likely from requester
    if (message.source) {
      return 'requester';
    }
    
    // If it's incoming, it's likely from requester
    if (message.incoming === true) {
      return 'requester';
    }
    
    // Default to agent for outgoing messages
    return 'agent';
  }

  /**
   * Extract name from email address
   */
  private extractNameFromEmail(email: string): string {
    if (email.includes('<') && email.includes('>')) {
      const match = email.match(/^(.*?)\s*<.*@.*>$/);
      if (match) {
        return match[1].trim().replace(/['"]/g, '');
      }
    }
    
    return email.split('@')[0].replace(/[._]/g, ' ');
  }

  /**
   * Complete the backfill process
   */
  private completeBackfill(): void {
    this.progress.endTime = new Date();
    this.progress.durationMs = this.progress.endTime.getTime() - this.progress.startTime.getTime();
  }

  /**
   * Get current backfill progress
   */
  getProgress(): BackfillProgress {
    return { ...this.progress };
  }

  /**
   * Reset progress for new backfill
   */
  resetProgress(): void {
    this.progress = {
      totalTickets: 0,
      processedTickets: 0,
      totalMessages: 0,
      processedMessages: 0,
      embeddedMessages: 0,
      errors: [],
      startTime: new Date()
    };
  }
}

export const freshdeskRagBackfillService = new FreshdeskRagBackfillService();
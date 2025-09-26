import OpenAI from "openai";
import { db } from "./db.js";
import { ticketMessages, ticketMessageEmbeddings, documentEmbeddings, medicalDocuments } from "@shared/schema.js";
import { eq, and, desc, count, gte } from "drizzle-orm";

export interface EmbeddingResult {
  messageId: string;
  embeddingId: string;
  vector: number[];
  content: string;
}

export interface SimilaritySearchResult {
  messageId: string;
  ticketId: string;
  content: string;
  authorRole: string;
  authorName?: string;
  isPrivate: boolean;
  freshdeskCreatedAt?: Date;
  similarity: number;
}

export interface DocumentSimilarityResult {
  documentId: string;
  ticketId: string;
  content: string;
  filename: string;
  documentKind: string;
  chunkIndex: number;
  similarity: number;
}

export interface UnifiedSearchResult {
  id: string;
  type: 'message' | 'document';
  ticketId: string;
  content: string;
  metadata: {
    authorRole?: string;
    authorName?: string;
    filename?: string;
    documentKind?: string;
    chunkIndex?: number;
    freshdeskCreatedAt?: Date;
  };
  similarity: number;
}

/**
 * Service for generating and managing vector embeddings of ticket messages
 */
export class EmbeddingService {
  private openaiClient: OpenAI | null = null;

  constructor() {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    // Use same key discovery logic as Michelle service
    const possibleKeys = [
      process.env.OPENAI_API_KEY,
      process.env.GPNET_OPENAI,
      process.env.MICHELLE_OPENAI_KEY,
      process.env.GPT_API_KEY,
      process.env.AI_API_KEY,
      process.env.OPENAI_KEY, 
      process.env.REPLIT_OPENAI_API_KEY
    ].filter(Boolean);

    for (const key of possibleKeys) {
      if (key && key.startsWith('sk-') && !key.includes('youtube') && !key.includes('https://')) {
        this.openaiClient = new OpenAI({ apiKey: key });
        console.log('✅ EmbeddingService: OpenAI client initialized successfully');
        return;
      }
    }

    console.warn('⚠️ EmbeddingService: No valid OpenAI key found - embeddings will be disabled');
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openaiClient) {
      console.warn('EmbeddingService: OpenAI client not available');
      return null;
    }

    try {
      // Clean and prepare text for embedding
      const cleanText = this.cleanTextForEmbedding(text);
      if (cleanText.length < 10) {
        console.log('EmbeddingService: Text too short for embedding');
        return null;
      }

      const response = await this.openaiClient.embeddings.create({
        model: "text-embedding-ada-002",
        input: cleanText
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('EmbeddingService: Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Store embedding for a ticket message
   */
  async storeMessageEmbedding(
    messageId: string, 
    content: string, 
    chunkIndex = 0
  ): Promise<string | null> {
    const vector = await this.generateEmbedding(content);
    if (!vector) {
      return null;
    }

    try {
      const [result] = await db.insert(ticketMessageEmbeddings).values({
        messageId,
        vector: JSON.stringify(vector),
        content,
        chunkIndex,
        model: "text-embedding-ada-002"
      }).returning({ id: ticketMessageEmbeddings.id });

      console.log(`✅ Stored embedding for message ${messageId}`);
      return result.id;
    } catch (error) {
      console.error('EmbeddingService: Failed to store embedding:', error);
      return null;
    }
  }

  /**
   * Find similar messages using cosine similarity
   */
  async findSimilarMessages(
    queryText: string, 
    limit = 10,
    ticketId?: string,
    excludePrivate = true
  ): Promise<SimilaritySearchResult[]> {
    const queryVector = await this.generateEmbedding(queryText);
    if (!queryVector) {
      console.warn('EmbeddingService: Could not generate query embedding');
      return [];
    }

    try {
      // Get all embeddings and compute similarity in application
      // In production, would use a proper vector database like Pinecone
      const embeddings = await db
        .select({
          embeddingId: ticketMessageEmbeddings.id,
          messageId: ticketMessageEmbeddings.messageId,
          vector: ticketMessageEmbeddings.vector,
          content: ticketMessageEmbeddings.content,
          ticketId: ticketMessages.ticketId,
          authorRole: ticketMessages.authorRole,
          authorName: ticketMessages.authorName,
          isPrivate: ticketMessages.isPrivate,
          freshdeskCreatedAt: ticketMessages.freshdeskCreatedAt,
        })
        .from(ticketMessageEmbeddings)
        .innerJoin(ticketMessages, eq(ticketMessageEmbeddings.messageId, ticketMessages.id))
        .where(
          and(
            ticketId ? eq(ticketMessages.ticketId, ticketId) : undefined,
            excludePrivate ? eq(ticketMessages.isPrivate, false) : undefined
          )
        )
        .orderBy(desc(ticketMessages.freshdeskCreatedAt))
        .limit(500); // Limit to recent messages for performance

      // Compute cosine similarity and sort
      const results = embeddings
        .map(item => {
          const itemVector = JSON.parse(item.vector) as number[];
          const similarity = this.cosineSimilarity(queryVector, itemVector);
          
          return {
            messageId: item.messageId,
            ticketId: item.ticketId,
            content: item.content,
            authorRole: item.authorRole,
            authorName: item.authorName || undefined,
            isPrivate: item.isPrivate || false,
            freshdeskCreatedAt: item.freshdeskCreatedAt || undefined,
            similarity
          };
        })
        .filter(item => item.similarity > 0.7) // Only include relevant matches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`🔍 Found ${results.length} similar messages for query: "${queryText.substring(0, 50)}..."`);
      return results;
    } catch (error) {
      console.error('EmbeddingService: Failed to find similar messages:', error);
      return [];
    }
  }

  /**
   * Find similar documents using cosine similarity
   */
  async findSimilarDocuments(
    queryText: string, 
    limit = 5,
    ticketId?: string
  ): Promise<DocumentSimilarityResult[]> {
    const queryVector = await this.generateEmbedding(queryText);
    if (!queryVector) {
      console.warn('EmbeddingService: Could not generate query embedding for documents');
      return [];
    }

    try {
      // Get all document embeddings and compute similarity in application  
      const embeddings = await db
        .select({
          embeddingId: documentEmbeddings.id,
          documentId: documentEmbeddings.documentId,
          vector: documentEmbeddings.vector,
          content: documentEmbeddings.content,
          filename: documentEmbeddings.filename,
          documentKind: documentEmbeddings.documentKind,
          chunkIndex: documentEmbeddings.chunkIndex,
          ticketId: documentEmbeddings.ticketId,
        })
        .from(documentEmbeddings)
        .where(
          ticketId ? eq(documentEmbeddings.ticketId, ticketId) : undefined
        )
        .orderBy(desc(documentEmbeddings.createdAt))
        .limit(200); // Limit for performance

      // Compute cosine similarity and sort
      const results = embeddings
        .map(item => {
          const itemVector = JSON.parse(item.vector) as number[];
          const similarity = this.cosineSimilarity(queryVector, itemVector);
          
          return {
            documentId: item.documentId,
            ticketId: item.ticketId,
            content: item.content,
            filename: item.filename,
            documentKind: item.documentKind,
            chunkIndex: item.chunkIndex,
            similarity
          };
        })
        .filter(item => item.similarity > 0.7) // Only include relevant matches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`🔍 Found ${results.length} similar documents for query: "${queryText.substring(0, 50)}..."`);
      return results;
    } catch (error) {
      console.error('EmbeddingService: Failed to find similar documents:', error);
      return [];
    }
  }

  /**
   * Search both messages and documents, returning unified results
   */
  async findSimilarContent(
    queryText: string,
    limit = 10,
    ticketId?: string,
    excludePrivate = true
  ): Promise<UnifiedSearchResult[]> {
    // Search both messages and documents in parallel
    const [messageResults, documentResults] = await Promise.all([
      this.findSimilarMessages(queryText, Math.ceil(limit * 0.7), ticketId, excludePrivate),
      this.findSimilarDocuments(queryText, Math.ceil(limit * 0.5), ticketId)
    ]);

    // Convert to unified format
    const unifiedMessages: UnifiedSearchResult[] = messageResults.map(msg => ({
      id: msg.messageId,
      type: 'message' as const,
      ticketId: msg.ticketId,
      content: msg.content,
      metadata: {
        authorRole: msg.authorRole,
        authorName: msg.authorName,
        freshdeskCreatedAt: msg.freshdeskCreatedAt
      },
      similarity: msg.similarity
    }));

    const unifiedDocuments: UnifiedSearchResult[] = documentResults.map(doc => ({
      id: doc.documentId,
      type: 'document' as const,
      ticketId: doc.ticketId,
      content: doc.content,
      metadata: {
        filename: doc.filename,
        documentKind: doc.documentKind,
        chunkIndex: doc.chunkIndex
      },
      similarity: doc.similarity
    }));

    // Merge and sort by similarity
    const allResults = [...unifiedMessages, ...unifiedDocuments]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(`🔍 Unified search found ${allResults.length} results (${unifiedMessages.length} messages, ${unifiedDocuments.length} documents)`);
    return allResults;
  }

  /**
   * Get conversation context for a specific ticket
   */
  async getTicketConversationContext(ticketId: string, limit = 20): Promise<SimilaritySearchResult[]> {
    try {
      const messages = await db
        .select({
          messageId: ticketMessages.id,
          ticketId: ticketMessages.ticketId,
          content: ticketMessages.bodyText,
          authorRole: ticketMessages.authorRole,
          authorName: ticketMessages.authorName,
          isPrivate: ticketMessages.isPrivate,
          freshdeskCreatedAt: ticketMessages.freshdeskCreatedAt,
        })
        .from(ticketMessages)
        .where(eq(ticketMessages.ticketId, ticketId))
        .orderBy(desc(ticketMessages.freshdeskCreatedAt))
        .limit(limit);

      return messages.map(msg => ({
        messageId: msg.messageId,
        ticketId: msg.ticketId,
        content: msg.content,
        authorRole: msg.authorRole,
        authorName: msg.authorName || undefined,
        isPrivate: msg.isPrivate || false,
        freshdeskCreatedAt: msg.freshdeskCreatedAt || undefined,
        similarity: 1.0 // Perfect match since it's the same ticket
      }));
    } catch (error) {
      console.error('EmbeddingService: Failed to get ticket context:', error);
      return [];
    }
  }

  /**
   * Clean text for better embeddings
   */
  private cleanTextForEmbedding(text: string): string {
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, ' ');
    
    // Remove quoted email content (starts with >)
    cleaned = cleaned.replace(/^>.*$/gm, '');
    
    // Remove email signatures (common patterns)
    cleaned = cleaned.replace(/--\s*\n[\s\S]*$/g, '');
    cleaned = cleaned.replace(/Best regards[\s\S]*$/gi, '');
    cleaned = cleaned.replace(/Kind regards[\s\S]*$/gi, '');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get embedding stats for health check
   */
  async getEmbeddingStats(): Promise<{
    totalMessages: number;
    embeddedMessages: number;
    recentEmbeddings: number;
  }> {
    try {
      const totalMessages = await db
        .select({ count: count() })
        .from(ticketMessages);

      const embeddedMessages = await db
        .select({ count: count() })
        .from(ticketMessageEmbeddings);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);

      const recentEmbeddings = await db
        .select({ count: count() })
        .from(ticketMessageEmbeddings)
        .where(gte(ticketMessageEmbeddings.createdAt, recentDate));

      return {
        totalMessages: totalMessages[0].count,
        embeddedMessages: embeddedMessages[0].count,
        recentEmbeddings: recentEmbeddings[0].count
      };
    } catch (error) {
      console.error('EmbeddingService: Failed to get stats:', error);
      return { totalMessages: 0, embeddedMessages: 0, recentEmbeddings: 0 };
    }
  }
}

export const embeddingService = new EmbeddingService();
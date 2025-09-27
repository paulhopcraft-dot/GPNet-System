import { freshdeskService } from './freshdeskService.js';
import { documentProcessingService, initDocumentProcessingService } from './documentProcessingService.js';
import { embeddingService } from './embeddingService.js';
import type { IStorage } from './storage.js';
import type { AttachmentData } from './documentProcessingService.js';
import type { DocumentProcessingLog } from '@shared/schema';
import path from 'path';

/**
 * Service for processing medical report attachments from Freshdesk
 * Integrates Freshdesk → Document Processing → RAG Embeddings pipeline
 */
export class FreshdeskDocumentService {
  constructor(private storage: IStorage) {
    // Initialize document processing service with storage
    initDocumentProcessingService(storage);
  }

  /**
   * Process all attachments for a specific Freshdesk ticket
   */
  async processTicketAttachments(freshdeskTicketId: number, gpnetTicketId: string): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    try {
      console.log(`Processing attachments for Freshdesk ticket ${freshdeskTicketId} (GPNet: ${gpnetTicketId})`);

      // Get all attachments for the ticket
      const attachments = await freshdeskService.getTicketAttachments(freshdeskTicketId);
      
      if (attachments.length === 0) {
        console.log(`No attachments found for ticket ${freshdeskTicketId}`);
        return result;
      }

      console.log(`Found ${attachments.length} attachments to process`);

      // Process each attachment
      for (const attachment of attachments) {
        try {
          const processResult = await this.processAttachment(attachment, gpnetTicketId);
          
          if (processResult.success) {
            result.processed++;
            console.log(`✅ Processed ${attachment.name}: ${processResult.documentId}`);
          } else {
            result.skipped++;
            console.log(`⏭️ Skipped ${attachment.name}: ${processResult.error}`);
          }
        } catch (error) {
          result.errors.push(`${attachment.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`❌ Error processing ${attachment.name}:`, error);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`Completed processing for ticket ${freshdeskTicketId}: ${result.processed} processed, ${result.skipped} skipped, ${result.errors.length} errors`);
      return result;

    } catch (error) {
      console.error(`Failed to process attachments for ticket ${freshdeskTicketId}:`, error);
      result.errors.push(`Ticket processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Process a single attachment from Freshdesk
   */
  private async processAttachment(attachment: any, gpnetTicketId: string): Promise<{
    success: boolean;
    documentId?: string;
    error?: string;
  }> {
    try {
      // Check if this looks like a medical document
      if (!this.isMedicalDocument(attachment.name, attachment.content_type)) {
        return {
          success: false,
          error: 'Not a medical document (filename/type filter)'
        };
      }

      // Download the attachment
      const buffer = await freshdeskService.downloadAttachment(attachment.attachment_url);
      if (!buffer) {
        return {
          success: false,
          error: 'Failed to download attachment'
        };
      }

      // Create attachment data for processing
      const attachmentData: AttachmentData = {
        url: attachment.attachment_url,
        filename: attachment.name,
        contentType: attachment.content_type,
        size: attachment.size,
        buffer
      };

      // Get worker ID from ticket
      const ticket = await this.storage.getTicket(gpnetTicketId);
      if (!ticket || !ticket.workerId) {
        return {
          success: false,
          error: 'Worker not found for ticket'
        };
      }

      // Process through document processing service
      const processingResult = await documentProcessingService.processAttachment(
        gpnetTicketId,
        ticket.workerId,
        attachmentData,
        attachment.id?.toString(),
        undefined, // companyId
        undefined  // requesterEmail
      );

      if (!processingResult.success || !processingResult.documentId) {
        return {
          success: false,
          error: processingResult.error || 'Document processing failed'
        };
      }

      // Generate embeddings for the processed document
      await this.generateDocumentEmbeddings(processingResult.documentId, gpnetTicketId);

      return {
        success: true,
        documentId: processingResult.documentId
      };

    } catch (error) {
      console.error('Error processing attachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate embeddings for a processed document
   */
  private async generateDocumentEmbeddings(documentId: string, ticketId: string): Promise<void> {
    try {
      console.log(`Generating embeddings for document ${documentId}`);

      // Get the document and its extracted text
      const document = await this.storage.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Get the OCR extraction result (stored in document processing logs)
      const extractedText = await this.getDocumentExtractedText(documentId);
      if (!extractedText) {
        console.log(`No extracted text found for document ${documentId}, skipping embeddings`);
        return;
      }

      // Split text into chunks if it's too long
      const chunks = this.splitTextIntoChunks(extractedText, 1000); // 1000 chars per chunk

      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          const embedding = await embeddingService.generateEmbedding(chunk);
          
          // Store document embedding
          await this.storage.createDocumentEmbedding({
            documentId,
            ticketId,
            vector: JSON.stringify(embedding),
            content: chunk,
            filename: document.originalFilename,
            documentKind: document.kind,
            chunkIndex: i
          });

          console.log(`✅ Generated embedding for document ${documentId} chunk ${i + 1}/${chunks.length}`);
        } catch (error) {
          console.error(`Failed to generate embedding for document ${documentId} chunk ${i}:`, error);
          // Continue with other chunks
        }
      }

      console.log(`Completed embeddings for document ${documentId}: ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Failed to generate embeddings for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file looks like a medical document based on filename and content type
   */
  private isMedicalDocument(filename: string, contentType: string): boolean {
    const medicalKeywords = [
      'medical', 'certificate', 'report', 'diagnosis', 'doctor', 'physician',
      'clinic', 'hospital', 'radiology', 'xray', 'x-ray', 'mri', 'ct', 'scan',
      'blood', 'test', 'result', 'lab', 'pathology', 'specialist', 'referral',
      'assessment', 'examination', 'fitness', 'capacity', 'clearance'
    ];

    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    // Check content type
    if (!supportedTypes.includes(contentType)) {
      return false;
    }

    // Check filename for medical keywords
    const lowerFilename = filename.toLowerCase();
    return medicalKeywords.some(keyword => lowerFilename.includes(keyword));
  }

  /**
   * Get extracted text from a processed document
   */
  private async getDocumentExtractedText(documentId: string): Promise<string | null> {
    try {
      // Get the document directly from the medical_documents table
      const document = await this.storage.getDocument(documentId);
      
      if (!document) {
        console.log(`Document ${documentId} not found in database`);
        return null;
      }

      // Return the extracted text field from the medical document
      if (document.extracted_text && document.extracted_text.trim().length > 0) {
        return document.extracted_text;
      }

      console.log(`Document ${documentId} found but no extracted text available`);
      return null;
    } catch (error) {
      console.error(`Failed to get extracted text for document ${documentId}:`, error);
      return null;
    }
  }

  /**
   * Split text into chunks for embedding
   */
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    
    // Split by sentences first to maintain context
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks.length > 0 ? chunks : [text.substring(0, maxChunkSize)];
  }

  /**
   * Backfill all Freshdesk attachments for existing tickets
   */
  async backfillAllAttachments(): Promise<{
    totalTickets: number;
    processedTickets: number;
    totalAttachments: number;
    processedAttachments: number;
    errors: string[];
  }> {
    const result = {
      totalTickets: 0,
      processedTickets: 0,
      totalAttachments: 0,
      processedAttachments: 0,
      errors: [] as string[]
    };

    try {
      console.log('🚀 Starting Freshdesk attachment backfill...');

      // Get all GPNet tickets that have Freshdesk IDs
      const gpnetTickets = await this.storage.getAllTicketsWithFreshdeskIds();
      result.totalTickets = gpnetTickets.length;

      console.log(`Found ${gpnetTickets.length} tickets with Freshdesk IDs`);

      for (const ticket of gpnetTickets) {
        if (!ticket.fdId) continue;

        try {
          console.log(`Processing ticket ${ticket.id} (Freshdesk ID: ${ticket.fdId})`);

          const ticketResult = await this.processTicketAttachments(ticket.fdId, ticket.id);
          
          result.totalAttachments += (ticketResult.processed + ticketResult.skipped);
          result.processedAttachments += ticketResult.processed;
          result.errors.push(...ticketResult.errors);
          
          if (ticketResult.processed > 0 || ticketResult.skipped > 0) {
            result.processedTickets++;
          }

          // Rate limiting between tickets
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          const errorMsg = `Ticket ${ticket.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(`❌ Error processing ticket ${ticket.id}:`, error);
        }
      }

      console.log(`✅ Backfill completed: ${result.processedTickets}/${result.totalTickets} tickets, ${result.processedAttachments}/${result.totalAttachments} attachments processed`);
      
      if (result.errors.length > 0) {
        console.log(`⚠️ ${result.errors.length} errors occurred during backfill`);
      }

      return result;

    } catch (error) {
      console.error('❌ Fatal error during backfill:', error);
      result.errors.push(`Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }
}

import { storage } from './storage.js';

export const freshdeskDocumentService = new FreshdeskDocumentService(storage);
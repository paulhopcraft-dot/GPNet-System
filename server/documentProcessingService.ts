import { ocrService, type OcrResult } from './ocrService.js';
import type { IStorage } from './storage.js';
import type { 
  InsertMedicalDocument, 
  InsertDocumentProcessingJob, 
  InsertDocumentProcessingLog,
  MedicalDocument,
  DocumentProcessingJob,
  DocumentKind,
  FitStatus,
  ProcessingStatus 
} from '@shared/schema';
import { createHash } from 'crypto';

export interface DocumentProcessingResult {
  success: boolean;
  documentId?: string;
  error?: string;
  processingTime: number;
  requiresReview: boolean;
}

export interface AttachmentData {
  url: string;
  filename: string;
  contentType: string;
  size: number;
  buffer: Buffer;
}

export class DocumentProcessingService {
  constructor(private storage: IStorage) {}

  /**
   * Resolve the object storage root directory with existence check and fallback
   */
  private async resolveStorageRoot(): Promise<{ root: string, mode: 'persistent' | 'temp' }> {
    const configuredDir = process.env.PRIVATE_OBJECT_DIR;
    
    if (configuredDir) {
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(configuredDir);
        if (stats.isDirectory()) {
          return { root: configuredDir, mode: 'persistent' };
        }
      } catch (error) {
        // Directory doesn't exist or isn't accessible
        console.warn(`Object storage mount '${configuredDir}' not available, falling back to temp storage`);
      }
    }
    
    // Fallback to temporary storage
    const tempRoot = '/tmp/private-storage';
    return { root: tempRoot, mode: 'temp' };
  }

  /**
   * Build a safe storage path using the resolved storage root
   */
  private async buildStoragePath(storageKey: string): Promise<string> {
    const { root } = await this.resolveStorageRoot();
    const path = await import('path');
    return path.join(root, storageKey);
  }

  /**
   * Process a medical document attachment from Freshdesk
   */
  async processAttachment(
    ticketId: string,
    workerId: string,
    attachmentData: AttachmentData,
    sourceId?: string,
    companyId?: string,
    requesterEmail?: string
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    let documentId: string | undefined;
    let jobId: string | undefined;

    try {
      console.log(`Starting document processing for ticket ${ticketId}, file: ${attachmentData.filename}`);

      // Create processing job
      const job = await this.createProcessingJob({
        ticketId,
        attachmentUrl: attachmentData.url,
        status: 'processing',
        priority: 'normal'
      });
      jobId = job.id;

      await this.logEvent(undefined, jobId, 'download_started', 'Starting document download and processing');

      // Generate checksum for idempotency
      const checksum = this.generateChecksum(attachmentData.buffer);

      // Check for duplicate document
      const existingDoc = await this.findDocumentByChecksum(checksum);
      if (existingDoc) {
        console.log(`Duplicate document detected: ${checksum}`);
        await this.logEvent(existingDoc.id, jobId!, 'error', 'Duplicate document detected', { checksum });
        
        await this.updateJobStatus(jobId!, 'completed', existingDoc.id);
        
        return {
          success: true,
          documentId: existingDoc.id,
          processingTime: Date.now() - startTime,
          requiresReview: existingDoc.requiresReview
        };
      }

      // Perform OCR and field extraction
      await this.logEvent(undefined, jobId, 'ocr_started', 'Starting OCR and field extraction');
      
      const ocrResult = await ocrService.extractMedicalData(
        attachmentData.buffer,
        attachmentData.contentType,
        attachmentData.filename
      );

      if (!ocrResult.success) {
        throw new Error(`OCR failed: ${ocrResult.error}`);
      }

      await this.logEvent(undefined, jobId, 'ocr_completed', 'OCR and field extraction completed', {
        confidence: ocrResult.extractedFields.confidence,
        classification: ocrResult.classification
      });

      // Store document in object storage
      const storageKey = await this.storeDocumentFile(attachmentData.buffer, attachmentData.filename, attachmentData.contentType);
      
      await this.logEvent(undefined, jobId, 'storage_completed', 'Document stored in object storage', { storageKey });

      // Create medical document record
      const medicalDoc = await this.createMedicalDocument({
        ticketId,
        workerId,
        sourceType: 'freshdesk_attachment',
        sourceId,
        kind: ocrResult.classification.kind,
        originalFilename: attachmentData.filename,
        fileUrl: storageKey, // Storage key for file retrieval
        contentType: attachmentData.contentType,
        fileSize: attachmentData.size,
        checksum,
        ...ocrResult.extractedFields,
        confidence: ocrResult.extractedFields.confidence || 0,
        requiresReview: this.shouldRequireReview(ocrResult),
        isCurrentCertificate: this.isCurrentCertificate(ocrResult.extractedFields),
        processingStatus: 'completed'
      });

      documentId = medicalDoc.id;

      await this.logEvent(documentId, jobId, 'validation_completed', 'Document validation and normalization completed');

      // Update case based on extracted data
      await this.updateCaseFromDocument(ticketId, ocrResult);
      
      await this.logEvent(documentId, jobId, 'case_updated', 'Case updated with document information');

      // Mark job as completed
      await this.updateJobStatus(jobId!, 'completed', documentId);

      // Check if review is required
      if (medicalDoc.requiresReview) {
        await this.logEvent(documentId, jobId, 'review_required', 'Document flagged for manual review');
      }

      const processingTime = Date.now() - startTime;
      
      console.log(`Document processing completed successfully: ${documentId} in ${processingTime}ms`);

      return {
        success: true,
        documentId,
        processingTime,
        requiresReview: medicalDoc.requiresReview
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Document processing failed:', error);

      if (documentId) {
        await this.logEvent(documentId, jobId, 'error', `Processing failed: ${errorMessage}`);
      }

      if (jobId) {
        await this.updateJobStatus(jobId, 'failed', undefined, errorMessage);
      }

      return {
        success: false,
        error: errorMessage,
        processingTime,
        requiresReview: true
      };
    }
  }

  /**
   * Store document file in object storage
   */
  private async storeDocumentFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    try {
      // Generate unique filename to prevent conflicts
      const timestamp = Date.now();
      const hash = this.generateChecksum(buffer).substring(0, 8);
      const ext = filename.split('.').pop() || 'bin';
      const uniqueFilename = `medical-docs/${timestamp}-${hash}.${ext}`;

      // Resolve storage root with existence check and fallback
      const { root, mode } = await this.resolveStorageRoot();
      
      // Import filesystem modules
      const fs = await import('fs/promises');
      const path = await import('path');

      // Only create subdirectories under the verified root (never create the mount root itself)
      const medicalDocsDir = path.join(root, 'medical-docs');
      await fs.mkdir(medicalDocsDir, { recursive: true });

      // Build full path for the file using storage key
      const filePath = await this.buildStoragePath(uniqueFilename);
      
      // Write the file to object storage
      await fs.writeFile(filePath, buffer);
      
      // Verify the file was written successfully
      const stats = await fs.stat(filePath);
      if (stats.size !== buffer.length) {
        throw new Error(`File size mismatch: expected ${buffer.length}, got ${stats.size}`);
      }

      console.log(`Document successfully stored in object storage (${mode}): ${stats.size} bytes`);
      
      // Return only the storage key (not absolute path) for security and portability
      return uniqueFilename;

    } catch (error) {
      console.error('Failed to store document in object storage:', error);
      throw new Error(`Object storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate SHA-256 checksum for file content
   */
  private generateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if document requires manual review
   */
  private shouldRequireReview(ocrResult: OcrResult): boolean {
    const confidence = ocrResult.extractedFields.confidence || 0;
    
    // Require review if overall confidence is low
    if (confidence < 70) {
      return true;
    }

    // Check critical field confidences
    const fieldConfidences = ocrResult.extractedFields.fieldConfidences || {};
    const criticalFields = ['patientName', 'fitStatus', 'validTo'];
    
    for (const field of criticalFields) {
      if (fieldConfidences[field] && fieldConfidences[field] < 70) {
        return true;
      }
    }

    // Require review if no fit status was determined
    if (!ocrResult.extractedFields.fitStatus) {
      return true;
    }

    // Require review if dates seem invalid
    if (ocrResult.extractedFields.validTo && ocrResult.extractedFields.validFrom) {
      const validTo = new Date(ocrResult.extractedFields.validTo);
      const validFrom = new Date(ocrResult.extractedFields.validFrom);
      
      if (validTo <= validFrom) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if this is the current active certificate
   */
  private isCurrentCertificate(fields: any): boolean {
    if (!fields.validFrom || !fields.validTo) {
      return false;
    }

    try {
      const now = new Date();
      const validFrom = new Date(fields.validFrom);
      const validTo = new Date(fields.validTo);

      return now >= validFrom && now <= validTo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update case status and next steps based on document content
   */
  private async updateCaseFromDocument(ticketId: string, ocrResult: OcrResult): Promise<void> {
    const fields = ocrResult.extractedFields;
    
    try {
      // Get current case data
      const ticket = await this.storage.getTicket(ticketId);
      if (!ticket) {
        console.warn(`Ticket not found for update: ${ticketId}`);
        return;
      }

      let nextStep = ticket.nextStep || "Review medical certificate";
      let complianceStatus = "compliant";

      // Update next step based on fit status
      switch (fields.fitStatus) {
        case 'unfit':
          nextStep = `Worker unfit for duties. Review on ${fields.reviewOn || fields.validTo || 'next appointment'}`;
          complianceStatus = "at_risk";
          break;
          
        case 'fit_with_restrictions':
          nextStep = `Implement modified duties: ${fields.restrictions || 'See certificate for restrictions'}`;
          break;
          
        case 'fit_unrestricted':
          nextStep = "Return to full duties - medical clearance received";
          break;
          
        default:
          nextStep = "Review medical certificate and determine work capacity";
          break;
      }

      // Update current capacity if capacity notes available
      let currentCapacity: number | undefined;
      if (fields.capacityNotes) {
        const capacityMatch = fields.capacityNotes.match(/(\d+)\s*kg/i);
        if (capacityMatch) {
          currentCapacity = parseInt(capacityMatch[1]);
        }
      }

      // Update ticket with new information
      await this.storage.updateTicket(ticketId, {
        nextStep,
        complianceStatus,
        lastStep: "Medical certificate processed",
        lastStepCompletedAt: new Date()
      });

      // Update case with capacity information
      if (currentCapacity) {
        const existingCase = await this.storage.getCaseByTicketId(ticketId);
        if (existingCase) {
          await this.storage.updateCase(existingCase.id, {
            currentCapacity,
            nextStepText: nextStep,
            nextStepDueAt: fields.reviewOn ? new Date(fields.reviewOn) : undefined
          });
        }
      }

      console.log(`Case updated for ticket ${ticketId}: ${nextStep}`);

    } catch (error) {
      console.error('Failed to update case from document:', error);
      // Don't throw - document processing should continue even if case update fails
    }
  }

  /**
   * Create a new medical document record
   */
  private async createMedicalDocument(data: Omit<InsertMedicalDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<MedicalDocument> {
    const document = await this.storage.createMedicalDocument(data);
    console.log('Created medical document:', document.id);
    return document;
  }

  /**
   * Create a processing job record
   */
  private async createProcessingJob(data: Omit<InsertDocumentProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentProcessingJob> {
    const job = await this.storage.createDocumentProcessingJob(data);
    console.log('Created processing job:', job.id);
    return job;
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: ProcessingStatus, documentId?: string, errorMessage?: string): Promise<void> {
    try {
      await this.storage.updateDocumentProcessingJob(jobId, {
        status,
        documentId,
        errorMessage,
        updatedAt: new Date()
      });
      console.log(`Updated job ${jobId} status to ${status}${documentId ? ` with document ${documentId}` : ''}`);
    } catch (error) {
      console.error(`Failed to update job ${jobId} status:`, error);
      // Don't throw - processing should continue
    }
  }

  /**
   * Log processing event
   */
  private async logEvent(
    documentId: string | undefined,
    jobId: string | undefined,
    eventType: string,
    message: string,
    details?: any
  ): Promise<void> {
    console.log(`[${eventType}] ${message}`, details || '');
    // In real implementation, this would create a log record
  }

  /**
   * Find existing document by checksum
   */
  private async findDocumentByChecksum(checksum: string): Promise<any | null> {
    // In real implementation, this would query the database
    return null;
  }

  /**
   * Get service status and metrics
   */
  static getServiceInfo() {
    return {
      serviceName: 'Medical Document Processing Service',
      capabilities: [
        'Freshdesk attachment processing',
        'OCR field extraction',
        'Document classification',
        'Case updates',
        'Review flagging',
        'Duplicate detection'
      ],
      supportedSources: ['freshdesk_attachment', 'manual_upload', 'email_attachment']
    };
  }
}

// Create and export singleton instance - will be properly initialized in routes.ts
export let documentProcessingService: DocumentProcessingService;

export function initDocumentProcessingService(storage: IStorage): DocumentProcessingService {
  if (!documentProcessingService) {
    documentProcessingService = new DocumentProcessingService(storage);
  }
  return documentProcessingService;
}
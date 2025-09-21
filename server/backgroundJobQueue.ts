import type { IStorage } from './storage.js';
import type { 
  InsertDocumentProcessingJob, 
  DocumentProcessingJob,
  ProcessingStatus 
} from '@shared/schema';

export interface JobData {
  type: 'document_processing';
  ticketId: string;
  workerId: string;
  attachmentData: {
    url: string;
    filename: string;
    contentType: string;
    size: number;
    buffer: Buffer;
  };
  sourceId?: string;
  companyId?: string;
  requesterEmail?: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface QueuedJob {
  id: string;
  data: JobData;
  priority: 'low' | 'normal' | 'high';
  status: ProcessingStatus;
  scheduledAt: Date;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export class BackgroundJobQueue {
  private storage: IStorage;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly PROCESSING_INTERVAL = 5000; // 5 seconds
  private readonly MAX_CONCURRENT_JOBS = 3;
  private readonly DEFAULT_MAX_RETRIES = 3;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Add a job to the background processing queue
   */
  async enqueue(jobData: JobData, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string> {
    try {
      console.log(`Enqueueing ${jobData.type} job for ticket ${jobData.ticketId}`);

      const job = await this.storage.createDocumentProcessingJob({
        ticketId: jobData.ticketId,
        attachmentUrl: jobData.attachmentData.url,
        companyId: jobData.companyId,
        requesterEmail: jobData.requesterEmail,
        status: 'queued',
        priority,
        metadata: {
          filename: jobData.attachmentData.filename,
          contentType: jobData.attachmentData.contentType,
          size: jobData.attachmentData.size,
          workerId: jobData.workerId,
          sourceId: jobData.sourceId,
          retryCount: jobData.retryCount || 0,
          maxRetries: jobData.maxRetries || this.DEFAULT_MAX_RETRIES,
          queuedAt: new Date().toISOString()
        }
      });

      // No need to store attachment buffer - download happens during job processing
      // Store only metadata for download during background processing

      console.log(`Job ${job.id} enqueued successfully`);
      return job.id;

    } catch (error) {
      console.error('Failed to enqueue job:', error);
      throw new Error(`Failed to enqueue job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start the background job processor
   */
  start(): void {
    if (this.processingInterval) {
      console.log('Background job queue already running');
      return;
    }

    console.log('Starting background job queue processor');
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processJobs();
      }
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Stop the background job processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Background job queue processor stopped');
    }
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    this.isProcessing = true;

    try {
      // Get pending jobs ordered by priority and scheduled time
      const pendingJobs = await this.storage.getDocumentProcessingJobsByStatus('queued');
      
      if (pendingJobs.length === 0) {
        return;
      }

      console.log(`Found ${pendingJobs.length} pending jobs to process`);

      // Sort by priority (high > normal > low) then by creation time
      const sortedJobs = pendingJobs.sort((a, b) => {
        const priorityWeight = { high: 3, normal: 2, low: 1 };
        const aPriority = priorityWeight[a.priority as keyof typeof priorityWeight] || 2;
        const bPriority = priorityWeight[b.priority as keyof typeof priorityWeight] || 2;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Older first
      });

      // Process up to MAX_CONCURRENT_JOBS
      const jobsToProcess = sortedJobs.slice(0, this.MAX_CONCURRENT_JOBS);
      
      // Process jobs concurrently
      await Promise.allSettled(
        jobsToProcess.map(job => this.processJob(job))
      );

    } catch (error) {
      console.error('Error processing jobs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: DocumentProcessingJob): Promise<void> {
    try {
      console.log(`Processing job ${job.id} for ticket ${job.ticketId}`);

      // Mark job as processing
      await this.storage.updateDocumentProcessingJob(job.id, {
        status: 'processing',
        startedAt: new Date()
      });

      // Extract job data from metadata
      const metadata = job.metadata as any;
      if (!metadata || !metadata.filename) {
        throw new Error('Missing attachment metadata in job');
      }

      // Download attachment during background processing (not in webhook)
      console.log(`Downloading attachment from: ${job.attachmentUrl}`);
      const attachmentData = await this.downloadAttachment(job.attachmentUrl, metadata.filename, metadata.contentType, metadata.size);

      // Get document processing service
      const { DocumentProcessingService } = await import('./documentProcessingService.js');
      const documentService = new DocumentProcessingService(this.storage);

      // Process the document
      const result = await documentService.processAttachment(
        job.ticketId,
        metadata.workerId,
        attachmentData,
        metadata.sourceId,
        job.companyId,
        job.requesterEmail
      );

      if (result.success) {
        // Mark job as completed
        await this.storage.updateDocumentProcessingJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          documentId: result.documentId,
          metadata: {
            ...metadata,
            processingTime: result.processingTime,
            requiresReview: result.requiresReview
          }
        });

        console.log(`Job ${job.id} completed successfully`);
      } else {
        throw new Error(result.error || 'Document processing failed');
      }

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: DocumentProcessingJob, error: any): Promise<void> {
    const metadata = job.metadata as any || {};
    const retryCount = (metadata.retryCount || 0) + 1;
    const maxRetries = metadata.maxRetries || this.DEFAULT_MAX_RETRIES;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (retryCount <= maxRetries) {
      // Retry the job with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
      
      console.log(`Retrying job ${job.id} in ${delayMs}ms (attempt ${retryCount}/${maxRetries})`);

      setTimeout(async () => {
        try {
          await this.storage.updateDocumentProcessingJob(job.id, {
            status: 'queued',
            metadata: {
              ...metadata,
              retryCount,
              lastError: errorMessage,
              retryAt: new Date().toISOString()
            }
          });
        } catch (updateError) {
          console.error(`Failed to update job ${job.id} for retry:`, updateError);
        }
      }, delayMs);

    } else {
      // Mark job as failed after max retries
      await this.storage.updateDocumentProcessingJob(job.id, {
        status: 'failed',
        failedAt: new Date(),
        metadata: {
          ...metadata,
          retryCount,
          lastError: errorMessage,
          finalFailureReason: `Failed after ${maxRetries} retries`
        }
      });

      console.error(`Job ${job.id} failed permanently after ${maxRetries} retries`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [queued, processing, completed, failed] = await Promise.all([
        this.storage.getDocumentProcessingJobsByStatus('queued'),
        this.storage.getDocumentProcessingJobsByStatus('processing'),
        this.storage.getDocumentProcessingJobsByStatus('completed'),
        this.storage.getDocumentProcessingJobsByStatus('failed')
      ]);

      return {
        queued: queued.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return { queued: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Download attachment from URL (similar to FreshdeskWebhookService)
   */
  private async downloadAttachment(url: string, filename: string, contentType: string, size: number): Promise<{
    url: string;
    filename: string;
    contentType: string;
    size: number;
    buffer: Buffer;
  }> {
    // Add Freshdesk authentication for download
    const auth = Buffer.from(`${process.env.FRESHDESK_API_KEY}:X`).toString('base64');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'GPNet Medical Document Processor'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    
    return {
      url,
      filename: filename || 'unknown-file',
      contentType: contentType || 'application/octet-stream',
      size: buffer.length,
      buffer
    };
  }
}

// Global queue instance
let queueInstance: BackgroundJobQueue | null = null;

export function initBackgroundJobQueue(storage: IStorage): BackgroundJobQueue {
  if (!queueInstance) {
    queueInstance = new BackgroundJobQueue(storage);
    queueInstance.start();
    console.log('Background job queue initialized and started');
  }
  return queueInstance;
}

export function getBackgroundJobQueue(): BackgroundJobQueue | null {
  return queueInstance;
}
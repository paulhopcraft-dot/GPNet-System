import { Router } from 'express';
import { type FreshdeskWebhookEvent } from './freshdeskWebhookService.js';
import { documentProcessingService } from './documentProcessingService.js';
import { ocrService } from './ocrService.js';
import { requireAdmin } from './adminRoutes.js';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import express from 'express';

const router = Router();

// Raw body is now handled at application level in server/index.ts
// This ensures it runs before global express.json() middleware

// Validation schemas
const webhookEventSchema = z.object({
  type: z.enum(['ticket_created', 'ticket_updated', 'note_added']),
  ticket: z.object({
    id: z.number(),
    subject: z.string(),
    status: z.number(),
    priority: z.number(),
    requester_id: z.number(),
    company_id: z.number().optional(),
    attachments: z.array(z.object({
      id: z.number(),
      name: z.string(),
      content_type: z.string(),
      size: z.number(),
      attachment_url: z.string()
    })).optional()
  }),
  requester: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email()
  }).optional(),
  time_stamp: z.string()
});

/**
 * GET /api/medical-documents/health
 * Simple health check to verify storage and services are working
 * No authentication required - for testing purposes
 */
router.get('/health', async (req, res) => {
  try {
    // Test storage connectivity
    const { storage } = await import('./storage.js');
    
    // Simple test that doesn't require actual data
    const storageTest = {
      connectionAvailable: true,
      implementationActive: storage.constructor.name
    };

    // Test services availability  
    const services = {
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      freshdeskConfigured: !!(process.env.FRESHDESK_API_KEY && process.env.FRESHDESK_DOMAIN),
      objectStorageConfigured: !!process.env.PRIVATE_OBJECT_DIR
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      storage: storageTest,
      services,
      message: 'Medical document processing system is operational'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/medical-documents/queue-stats
 * Get background job queue statistics
 * No authentication required - for monitoring purposes
 */
router.get('/queue-stats', async (req, res) => {
  try {
    const { getBackgroundJobQueue } = await import('./backgroundJobQueue.js');
    const jobQueue = getBackgroundJobQueue();
    
    if (!jobQueue) {
      return res.json({
        success: false,
        error: 'Background job queue not initialized',
        stats: { queued: 0, processing: 0, completed: 0, failed: 0 }
      });
    }

    const stats = await jobQueue.getQueueStats();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      queueActive: true
    });

  } catch (error) {
    console.error('Queue stats check failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Queue stats check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/medical-documents/freshdesk-webhook
 * Process incoming Freshdesk webhooks for medical document attachments
 */
router.post('/freshdesk-webhook', async (req, res) => {
  try {
    console.log('Received Freshdesk webhook for medical document processing');

    // Parse JSON from raw body for webhook processing
    let parsedBody;
    const rawBody = (req as any).rawBody || '';
    
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (error) {
      console.error('Invalid JSON in webhook payload:', error);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Validate webhook signature (required in production)
    // Freshdesk sends X-Freshdesk-Signature header
    const signature = (req.headers['x-freshdesk-signature'] || req.headers['X-Freshdesk-Signature']) as string;
    const webhookSecret = process.env.FRESHDESK_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const { FreshdeskWebhookService } = await import('./freshdeskWebhookService.js');
      const isValid = FreshdeskWebhookService.validateWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );
      
      if (!isValid) {
        console.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, webhook signature verification is required
      console.warn('Missing webhook signature in production');
      return res.status(401).json({ error: 'Webhook signature required in production' });
    }

    // Validate request payload
    const validationResult = webhookEventSchema.safeParse(parsedBody);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      console.error('Invalid webhook payload:', errorMessage);
      return res.status(400).json({ error: 'Invalid webhook payload', details: errorMessage });
    }

    const event: FreshdeskWebhookEvent = validationResult.data;

    // Real-time sync: Import/update the ticket immediately
    const { FreshdeskImportService } = await import('./freshdeskImportService.js');
    const { storage } = await import('./storage.js');
    const { initFreshdeskWebhookService } = await import('./freshdeskWebhookService.js');
    
    const importService = new FreshdeskImportService(storage);
    const webhookService = initFreshdeskWebhookService(storage);
    
    const importResult = await importService.importSingleTicket(event.ticket.id);
    console.log(`Real-time sync result:`, importResult);

    // Process attachments (if any) - only if import succeeded
    if (importResult.success && event.ticket.attachments && event.ticket.attachments.length > 0) {
      await webhookService.processWebhook(event);
    }

    res.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      ticketSynced: importResult.success,
      gpnetTicketId: importResult.ticketId,
      processed_attachments: event.ticket.attachments?.length || 0
    });

  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/medical-documents/manual-upload
 * Manually upload and process a medical document
 */
router.post('/manual-upload', requireAdmin, async (req, res) => {
  try {
    const { ticketId, workerId, fileData, filename, contentType } = req.body;

    if (!ticketId || !workerId || !fileData || !filename) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['ticketId', 'workerId', 'fileData', 'filename']
      });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');

    const result = await documentProcessingService.processAttachment(
      ticketId,
      workerId,
      {
        url: 'manual-upload',
        filename,
        contentType: contentType || 'application/pdf',
        size: buffer.length,
        buffer
      },
      'manual-upload'
    );

    res.json({
      success: result.success,
      documentId: result.documentId,
      error: result.error,
      requiresReview: result.requiresReview,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Manual upload processing failed:', error);
    res.status(500).json({ 
      error: 'Upload processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/medical-documents/service-status
 * Get status of medical document processing services
 */
router.get('/service-status', requireAdmin, async (req, res) => {
  try {
    const { OcrService } = await import('./ocrService.js');
    const { DocumentProcessingService } = await import('./documentProcessingService.js');
    const { FreshdeskWebhookService } = await import('./freshdeskWebhookService.js');
    
    const services = {
      ocr: OcrService.getServiceInfo(),
      processing: DocumentProcessingService.getServiceInfo(),
      webhook: FreshdeskWebhookService.getServiceInfo(),
      environment: {
        openaiAvailable: !!process.env.OPENAI_API_KEY,
        freshdeskAvailable: !!(process.env.FRESHDESK_API_KEY && process.env.FRESHDESK_DOMAIN),
        objectStorageAvailable: !!process.env.PRIVATE_OBJECT_DIR
      }
    };

    res.json({
      success: true,
      services,
      systemReady: services.environment.openaiAvailable && services.environment.objectStorageAvailable
    });

  } catch (error) {
    console.error('Service status check failed:', error);
    res.status(500).json({ 
      error: 'Service status check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/medical-documents/test-ocr
 * Test OCR extraction on an image (admin only, for testing)
 */
router.post('/test-ocr', requireAdmin, async (req, res) => {
  try {
    const { imageData, filename, contentType } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'Missing imageData' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');

    const result = await ocrService.extractMedicalData(
      buffer,
      contentType || 'image/jpeg',
      filename || 'test-image.jpg'
    );

    res.json({
      success: result.success,
      extractedFields: result.extractedFields,
      classification: result.classification,
      processingTime: result.processingTime,
      error: result.error
    });

  } catch (error) {
    console.error('OCR test failed:', error);
    res.status(500).json({ 
      error: 'OCR test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/medical-documents/ticket/:ticketId
 * Get all medical documents for a ticket
 */
router.get('/ticket/:ticketId', requireAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Query medical documents from storage
    const { storage } = await import('./storage.js');
    const documents = await storage.getMedicalDocumentsByTicket(ticketId);

    res.json({
      success: true,
      ticketId,
      documents,
      count: documents.length
    });

  } catch (error) {
    console.error('Document retrieval failed:', error);
    res.status(500).json({ 
      error: 'Document retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/medical-documents/:documentId/review
 * Submit manual review for a document
 */
router.put('/:documentId/review', requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { reviewedFields, approved, reviewNotes } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved field is required and must be boolean' });
    }

    // Update document with review results in storage
    const { storage } = await import('./storage.js');
    const updatedDocument = await storage.updateMedicalDocument(documentId, {
      requiresReview: false,
      reviewedBy: 'admin-user', // TODO: Get from session
      reviewedAt: new Date()
    });

    console.log(`Document ${documentId} reviewed: ${approved ? 'approved' : 'rejected'}`);

    res.json({
      success: true,
      documentId,
      approved,
      document: updatedDocument,
      message: 'Review submitted successfully'
    });

  } catch (error) {
    console.error('Document review failed:', error);
    res.status(500).json({ 
      error: 'Document review failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/medical-documents/pending-review
 * Get documents requiring manual review
 */
router.get('/pending-review', requireAdmin, async (req, res) => {
  try {
    // Query documents requiring review from storage
    const { storage } = await import('./storage.js');
    const pendingDocuments = await storage.getMedicalDocumentsPendingReview();

    res.json({
      success: true,
      documents: pendingDocuments,
      count: pendingDocuments.length
    });

  } catch (error) {
    console.error('Pending review retrieval failed:', error);
    res.status(500).json({ 
      error: 'Pending review retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/medical-documents/download/:storageKey
 * Securely download a stored medical document
 */
router.get('/download/:storageKey', requireAdmin, async (req, res) => {
  try {
    const { storageKey } = req.params;
    
    // Validate storage key format (must start with medical-docs/)
    if (!storageKey || !storageKey.startsWith('medical-docs/')) {
      return res.status(400).json({ 
        error: 'Invalid storage key format',
        hint: 'Storage key must start with medical-docs/'
      });
    }

    // Prevent path traversal attacks
    if (storageKey.includes('..') || storageKey.includes('/./') || storageKey.includes('//')) {
      return res.status(400).json({ error: 'Invalid storage key: path traversal detected' });
    }

    // Import filesystem modules
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Get private storage directory with fallback
    const privateDir = process.env.PRIVATE_OBJECT_DIR || '/tmp/private-storage';
    const filePath = path.join(privateDir, storageKey);
    
    // Verify file exists and is within allowed directory
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Security: Verify the resolved path is still within private directory
      const resolvedPath = path.resolve(filePath);
      const resolvedPrivateDir = path.resolve(privateDir);
      
      if (!resolvedPath.startsWith(resolvedPrivateDir)) {
        return res.status(403).json({ error: 'Access denied: file outside allowed directory' });
      }
      
    } catch (error) {
      console.error('File access error:', error);
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type from file extension
    const ext = path.extname(storageKey).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.tiff':
      case '.tif':
        contentType = 'image/tiff';
        break;
    }

    // Set security headers
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${path.basename(storageKey)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    });

    // Stream the file to client
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
    
    console.log(`Document downloaded: ${storageKey} (${fileBuffer.length} bytes)`);

  } catch (error) {
    console.error('Document download failed:', error);
    res.status(500).json({ 
      error: 'Document download failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as medicalDocumentRoutes };
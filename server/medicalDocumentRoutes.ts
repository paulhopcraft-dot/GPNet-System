import { Router } from 'express';
import { freshdeskWebhookService, type FreshdeskWebhookEvent } from './freshdeskWebhookService.js';
import { documentProcessingService } from './documentProcessingService.js';
import { ocrService } from './ocrService.js';
import { requireAdmin } from './adminRoutes.js';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

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
 * POST /api/medical-documents/freshdesk-webhook
 * Process incoming Freshdesk webhooks for medical document attachments
 */
router.post('/freshdesk-webhook', async (req, res) => {
  try {
    console.log('Received Freshdesk webhook for medical document processing');

    // Validate webhook signature (in production)
    const signature = req.headers['x-freshdesk-webhook-signature'] as string;
    const webhookSecret = process.env.FRESHDESK_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const { FreshdeskWebhookService } = await import('./freshdeskWebhookService.js');
      const isValid = FreshdeskWebhookService.validateWebhookSignature(
        JSON.stringify(req.body),
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
    const validationResult = webhookEventSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      console.error('Invalid webhook payload:', errorMessage);
      return res.status(400).json({ error: 'Invalid webhook payload', details: errorMessage });
    }

    const event: FreshdeskWebhookEvent = validationResult.data;

    // Process the webhook
    await freshdeskWebhookService.processWebhook(event);

    res.json({ 
      success: true, 
      message: 'Webhook processed successfully',
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

    // This would query the medical documents table
    // For now, return placeholder data
    const documents = []; 

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

    // This would update the document with review results
    console.log(`Document ${documentId} reviewed: ${approved ? 'approved' : 'rejected'}`);

    res.json({
      success: true,
      documentId,
      approved,
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
    // This would query documents where requiresReview = true
    const pendingDocuments = [];

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

export { router as medicalDocumentRoutes };
import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Extend Express Request to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
      rawBodyBuffer?: Buffer;
    }
  }
}

// Validate webhook secret is configured for production
if (process.env.NODE_ENV !== 'development' && !process.env.JOTFORM_WEBHOOK_SECRET) {
  throw new Error('JOTFORM_WEBHOOK_SECRET environment variable is required in production');
}

// Security configuration for webhooks
const WEBHOOK_CONFIG = {
  // Shared secret for webhook authentication (required in production)
  SHARED_SECRET: process.env.JOTFORM_WEBHOOK_SECRET || 
    (process.env.NODE_ENV === 'development' ? "dev-webhook-secret-2025" : (() => {
      throw new Error('JOTFORM_WEBHOOK_SECRET is required');
    })()),
  
  // Rate limiting - max requests per minute per IP
  RATE_LIMIT: 30,
  
  // Request timeout in milliseconds
  TIMEOUT_MS: 30000,
  
  // Maximum payload size in bytes (1MB)
  MAX_PAYLOAD_SIZE: 1024 * 1024,
} as const;

// Import database for persistent storage
import { db } from "./db";
import { webhookRateLimits, webhookIdempotency } from "../shared/schema";
import { eq, and, lt, gte, sql } from "drizzle-orm";

/**
 * Simple payload size check middleware for webhook routes
 */
export function setupWebhookSecurity(app: any) {
  // Add payload size limits for webhook routes
  app.use('/api/webhook/*', (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE) {
      return res.status(413).json({
        error: "Payload too large",
        message: `Maximum payload size is ${WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE} bytes`
      });
    }
    next();
  });
}

// Legacy middleware function (not used anymore)
export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction) {
  next();
}

/**
 * Validates webhook signature using HMAC-SHA256 against raw body
 */
function validateWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!signature || !rawBody) {
    return false;
  }

  // Remove 'sha256=' prefix if present (Jotform format)
  const cleanSignature = signature.replace(/^sha256=/, '');
  
  // Calculate expected signature using raw bytes
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Database-backed rate limiting middleware with automatic cleanup
 */
async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Get real client IP, handling proxy headers
    const clientIp = req.headers['x-forwarded-for'] as string 
      || req.headers['x-real-ip'] as string
      || req.connection.remoteAddress 
      || req.ip 
      || 'unknown';
      
    // If multiple IPs in X-Forwarded-For, use the first (original client)
    const realIp = typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : clientIp;
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60000); // 1 minute window
    const expiresAt = new Date(now.getTime() + 3600000); // Expire in 1 hour
    
    // Clean up expired entries (run cleanup occasionally)
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      await db.delete(webhookRateLimits)
        .where(lt(webhookRateLimits.expiresAt, now));
    }
    
    // Check existing rate limit entries for this IP within the current window
    const recentRequests = await db.select()
      .from(webhookRateLimits)
      .where(and(
        eq(webhookRateLimits.ipAddress, realIp),
        gte(webhookRateLimits.windowStart, windowStart)
      ));
    
    const requestCount = recentRequests.reduce((sum, entry) => sum + entry.requestCount, 0);
    
    if (requestCount >= WEBHOOK_CONFIG.RATE_LIMIT) {
      console.warn(`Rate limit exceeded for IP: ${realIp} (${requestCount} requests)`);
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests, please try again later"
      });
    }
    
    // Record this request
    await db.insert(webhookRateLimits)
      .values({
        ipAddress: realIp,
        requestCount: 1,
        windowStart: now,
        expiresAt: expiresAt
      });
    
    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // In case of database error, allow request to proceed (fail open)
    next();
  }
}

/**
 * Database-backed idempotency middleware to prevent duplicate submissions
 */
async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract submission ID from Jotform payload
    const submissionId = extractSubmissionId(req.body);
    
    if (!submissionId) {
      // No submission ID available - skip idempotency check but log warning
      console.warn('No submission ID found in payload - skipping idempotency check');
      return next();
    }
    
    const endpoint = req.path;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 3600000); // Expire in 24 hours
    const clientIp = req.headers['x-forwarded-for'] as string 
      || req.headers['x-real-ip'] as string
      || req.ip || 'unknown';
    const realIp = typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : clientIp;
    const userAgent = req.headers['user-agent'] as string;
    
    // Clean up expired entries occasionally
    if (Math.random() < 0.05) { // 5% chance to run cleanup
      await db.delete(webhookIdempotency)
        .where(lt(webhookIdempotency.expiresAt, now));
    }
    
    // Single INSERT with conflict detection to prevent race conditions
    // If the insert conflicts (duplicate), no row is returned, indicating it was already processed
    const insertResult = await db
      .insert(webhookIdempotency)
      .values({
        submissionId,
        endpoint,
        expiresAt,
        ipAddress: realIp,
        userAgent
      })
      .onConflictDoNothing({
        target: [webhookIdempotency.submissionId, webhookIdempotency.endpoint]
      })
      .returning({ id: webhookIdempotency.id });

    // If no row was returned, it means this submission already existed (conflict)
    if (insertResult.length === 0) {
      console.warn(`Duplicate submission detected: ${submissionId} for ${endpoint}`);
      return res.status(409).json({
        error: "Duplicate submission",
        message: `Submission ${submissionId} has already been processed`,
        submissionId
      });
    }
    
    console.log(`Idempotency record created for ${submissionId} on ${endpoint}`);
    
    next();
  } catch (error) {
    console.error('Idempotency check error:', error);
    // In case of database error, allow request to proceed (fail open)
    next();
  }
}

/**
 * Extract submission ID from Jotform payload
 */
function extractSubmissionId(body: any): string | null {
  if (!body || typeof body !== 'object') return null;
  
  // Try different field names that Jotform might use
  const possibleFields = [
    'submissionID',
    'submission_id', 
    'submissionId',
    'formSubmissionId',
    'form_submission_id',
    'id',
    'submission',
    'submissionData.id'
  ];
  
  for (const field of possibleFields) {
    if (field.includes('.')) {
      // Handle nested fields like submissionData.id
      const parts = field.split('.');
      let value = body;
      for (const part of parts) {
        value = value?.[part];
      }
      if (value) return String(value);
    } else {
      if (body[field]) return String(body[field]);
    }
  }
  
  // Fallback: create deterministic ID from form data
  const formFields = ['firstName', 'lastName', 'email', 'signature', 'signatureDate'];
  const identifyingData = formFields
    .map(field => body[field] || body[field.toLowerCase()] || '')
    .filter(val => val)
    .join('|');
    
  if (identifyingData) {
    return crypto.createHash('md5').update(identifyingData).digest('hex');
  }
  
  return null;
}

/**
 * Main webhook security middleware - now handles async operations
 */
export async function webhookSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Apply rate limiting (async)
    await new Promise<void>((resolve, reject) => {
      rateLimitMiddleware(req, res, (error?: any) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Apply idempotency check (async)
    await new Promise<void>((resolve, reject) => {
      idempotencyMiddleware(req, res, (error?: any) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Skip signature validation in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Webhook security: Development mode - skipping signature validation');
      return next();
    }
    
    // Production mode - validate webhook signature
    const signature = req.headers['x-jotform-signature'] as string || req.headers['jotform-signature'] as string;
    
    if (!signature) {
      console.log('Webhook security: Missing signature header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Webhook signature required'
      });
    }
    
    if (!req.rawBodyBuffer) {
      console.log('Webhook security: Missing raw body for signature verification');
      return res.status(400).json({
        error: 'Bad Request', 
        message: 'Request body required for signature verification'
      });
    }
    
    // Validate signature using raw body
    const isValidSignature = validateWebhookSignature(
      req.rawBodyBuffer,
      signature,
      WEBHOOK_CONFIG.SHARED_SECRET
    );
    
    if (!isValidSignature) {
      console.log('Webhook security: Invalid signature');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    }
    
    console.log('Webhook security: Signature validation passed');
    next();
  } catch (error) {
    console.error('Webhook security middleware error:', error);
    // In case of error, fail open in development, fail closed in production
    if (process.env.NODE_ENV === 'development') {
      console.warn('Development mode: allowing request despite security error');
      next();
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Security validation failed'
      });
    }
  }
}

/**
 * Get webhook security configuration for external use
 */
export function getWebhookConfig() {
  return {
    SHARED_SECRET: WEBHOOK_CONFIG.SHARED_SECRET,
    RATE_LIMIT: WEBHOOK_CONFIG.RATE_LIMIT,
    TIMEOUT_MS: WEBHOOK_CONFIG.TIMEOUT_MS,
    MAX_PAYLOAD_SIZE: WEBHOOK_CONFIG.MAX_PAYLOAD_SIZE,
  };
}

/**
 * Generate webhook signature for testing
 */
export function generateWebhookSignature(payload: string, secret?: string): string {
  const webhookSecret = secret || WEBHOOK_CONFIG.SHARED_SECRET;
  return 'sha256=' + crypto
    .createHmac('sha256', webhookSecret)
    .update(payload, 'utf8')
    .digest('hex');
}
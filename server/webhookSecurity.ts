import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
      rawBodyBuffer?: Buffer;
      webhookMapping?: any;
    }
  }
}

import { db } from "./db";
import { webhookRateLimits, webhookIdempotency } from "../shared/schema";
import { eq, and, lt, gte, sql } from "drizzle-orm";

const WEBHOOK_CONFIG = {
  RATE_LIMIT: 30,
  TIMEOUT_MS: 30000,
  MAX_PAYLOAD_SIZE: 1024 * 1024,
} as const;

export function setupWebhookSecurity(app: any) {
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

async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const clientIp = req.headers['x-forwarded-for'] as string 
      || req.headers['x-real-ip'] as string
      || req.connection.remoteAddress 
      || req.ip 
      || 'unknown';

    const realIp = typeof clientIp === 'string' ? 
      clientIp.split(',')[0].trim() : clientIp;

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const expiresAt = new Date(now.getTime() + 60000); // 1 minute from now

    await db.delete(webhookRateLimits)
      .where(lt(webhookRateLimits.expiresAt, now));

    const recentRequests = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookRateLimits)
      .where(and(
        eq(webhookRateLimits.ipAddress, realIp),
        gte(webhookRateLimits.windowStart, oneMinuteAgo)
      ));

    const requestCount = Number(recentRequests[0]?.count || 0);

    if (requestCount >= WEBHOOK_CONFIG.RATE_LIMIT) {
      console.warn(`Rate limit exceeded for IP: ${realIp}`);
      return res.status(429).json({
        error: "Too many requests",
        message: `Rate limit of ${WEBHOOK_CONFIG.RATE_LIMIT} requests per minute exceeded`
      });
    }

    await db.insert(webhookRateLimits).values({
      ipAddress: realIp,
      windowStart: now,
      expiresAt: expiresAt,
    });

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    if (!res.headersSent) {
      res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Security validation failed'
      });
    }
  }
}

// Disabled - webhookFormMappings table doesn't exist yet
// TODO: Re-enable when webhookFormMappings table is created in schema
async function verifyWebhookPassword(req: Request, res: Response, next: NextFunction) {
  console.log('⚠️  Webhook password verification disabled - webhookFormMappings table not implemented');
  next();
  // Original code commented out until table is added to schema:
  /*
  try {
    const formId = req.body?.formID || req.body?.form_id;

    if (!formId) {
      console.error('Webhook missing form ID');
      return res.status(400).json({ error: 'Missing form ID in webhook payload' });
    }

    const providedPassword = (req.query.webhook_password as string) || req.headers['x-webhook-password'] as string;

    if (!providedPassword) {
      console.error(`Webhook password missing for form: ${formId}`);
      return res.status(401).json({ error: 'Webhook password required' });
    }

    const [mapping] = await db
      .select()
      .from(webhookFormMappings)
      .where(and(
        eq(webhookFormMappings.formId, formId),
        eq(webhookFormMappings.isActive, true)
      ))
      .limit(1);

    if (!mapping) {
      console.error(`Unknown or inactive form ID: ${formId}`);
      return res.status(404).json({ error: 'Unknown form - webhook not configured' });
    }

    if (providedPassword !== mapping.webhookPassword) {
      console.error(`Invalid webhook password for form: ${formId}`);
      return res.status(401).json({ error: 'Invalid webhook password' });
    }

    req.webhookMapping = mapping;

    console.log(`✅ Webhook authenticated: form ${formId} → org ${mapping.organizationId}`);
    next();
  } catch (error) {
    console.error('Webhook password verification error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Security validation failed' });
    }
  }
  */
}

async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const submissionId = extractIdempotencyKey(req.body);

    if (!submissionId) {
      console.log('No submission ID - allowing request');
      return next();
    }

    const endpoint = req.path || req.url;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const [existing] = await db
      .select()
      .from(webhookIdempotency)
      .where(and(
        eq(webhookIdempotency.submissionId, submissionId),
        eq(webhookIdempotency.endpoint, endpoint)
      ))
      .limit(1);

    if (existing) {
      console.log(`Duplicate webhook detected: ${submissionId} for ${endpoint}`);
      return res.status(200).json({
        success: true,
        message: 'Duplicate request - already processed',
        submissionId
      });
    }

    await db.insert(webhookIdempotency).values({
      submissionId,
      endpoint,
      processedAt: now,
      expiresAt: expiresAt,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || null,
    });

    console.log(`New submission recorded: ${submissionId} for ${endpoint}`);
    next();
  } catch (error) {
    console.error('Idempotency check error:', error);
    if (!res.headersSent) {
      res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Security validation failed'
      });
    }
  }
}

function extractIdempotencyKey(body: any): string | null {
  if (!body) return null;

  const submissionFields = ['submissionID', 'submission_id', 'id', 'submissionData.id'];

  for (const field of submissionFields) {
    if (field.includes('.')) {
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

  const formFields = ['firstName', 'lastName', 'email', 'phone', 'formID'];
  const identifyingData = formFields
    .map(field => body[field] || '')
    .filter(val => val)
    .join('|');

  if (identifyingData) {
    return crypto.createHash('sha256').update(identifyingData).digest('hex');
  }

  return null;
}

export async function webhookSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    await new Promise<void>((resolve, reject) => {
      rateLimitMiddleware(req, res, (error?: any) => {
        if (error) reject(error);
        else resolve();
      });
      setTimeout(() => {
        if (res.headersSent) resolve();
      }, 0);
    });

    if (res.headersSent) return;

    // TODO: Re-enable password verification when webhookFormMappings table is added
    // await new Promise<void>((resolve, reject) => {
    //   verifyWebhookPassword(req, res, (error?: any) => {
    //     if (error) reject(error);
    //     else resolve();
    //   });
    //   setTimeout(() => {
    //     if (res.headersSent) resolve();
    //   }, 0);
    // });

    if (res.headersSent) return;

    await new Promise<void>((resolve, reject) => {
      idempotencyMiddleware(req, res, (error?: any) => {
        if (error) reject(error);
        else resolve();
      });
      setTimeout(() => {
        if (res.headersSent) resolve();
      }, 0);
    });

    if (res.headersSent) return;

    console.log('✅ Webhook security: All checks passed');
    next();

  } catch (error) {
    console.error('Webhook security error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Security validation failed'
      });
    }
  }
}

export function generateWebhookPassword(): string {
  return crypto.randomBytes(32).toString('hex');
}
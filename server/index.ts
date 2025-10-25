import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebhookSecurity, webhookSecurityMiddleware } from "./webhookSecurity";

/**
 * Log object storage health status on startup
 */
// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

console.log('✅ Environment variables validated');
async function logObjectStorageHealth() {
  try {
    const configuredDir = process.env.PRIVATE_OBJECT_DIR;
    let mode: 'persistent' | 'temp' = 'temp';
    let root = '/tmp/private-storage';
    
    if (configuredDir) {
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(configuredDir);
        if (stats.isDirectory()) {
          root = configuredDir;
          mode = 'persistent';
        }
      } catch (error) {
        // Directory doesn't exist or isn't accessible - use temp fallback
      }
    }
    
    console.log(`Object storage root: ${root} (mode: ${mode})`);
  } catch (error) {
    console.warn('Object storage health check failed:', error);
  }
}

const app = express();

// Trust proxy for proper headers (needed for mobile Safari)
app.set('trust proxy', 1);

// Configure CORS for mobile Safari compatibility with security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || false
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['set-cookie'],
  maxAge: 86400,
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    // Very high limit for authenticated users (5000 requests per 15 min) - needed for ML predictions
    // Lower limit for anonymous users (100 requests per 15 min)
    return req.session?.user ? 5000 : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
  keyGenerator: (req) => {
    return req.session?.user?.id?.toString() || 'anonymous';
  },
  skip: (req) => req.path.startsWith('/api/webhook'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Increased to allow more login attempts during testing
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.body?.email || 'anonymous';
  },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

console.log('✅ Security: Helmet, CORS, Rate Limiting enabled');

// Handle webhook raw body BEFORE global JSON parser
app.use('/api/medical-documents/freshdesk-webhook', express.raw({
  type: 'application/json',
  limit: '1mb',
  verify: (req: any, _res, buf: Buffer) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Handle Jotform webhook body parsing with raw body capture for signature verification
app.use('/api/webhook/*', express.json({
  limit: '1mb',
  verify: (req: any, _res, buf: Buffer) => {
    // Store raw buffer for signature verification while still allowing JSON parsing
    req.rawBodyBuffer = buf;
    req.rawBody = buf.toString('utf8');
  }
}));

// Setup webhook security (payload size limits)
setupWebhookSecurity(app);

// Mount webhook security middleware on all webhook routes BEFORE other middleware
app.use('/api/webhook', webhookSecurityMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// --- GPNet2 API Endpoint ---
// Simple endpoint for the GPNet2 dashboard

import { Request, Response } from "express";

app.get("/api/cases", async (req: Request, res: Response): Promise<void> => {
  try {
    const cases = [
      {
        workerName: "John Smith",
        company: "Symmetry",
        riskLevel: "High",
        workStatus: "At work",
        latestCert: "certificate.pdf",
        compliance: "Very High",
        summary: "Worker presented with lower back pain after lifting incident...",
        nextStep: "Schedule follow-up",
        owner: "Dr. Evans",
        dueDate: "2024-08-15",
      },
    ];
    res.status(200).json(cases);
  } catch (err) {
    console.error("Error fetching cases:", err);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});
// === Update Case Record (Next Step / Owner / Due) ===
app.put('/api/cases/:workerName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { workerName } = req.params;
    const { nextStep, owner, dueDate } = req.body;

    // Example update – replace with your DB logic later
    console.log(`Updating case for ${workerName}`, { nextStep, owner, dueDate });

    // TODO: if using Mongo, something like:
    // await db.collection('cases').updateOne(
    //   { workerName },
    //   { $set: { nextStep, owner, dueDate } }
    // );

    res.status(200).json({ success: true, message: 'Case updated successfully' });
  } catch (err) {
    console.error('Error updating case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Express error handler:', err);
    res.status(status).json({ message });
  });

  // Add API route protection middleware before static serving
  app.use('/api/*', (req, res, next) => {
    // Mark that this is an API route
    res.locals.isApiRoute = true;
    next();
  });

  // Catch unhandled API routes and return 404 instead of serving static files
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  // Object storage health check
  await logObjectStorageHealth();

  const port = parseInt(process.env.PORT || '5000', 10);
  let retryCount = 0;
  const MAX_RETRIES = 5;
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      retryCount++;
      if (retryCount > MAX_RETRIES) {
        console.error(`❌ Port ${port} still in use after ${MAX_RETRIES} retries. Exiting...`);
        process.exit(1);
      }
      console.error(`⚠️  Port ${port} is already in use. Retry ${retryCount}/${MAX_RETRIES} in 2 seconds...`);
      setTimeout(() => {
        server.close();
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        });
      }, 2000);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

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
// Disable CSP in development to allow Vite dev server to work properly
app.use(helmet({
  contentSecurityPolicy: app.get('env') === 'development' ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
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
app.get("/api/gpnet2/cases", async (req: Request, res: Response): Promise<void> => {
  try {
    const cases = [
      {
        id: "1",
        workerName: "John Smith",
        company: "Symmetry",
        riskLevel: "High",
        workStatus: "At work",
        hasCertificate: true,
        certificateUrl: "#",
        complianceIndicator: "Very High",
        currentStatus: "Initial assessment completed",
        nextStep: "Schedule follow-up",
        owner: "Dr. Evans",
        dueDate: "2024-08-15",
        summary: "Worker presented with lower back pain following lifting incident on 2024-07-28. Initial assessment indicates possible disc herniation. Currently on light duties with 10kg lifting restriction. Requires specialist referral and ongoing monitoring. Worker is cooperative and motivated to return to full duties.",
        attachments: [
          { id: "1", name: "certificate.pdf", type: "Medical Certificate", url: "#" },
          { id: "2", name: "diagnosis.docx", type: "Diagnostic Report", url: "#" }
        ],
        clcLastFollowUp: "2024-08-01",
        clcNextFollowUp: "2024-08-15"
      },
      {
        id: "2",
        workerName: "Jane Doe",
        company: "Allied Health",
        riskLevel: "Medium",
        workStatus: "Off work",
        hasCertificate: false,
        complianceIndicator: "High",
        currentStatus: "Awaiting specialist report",
        nextStep: "Review report",
        owner: "Dr. Smith",
        dueDate: "2024-08-20",
        summary: "Worker experiencing severe shoulder pain after workplace fall. Currently unable to perform duties. Awaiting MRI results and specialist consultation. Expected recovery timeline: 4-6 weeks.",
        attachments: [
          { id: "3", name: "incident_report.pdf", type: "Incident Report", url: "#" }
        ],
        clcLastFollowUp: "2024-08-05",
        clcNextFollowUp: "2024-08-20"
      },
      {
        id: "3",
        workerName: "Peter Jones",
        company: "Apex Labour",
        riskLevel: "Low",
        workStatus: "At work",
        hasCertificate: true,
        certificateUrl: "#",
        complianceIndicator: "Medium",
        currentStatus: "Monitoring symptoms",
        nextStep: "Check-in call",
        owner: "Nurse Joy",
        dueDate: "2024-08-18",
        summary: "Minor wrist strain from repetitive tasks. Worker has been provided with ergonomic equipment and modified duties. Regular monitoring in place. Good progress expected.",
        attachments: [
          { id: "4", name: "ergonomic_assessment.pdf", type: "Assessment Report", url: "#" }
        ],
        clcLastFollowUp: "2024-08-03",
        clcNextFollowUp: "2024-08-18"
      },
      {
        id: "4",
        workerName: "Mary Williams",
        company: "SafeWorks",
        riskLevel: "High",
        workStatus: "Off work",
        hasCertificate: true,
        certificateUrl: "#",
        complianceIndicator: "Low",
        currentStatus: "Rehabilitation plan in progress",
        nextStep: "Update plan",
        owner: "Dr. Williams",
        dueDate: "2024-08-22",
        summary: "Post-surgical recovery following knee operation. Active rehabilitation program underway. Worker showing good compliance with treatment plan. Gradual return to work planned over 8-week period.",
        clcLastFollowUp: "2024-08-07",
        clcNextFollowUp: "2024-08-22"
      },
      {
        id: "5",
        workerName: "David Brown",
        company: "Core Industrial",
        riskLevel: "Medium",
        workStatus: "At work",
        hasCertificate: false,
        complianceIndicator: "Very Low",
        currentStatus: "Fit for full duties",
        nextStep: "Close case",
        owner: "Admin",
        dueDate: "2024-08-25",
        summary: "Successfully completed return to work program. All restrictions lifted. Worker performing full duties without issue. Case ready for closure pending final documentation.",
        clcLastFollowUp: "2024-08-10",
        clcNextFollowUp: "2024-08-25"
      },
      {
        id: "6",
        workerName: "Sarah Wilson",
        company: "Symmetry",
        riskLevel: "Low",
        workStatus: "At work",
        hasCertificate: true,
        certificateUrl: "#",
        complianceIndicator: "High",
        currentStatus: "Ergonomic assessment scheduled",
        nextStep: "Conduct assessment",
        owner: "OHS",
        dueDate: "2024-08-17",
        summary: "Preventative case following worker request for workstation assessment. No current injury. Proactive approach to prevent future issues. Assessment scheduled with OHS team.",
        attachments: [
          { id: "5", name: "workstation_photo.jpg", type: "Photo Documentation", url: "#" }
        ],
        clcLastFollowUp: "2024-08-02",
        clcNextFollowUp: "2024-08-17"
      },
      {
        id: "7",
        workerName: "Michael Taylor",
        company: "Allied Health",
        riskLevel: "High",
        workStatus: "Off work",
        hasCertificate: true,
        certificateUrl: "#",
        complianceIndicator: "Medium",
        currentStatus: "Awaiting surgery",
        nextStep: "Post-op review",
        owner: "Dr. Taylor",
        dueDate: "2024-09-01",
        summary: "Herniated disc requiring surgical intervention. Surgery scheduled for 2024-08-28. Pre-operative clearance obtained. Post-operative recovery plan in development with treating specialist.",
        attachments: [
          { id: "6", name: "mri_results.pdf", type: "Diagnostic Imaging", url: "#" },
          { id: "7", name: "surgical_plan.pdf", type: "Treatment Plan", url: "#" }
        ],
        clcLastFollowUp: "2024-08-08",
        clcNextFollowUp: "2024-09-01"
      },
      {
        id: "8",
        workerName: "Emily Davis",
        company: "Apex Labour",
        riskLevel: "Medium",
        workStatus: "At work",
        hasCertificate: false,
        complianceIndicator: "High",
        currentStatus: "Return to work plan active",
        nextStep: "Progress review",
        owner: "Case Manager",
        dueDate: "2024-08-19",
        summary: "Gradual return to work following ankle sprain. Currently at 50% duties with progressive increase planned. Worker responding well to physiotherapy. On track for full duties by end of month.",
        clcLastFollowUp: "2024-08-04",
        clcNextFollowUp: "2024-08-19"
      }
    ];
    res.status(200).json(cases);
  } catch (err) {
    console.error("Error fetching cases:", err);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});
// === Update Case Record (Next Step / Owner / Due) ===
app.put('/api/gpnet2/cases/:workerName', async (req: Request, res: Response): Promise<void> => {
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

  const port = parseInt(process.env.PORT || "9000");


  let retryCount = 0;
  const MAX_RETRIES = 5;
  
  server.on("error", (error: any) => {
  if (error.code === "EADDRINUSE") {
    console.error(`⚠️ Port ${port} is already in use. Trying a new one...`);
    const newPort = port + 1;
    server.listen(
      {
        port: newPort,
        host: "0.0.0.0",
      },
      () => {
        log(`✅ Switched to port ${newPort}`);
      }
    );
  } else {
    console.error("Server error:", error);
    process.exit(1);
  }
});

server.listen(
  {
    port,
    host: "0.0.0.0",
  },
  () => {
    log(`✅ Serving on port ${port}`);
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      console.log(
        `🌐 Preview URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      );
    }
  }
);

})();

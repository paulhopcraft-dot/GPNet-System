import type { Express } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { tickets, workers, cases, analyses, formSubmissions } from "@shared/schema";
import { eq, and, or, desc, like, sql } from "drizzle-orm";

// API Key Authentication Middleware
export function chatgptAuthMiddleware(req: any, res: any, next: any) {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  
  // Check for valid API key
  const validApiKey = process.env.CHATGPT_API_KEY || process.env.GPNET_CHATGPT_KEY;
  
  if (!validApiKey) {
    return res.status(500).json({ 
      error: "API key not configured on server. Please set CHATGPT_API_KEY environment variable." 
    });
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: "Unauthorized. Please provide a valid API key in Authorization header." 
    });
  }
  
  next();
}

export function registerChatGPTRoutes(app: Express) {
  // Apply auth middleware to all ChatGPT routes
  app.use('/api/chatgpt', chatgptAuthMiddleware);

  // Search for workers by name, email, or other criteria
  app.get('/api/chatgpt/workers/search', async (req, res) => {
    try {
      const { query, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const searchTerm = `%${query}%`;
      const results = await db
        .select()
        .from(workers)
        .where(
          or(
            like(workers.firstName, searchTerm),
            like(workers.lastName, searchTerm),
            like(workers.email, searchTerm),
            like(workers.roleApplied, searchTerm)
          )
        )
        .limit(Number(limit));

      res.json({
        success: true,
        count: results.length,
        workers: results.map(w => ({
          id: w.id,
          name: `${w.firstName} ${w.lastName}`,
          email: w.email,
          phone: w.phone,
          role: w.roleApplied,
          dateOfBirth: w.dateOfBirth,
          site: w.site
        }))
      });
    } catch (error) {
      console.error('Worker search error:', error);
      res.status(500).json({ error: "Failed to search workers" });
    }
  });

  // Get worker details by ID
  app.get('/api/chatgpt/workers/:workerId', async (req, res) => {
    try {
      const { workerId } = req.params;
      
      const worker = await db.query.workers.findFirst({
        where: eq(workers.id, workerId),
      });

      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      // Get associated cases
      const workerCases = await db.query.tickets.findMany({
        where: eq(tickets.workerId, workerId),
        orderBy: [desc(tickets.createdAt)],
        limit: 10
      });

      res.json({
        success: true,
        worker: {
          id: worker.id,
          name: `${worker.firstName} ${worker.lastName}`,
          email: worker.email,
          phone: worker.phone,
          dateOfBirth: worker.dateOfBirth,
          role: worker.roleApplied,
          site: worker.site,
          company: worker.company,
          manager: worker.managerName
        },
        cases: workerCases.map(c => ({
          id: c.id,
          type: c.caseType,
          status: c.status,
          priority: c.priority,
          createdAt: c.createdAt,
          nextStep: c.nextStep
        }))
      });
    } catch (error) {
      console.error('Worker details error:', error);
      res.status(500).json({ error: "Failed to get worker details" });
    }
  });

  // Search cases
  app.get('/api/chatgpt/cases/search', async (req, res) => {
    try {
      const { status, type, priority, workerId, limit = 20 } = req.query;
      
      let whereConditions: any[] = [];
      
      if (status && typeof status === 'string') {
        whereConditions.push(eq(tickets.status, status));
      }
      if (type && typeof type === 'string') {
        whereConditions.push(eq(tickets.caseType, type));
      }
      if (priority && typeof priority === 'string') {
        whereConditions.push(eq(tickets.priority, priority));
      }
      if (workerId && typeof workerId === 'string') {
        whereConditions.push(eq(tickets.workerId, workerId));
      }

      const query = whereConditions.length > 0 
        ? db.select().from(tickets).where(and(...whereConditions))
        : db.select().from(tickets);

      const results = await query
        .orderBy(desc(tickets.createdAt))
        .limit(Number(limit));

      res.json({
        success: true,
        count: results.length,
        cases: results.map(t => ({
          id: t.id,
          type: t.caseType,
          status: t.status,
          priority: t.priority,
          subject: t.subject,
          companyName: t.companyName,
          workerId: t.workerId,
          nextStep: t.nextStep,
          assignedTo: t.assignedTo,
          createdAt: t.createdAt,
          lastUpdateAt: t.lastUpdateAt
        }))
      });
    } catch (error) {
      console.error('Case search error:', error);
      res.status(500).json({ error: "Failed to search cases" });
    }
  });

  // Get case details with full context
  app.get('/api/chatgpt/cases/:caseId', async (req, res) => {
    try {
      const { caseId } = req.params;
      
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, caseId),
      });

      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Get worker info if available
      let workerInfo = null;
      if (ticket.workerId) {
        workerInfo = await db.query.workers.findFirst({
          where: eq(workers.id, ticket.workerId),
        });
      }

      // Get analysis if available
      const analysis = await db.query.analyses.findFirst({
        where: eq(analyses.ticketId, caseId),
        orderBy: [desc(analyses.createdAt)]
      });

      res.json({
        success: true,
        case: {
          id: ticket.id,
          type: ticket.caseType,
          status: ticket.status,
          priority: ticket.priority,
          subject: ticket.subject,
          companyName: ticket.companyName,
          nextStep: ticket.nextStep,
          lastStep: ticket.lastStep,
          assignedTo: ticket.assignedTo,
          workCover: ticket.workCoverBool,
          createdAt: ticket.createdAt,
          lastUpdateAt: ticket.lastUpdateAt,
          flags: {
            red: ticket.flagRedCount,
            amber: ticket.flagAmberCount,
            green: ticket.flagGreenCount
          }
        },
        worker: workerInfo ? {
          name: `${workerInfo.firstName} ${workerInfo.lastName}`,
          email: workerInfo.email,
          phone: workerInfo.phone,
          role: workerInfo.roleApplied,
          dateOfBirth: workerInfo.dateOfBirth
        } : null,
        analysis: analysis ? {
          fitClassification: analysis.fitClassification,
          ragScore: analysis.ragScore,
          recommendations: analysis.recommendations,
          notes: analysis.notes,
          lastAssessed: analysis.lastAssessedAt
        } : null
      });
    } catch (error) {
      console.error('Case details error:', error);
      res.status(500).json({ error: "Failed to get case details" });
    }
  });

  // Create a new case/ticket
  app.post('/api/chatgpt/cases', async (req, res) => {
    try {
      const { 
        workerId, 
        caseType = 'pre_employment', 
        companyName,
        subject,
        priority = 'medium',
        nextStep 
      } = req.body;

      if (!workerId) {
        return res.status(400).json({ error: "workerId is required" });
      }

      // Verify worker exists
      const worker = await db.query.workers.findFirst({
        where: eq(workers.id, workerId)
      });

      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      const newTicket = await storage.createTicket({
        workerId,
        caseType,
        status: 'NEW',
        priority,
        companyName: companyName || worker.company || 'Unknown',
        subject: subject || `${caseType} - ${worker.firstName} ${worker.lastName}`,
        nextStep: nextStep || 'Initial case review and triage'
      });

      res.json({
        success: true,
        message: "Case created successfully",
        case: {
          id: newTicket.id,
          type: newTicket.caseType,
          status: newTicket.status,
          workerId: newTicket.workerId,
          subject: newTicket.subject,
          nextStep: newTicket.nextStep
        }
      });
    } catch (error) {
      console.error('Create case error:', error);
      res.status(500).json({ error: "Failed to create case" });
    }
  });

  // Update case status
  app.patch('/api/chatgpt/cases/:caseId/status', async (req, res) => {
    try {
      const { caseId } = req.params;
      const { status, nextStep } = req.body;

      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }

      const validStatuses = ['NEW', 'ANALYSING', 'AWAITING_REVIEW', 'READY_TO_SEND', 'COMPLETE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status. Must be one of: " + validStatuses.join(', ') 
        });
      }

      // Update status
      await storage.updateTicketStatus(caseId, status);
      
      // Update next step if provided
      if (nextStep) {
        await db.update(tickets)
          .set({ nextStep, updatedAt: new Date() })
          .where(eq(tickets.id, caseId));
      }

      const updatedTicket = await db.query.tickets.findFirst({
        where: eq(tickets.id, caseId)
      });

      res.json({
        success: true,
        message: "Case status updated successfully",
        case: {
          id: updatedTicket?.id,
          status: updatedTicket?.status,
          nextStep: updatedTicket?.nextStep
        }
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: "Failed to update case status" });
    }
  });

  // Get dashboard statistics
  app.get('/api/chatgpt/stats', async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      
      res.json({
        success: true,
        stats: {
          totalCases: stats.total,
          newCases: stats.new,
          inProgress: stats.inProgress + stats.awaiting,
          completed: stats.complete,
          flagged: stats.flagged
        }
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // Add note to case
  app.post('/api/chatgpt/cases/:caseId/notes', async (req, res) => {
    try {
      const { caseId } = req.params;
      const { note, author = 'ChatGPT Assistant' } = req.body;

      if (!note) {
        return res.status(400).json({ error: "note is required" });
      }

      // Verify case exists
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, caseId)
      });

      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Add note as an email/message using direct db insert
      const { emails } = await import("@shared/schema");
      await db.insert(emails).values({
        ticketId: caseId,
        subject: `Note from ${author}`,
        body: note,
        source: 'gpnet',
        direction: 'internal',
        senderName: author,
        senderEmail: 'chatgpt@gpnet.system'
      });

      res.json({
        success: true,
        message: "Note added successfully"
      });
    } catch (error) {
      console.error('Add note error:', error);
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  console.log('✅ ChatGPT API routes registered at /api/chatgpt/*');
}

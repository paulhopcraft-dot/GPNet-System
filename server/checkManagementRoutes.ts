import express from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from './storage.js';
import { insertCheckSchema, insertCompanyAliasSchema } from '@shared/schema';
import { requireAdmin } from './adminRoutes.js';

const router = express.Router();

// ===============================================
// CHECK MANAGEMENT CRUD ENDPOINTS
// ===============================================

/**
 * GET /api/check-management/checks - Get all health checks
 */
router.get('/checks', requireAdmin, async (req, res) => {
  try {
    const checks = await storage.getChecks();
    res.json({
      success: true,
      data: checks
    });
  } catch (error) {
    console.error('Failed to get checks:', error);
    res.status(500).json({
      error: 'Failed to retrieve checks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/check-management/checks/active - Get active health checks
 */
router.get('/checks/active', requireAdmin, async (req, res) => {
  try {
    const checks = await storage.getActiveChecks();
    res.json({
      success: true,
      data: checks
    });
  } catch (error) {
    console.error('Failed to get active checks:', error);
    res.status(500).json({
      error: 'Failed to retrieve active checks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/check-management/checks - Create new health check
 */
router.post('/checks', requireAdmin, async (req, res) => {
  try {
    // Validate request body
    const validationResult = insertCheckSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid check data',
        details: errorMessage
      });
    }

    const checkData = validationResult.data;
    
    // Add audit trail
    if (req.session?.user?.id) {
      checkData.createdBy = req.session.user.id;
    }

    const check = await storage.createCheck(checkData);
    
    res.status(201).json({
      success: true,
      message: 'Check created successfully',
      data: check
    });
  } catch (error) {
    console.error('Failed to create check:', error);
    res.status(500).json({
      error: 'Failed to create check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/check-management/checks/:id - Update health check
 */
router.put('/checks/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validationResult = insertCheckSchema.partial().safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid check data',
        details: errorMessage
      });
    }

    const updateData = validationResult.data;
    
    // Add audit trail
    if (req.session?.user?.id) {
      updateData.updatedBy = req.session.user.id;
    }

    const check = await storage.updateCheck(id, updateData);
    
    res.json({
      success: true,
      message: 'Check updated successfully',
      data: check
    });
  } catch (error) {
    console.error('Failed to update check:', error);
    res.status(500).json({
      error: 'Failed to update check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/check-management/checks/:id - Delete health check
 */
router.delete('/checks/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await storage.deleteCheck(id);
    
    res.json({
      success: true,
      message: 'Check deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete check:', error);
    res.status(500).json({
      error: 'Failed to delete check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===============================================
// COMPANY ALIASES MANAGEMENT
// ===============================================

/**
 * GET /api/check-management/companies/:companyId/aliases - Get company aliases
 */
router.get('/companies/:companyId/aliases', requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const aliases = await storage.getCompanyAliases(companyId);
    
    res.json({
      success: true,
      data: aliases
    });
  } catch (error) {
    console.error('Failed to get company aliases:', error);
    res.status(500).json({
      error: 'Failed to retrieve company aliases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/check-management/companies/:companyId/aliases - Create company alias
 */
router.post('/companies/:companyId/aliases', requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Validate request body
    const validationResult = insertCompanyAliasSchema.safeParse({
      ...req.body,
      companyId
    });
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid alias data',
        details: errorMessage
      });
    }

    const aliasData = validationResult.data;
    
    // Add audit trail
    if (req.session?.user?.id) {
      aliasData.createdBy = req.session.user.id;
    }

    const alias = await storage.createCompanyAlias(aliasData);
    
    res.status(201).json({
      success: true,
      message: 'Company alias created successfully',
      data: alias
    });
  } catch (error) {
    console.error('Failed to create company alias:', error);
    res.status(500).json({
      error: 'Failed to create company alias',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/check-management/aliases/:id - Delete company alias
 */
router.delete('/aliases/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await storage.deleteCompanyAlias(id);
    
    res.json({
      success: true,
      message: 'Company alias deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete company alias:', error);
    res.status(500).json({
      error: 'Failed to delete company alias',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===============================================
// MANAGER CHECK REQUEST ENDPOINTS
// ===============================================

/**
 * POST /api/check-management/request - Manager initiates a check request
 */
router.post('/request', requireAdmin, async (req, res) => {
  try {
    const requestSchema = z.object({
      workerEmail: z.string().email(),
      workerFirstName: z.string().min(1),
      workerLastName: z.string().min(1),
      checkKey: z.string().min(1),
      requestReason: z.string().optional(),
      urgency: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
      managerEmail: z.string().email(),
      dialogueContext: z.object({}).optional()
    });

    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({
        error: 'Invalid request data',
        details: errorMessage
      });
    }

    const data = validationResult.data;

    // Find or create worker
    let worker = await storage.findWorkerByEmail(data.workerEmail);
    if (!worker) {
      worker = await storage.createWorker({
        firstName: data.workerFirstName,
        lastName: data.workerLastName,
        email: data.workerEmail,
        phone: '',
        dateOfBirth: '',
        roleApplied: 'TBD'
      });
    }

    // Create ticket for this check request
    const ticket = await storage.createTicket({
      workerId: worker.id,
      caseType: 'manager_initiated_check',
      status: 'NEW',
      priority: data.urgency
    });

    // Get the check configuration
    const check = await storage.getCheckByKey(data.checkKey);
    if (!check) {
      return res.status(404).json({
        error: 'Check type not found',
        details: `No check found with key: ${data.checkKey}`
      });
    }

    // Create check request record
    const checkRequest = await storage.createCheckRequest({
      ticketId: ticket.id,
      workerId: worker.id,
      checkId: check.id,
      requestedBy: data.managerEmail, // TODO: Get from session
      requestReason: data.requestReason,
      urgency: data.urgency,
      dialogueContext: data.dialogueContext || {}
    });

    res.status(201).json({
      success: true,
      message: 'Check request initiated successfully',
      data: {
        checkRequest,
        ticket,
        worker,
        check
      }
    });
  } catch (error) {
    console.error('Failed to create check request:', error);
    res.status(500).json({
      error: 'Failed to create check request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as checkManagementRoutes };
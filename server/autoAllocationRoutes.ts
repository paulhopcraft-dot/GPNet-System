import express from 'express';
import { z } from 'zod';
import { autoAllocationService, AllocationRequestSchema } from './autoAllocationService';
import { requireAuth } from './authRoutes';
import { requireAdmin } from './adminRoutes';

const router = express.Router();

/**
 * POST /api/auto-allocation/allocate
 * Automatically assign a ticket to the best available coordinator
 */
router.post('/allocate', requireAuth, async (req, res) => {
  try {
    const allocationRequest = AllocationRequestSchema.parse(req.body);
    
    console.log('Processing auto-allocation request:', {
      ticketId: allocationRequest.ticketId,
      priority: allocationRequest.priority,
      requiredSpecializations: allocationRequest.requiredSpecializations
    });
    
    const result = await autoAllocationService.allocateTicket(allocationRequest);
    
    res.json({
      success: true,
      data: {
        allocation: {
          ticketId: allocationRequest.ticketId,
          coordinatorId: result.coordinatorId,
          coordinatorName: `${result.coordinator.firstName} ${result.coordinator.lastName}`,
          confidence: result.confidence,
          reason: result.assignmentReason,
          workloadBefore: result.workloadBefore,
          workloadAfter: result.workloadAfter,
          estimatedCompletionTime: result.estimatedCompletionTime
        }
      },
      message: `Ticket successfully allocated to ${result.coordinator.firstName} ${result.coordinator.lastName} with ${result.confidence}% confidence`
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid allocation request',
        details: error.errors
      });
    }
    
    console.error('Auto-allocation error:', error);
    res.status(500).json({
      error: 'Failed to auto-allocate ticket',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auto-allocation/detect-conflicts
 * Analyze potential allocation conflicts before assignment
 */
router.post('/detect-conflicts', requireAuth, async (req, res) => {
  try {
    const { ticketId, coordinatorId } = z.object({
      ticketId: z.string(),
      coordinatorId: z.string()
    }).parse(req.body);
    
    console.log('Detecting allocation conflicts:', { ticketId, coordinatorId });
    
    const conflicts = await autoAllocationService.detectAllocationConflicts(ticketId, coordinatorId);
    
    const hasHighSeverityConflicts = conflicts.some(c => c.severity === 'high');
    const hasMediumSeverityConflicts = conflicts.some(c => c.severity === 'medium');
    
    res.json({
      success: true,
      data: {
        ticketId,
        coordinatorId,
        conflicts,
        riskLevel: hasHighSeverityConflicts ? 'high' : 
                  hasMediumSeverityConflicts ? 'medium' : 'low',
        recommendAssignment: !hasHighSeverityConflicts,
        summary: {
          totalConflicts: conflicts.length,
          highSeverity: conflicts.filter(c => c.severity === 'high').length,
          mediumSeverity: conflicts.filter(c => c.severity === 'medium').length,
          lowSeverity: conflicts.filter(c => c.severity === 'low').length
        }
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid conflict detection request',
        details: error.errors
      });
    }
    
    console.error('Conflict detection error:', error);
    res.status(500).json({
      error: 'Failed to detect allocation conflicts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auto-allocation/workloads
 * Get current workload statistics for all coordinators
 */
router.get('/workloads', requireAuth, async (req, res) => {
  try {
    console.log('Retrieving coordinator workloads');
    
    const workloads = await autoAllocationService.getCoordinatorWorkloads();
    
    // Calculate overall statistics
    const totalTickets = workloads.reduce((sum, w) => sum + w.activeTickets, 0);
    const totalCoordinators = workloads.length;
    const averageWorkload = totalCoordinators > 0 ? totalTickets / totalCoordinators : 0;
    
    const availableCoordinators = workloads.filter(w => w.availability === 'available').length;
    const busyCoordinators = workloads.filter(w => w.availability === 'busy').length;
    const unavailableCoordinators = workloads.filter(w => w.availability === 'unavailable').length;
    
    res.json({
      success: true,
      data: {
        workloads: workloads.map(w => ({
          coordinatorId: w.coordinatorId,
          activeTickets: w.activeTickets,
          highPriorityTickets: w.highPriorityTickets,
          averageCompletionTime: w.averageCompletionTime,
          specializations: w.specializations,
          availability: w.availability
        })),
        summary: {
          totalCoordinators,
          totalActiveTickets: totalTickets,
          averageWorkload: Math.round(averageWorkload * 100) / 100,
          availabilityDistribution: {
            available: availableCoordinators,
            busy: busyCoordinators,
            unavailable: unavailableCoordinators
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Workload retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve coordinator workloads',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auto-allocation/rebalance
 * Rebalance workloads by redistributing tickets (Admin only)
 */
router.post('/rebalance', requireAdmin, async (req, res) => {
  try {
    console.log('Starting workload rebalancing');
    
    const result = await autoAllocationService.rebalanceWorkloads();
    
    res.json({
      success: true,
      data: {
        redistributions: result.redistributions,
        balanceImprovement: result.balanceImprovement,
        details: result.details
      },
      message: `Rebalancing complete: ${result.redistributions} tickets redistributed, balance improved by ${result.balanceImprovement}`
    });
    
  } catch (error) {
    console.error('Workload rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to rebalance workloads',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auto-allocation/bulk-allocate
 * Bulk allocate multiple tickets (Admin only)
 */
router.post('/bulk-allocate', requireAdmin, async (req, res) => {
  try {
    const { ticketIds, options } = z.object({
      ticketIds: z.array(z.string()).min(1).max(50), // Max 50 tickets per batch
      options: z.object({
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        requiredSpecializations: z.array(z.string()).optional(),
        maxConcurrent: z.number().min(1).max(10).default(5)
      }).optional()
    }).parse(req.body);
    
    console.log(`Processing bulk allocation for ${ticketIds.length} tickets`);
    
    const results: any[] = [];
    const errors: any[] = [];
    
    // Process tickets in batches to avoid overwhelming the system
    const batchSize = options?.maxConcurrent || 5;
    for (let i = 0; i < ticketIds.length; i += batchSize) {
      const batch = ticketIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (ticketId) => {
        try {
          const allocationRequest = AllocationRequestSchema.parse({
            ticketId,
            ...options
          });
          
          const result = await autoAllocationService.allocateTicket(allocationRequest);
          return {
            ticketId,
            success: true,
            coordinatorId: result.coordinatorId,
            coordinatorName: `${result.coordinator.firstName} ${result.coordinator.lastName}`,
            confidence: result.confidence
          };
        } catch (error) {
          return {
            ticketId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        totalTickets: ticketIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Bulk allocation complete: ${results.length} successful, ${errors.length} failed`
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid bulk allocation request',
        details: error.errors
      });
    }
    
    console.error('Bulk allocation error:', error);
    res.status(500).json({
      error: 'Failed to perform bulk allocation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auto-allocation/stats
 * Get allocation statistics and performance metrics (Admin only)
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    console.log('Retrieving allocation statistics');
    
    // This would be enhanced with actual stats tracking
    // For now, provide basic workload statistics
    const workloads = await autoAllocationService.getCoordinatorWorkloads();
    
    const stats = {
      coordinatorMetrics: {
        totalCoordinators: workloads.length,
        averageWorkload: workloads.length > 0 ? 
          workloads.reduce((sum, w) => sum + w.activeTickets, 0) / workloads.length : 0,
        workloadDistribution: workloads.map(w => ({
          coordinatorId: w.coordinatorId,
          activeTickets: w.activeTickets,
          availability: w.availability
        })),
        specializationCoverage: {
          general: workloads.filter(w => w.specializations.includes('general_coordination')).length,
          health: workloads.filter(w => w.specializations.includes('occupational_health')).length,
          legal: workloads.filter(w => w.specializations.includes('legal_compliance')).length,
          complex: workloads.filter(w => w.specializations.includes('complex_claims')).length
        }
      },
      systemHealth: {
        overloadedCoordinators: workloads.filter(w => w.availability === 'unavailable').length,
        underutilizedCoordinators: workloads.filter(w => w.activeTickets < 5).length,
        balanceScore: workloads.length > 0 ? 
          Math.max(0, 100 - (Math.max(...workloads.map(w => w.activeTickets)) - Math.min(...workloads.map(w => w.activeTickets))) * 5) : 100,
        recommendRebalance: workloads.some(w => w.availability === 'unavailable') && workloads.some(w => w.activeTickets < 5)
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve allocation statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auto-allocation/config
 * Get current allocation configuration (Admin only)
 */
router.get('/config', requireAdmin, async (req, res) => {
  try {
    // Return the actual service configuration
    const config = autoAllocationService.getConfig();
    
    res.json({
      success: true,
      data: { config }
    });
    
  } catch (error) {
    console.error('Config retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve allocation configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/auto-allocation/config
 * Update allocation configuration (Admin only)
 */
router.patch('/config', requireAdmin, async (req, res) => {
  try {
    const configUpdate = z.object({
      maxWorkloadPerCoordinator: z.number().min(1).max(100).optional(),
      priorityWeights: z.object({
        urgent: z.number().min(0).max(200),
        high: z.number().min(0).max(200),
        medium: z.number().min(0).max(200),
        low: z.number().min(0).max(200)
      }).optional(),
      specializationBonus: z.number().min(0).max(100).optional(),
      companyExperienceBonus: z.number().min(0).max(100).optional(),
      workloadBalanceWeight: z.number().min(0).max(1).optional(),
      responseTimeWeight: z.number().min(0).max(1).optional(),
      availabilityThreshold: z.number().min(0).max(100).optional()
    }).parse(req.body);
    
    console.log('Updating allocation configuration:', configUpdate);
    
    const updatedConfig = autoAllocationService.updateConfig(configUpdate);
    
    res.json({
      success: true,
      data: { config: updatedConfig },
      message: 'Allocation configuration updated successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid configuration update',
        details: error.errors
      });
    }
    
    console.error('Config update error:', error);
    res.status(500).json({
      error: 'Failed to update allocation configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as autoAllocationRoutes };
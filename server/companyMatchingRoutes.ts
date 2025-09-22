import express from 'express';
import { z } from 'zod';
import { companyMatchingService, CompanyMatchRequestSchema, CreateAliasRequestSchema } from './companyMatchingService';
import { requireAuth } from './authRoutes';

const router = express.Router();

/**
 * POST /api/company-matching/find-matches
 * Find companies that match a given company name using fuzzy logic
 */
router.post('/find-matches', requireAuth, async (req, res) => {
  try {
    const requestData = CompanyMatchRequestSchema.parse(req.body);
    
    console.log('Company matching request:', {
      companyName: requestData.companyName,
      options: requestData.options
    });
    
    const matches = await companyMatchingService.findMatches(requestData);
    
    res.json({
      success: true,
      data: {
        query: requestData.companyName,
        matches,
        count: matches.length
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Company matching error:', error);
    res.status(500).json({
      error: 'Failed to find company matches',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/company-matching/best-match/:companyName
 * Get the single best match for a company name (convenience endpoint)
 */
router.get('/best-match/:companyName', requireAuth, async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.companyName);
    const minConfidence = req.query.minConfidence ? 
      parseInt(req.query.minConfidence as string) : 80;
    
    if (!companyName || companyName.trim().length === 0) {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }
    
    console.log('Best match request:', { companyName, minConfidence });
    
    const bestMatch = await companyMatchingService.getBestMatch(companyName, minConfidence);
    
    res.json({
      success: true,
      data: {
        query: companyName,
        match: bestMatch,
        hasMatch: !!bestMatch
      }
    });
    
  } catch (error) {
    console.error('Best match error:', error);
    res.status(500).json({
      error: 'Failed to find best match',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/company-matching/auto-match
 * Automatically match a company name and return organization ID if confident enough
 */
router.post('/auto-match', requireAuth, async (req, res) => {
  try {
    const { companyName, minConfidence = 85 } = z.object({
      companyName: z.string().min(1),
      minConfidence: z.number().min(0).max(100).optional()
    }).parse(req.body);
    
    console.log('Auto-match request:', { companyName, minConfidence });
    
    const organizationId = await companyMatchingService.autoMatch(companyName, minConfidence);
    
    res.json({
      success: true,
      data: {
        query: companyName,
        organizationId,
        matched: !!organizationId
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Auto-match error:', error);
    res.status(500).json({
      error: 'Failed to perform auto-match',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/company-matching/aliases
 * Create a new company alias to improve future matching
 */
router.post('/aliases', requireAuth, async (req, res) => {
  try {
    const requestData = CreateAliasRequestSchema.parse(req.body);
    
    console.log('Create alias request:', requestData);
    
    const alias = await companyMatchingService.createAlias(requestData);
    
    res.status(201).json({
      success: true,
      data: alias,
      message: 'Company alias created successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Create alias error:', error);
    res.status(500).json({
      error: 'Failed to create company alias',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/company-matching/suggest-alias
 * Suggest creating an alias after a manual company match
 */
router.post('/suggest-alias', requireAuth, async (req, res) => {
  try {
    const { companyName, organizationId } = z.object({
      companyName: z.string().min(1),
      organizationId: z.string()
    }).parse(req.body);
    
    console.log('Suggest alias request:', { companyName, organizationId });
    
    await companyMatchingService.suggestAlias(companyName, organizationId);
    
    res.json({
      success: true,
      message: 'Alias suggestion processed successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Suggest alias error:', error);
    res.status(500).json({
      error: 'Failed to process alias suggestion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/company-matching/stats
 * Get statistics about company matching performance
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    console.log('Company matching stats requested');
    
    const stats = await companyMatchingService.getMatchingStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: 'Failed to get matching statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/company-matching/test/:companyName
 * Test endpoint to see how company name normalization works
 */
router.get('/test/:companyName', requireAuth, async (req, res) => {
  try {
    const companyName = decodeURIComponent(req.params.companyName);
    
    // Import the normalizer from the service
    const { CompanyNameNormalizer } = await import('./companyMatchingService') as any;
    
    const normalized = CompanyNameNormalizer.normalize(companyName);
    const variations = CompanyNameNormalizer.generateVariations(companyName);
    
    res.json({
      success: true,
      data: {
        original: companyName,
        normalized,
        variations,
        variationCount: variations.length
      }
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      error: 'Failed to test company name normalization',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as companyMatchingRoutes };
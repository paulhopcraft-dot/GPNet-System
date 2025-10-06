import { Router } from 'express';
import { storage } from './storage';
import { requireAuth } from './authRoutes';

const router = Router();

router.get('/trends', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await storage.getTrendAnalytics(days);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching trend analytics:', error);
    res.status(500).json({ error: 'Failed to fetch trend analytics' });
  }
});

router.get('/performance', requireAuth, async (req, res) => {
  try {
    const metrics = await storage.getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

export { router as analyticsRoutes };

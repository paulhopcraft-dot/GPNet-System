import type { Express } from 'express';
import { runRTWFlow } from './rtwWorkflow';

export function registerRTWRoutes(app: Express) {
  // Run RTW gating workflow for a specific case
  app.post('/api/rtw/run', async (req, res) => {
    try {
      const { ticketId } = req.body;

      if (!ticketId) {
        return res.status(400).json({
          error: 'Missing required parameter: ticketId'
        });
      }

      const result = await runRTWFlow(ticketId);

      res.json({
        success: true,
        decision: result.decision,
        audit: result.audit
      });
    } catch (error: any) {
      console.error('RTW workflow error:', error);
      res.status(500).json({
        error: 'RTW workflow failed',
        details: error.message
      });
    }
  });

  // Health check for RTW service
  app.get('/api/rtw/health', (req, res) => {
    res.json({
      ok: true,
      flow: 'RTW_Gating_v1.0',
      status: 'operational'
    });
  });

  console.log('✅ RTW workflow routes registered at /api/rtw/*');
}

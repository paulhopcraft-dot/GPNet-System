/**
 * ML Prediction Routes - Expose ML predictions to frontend
 */
import { Router } from 'express';
import { mlServiceClient } from './mlServiceClient.js';
import { storage } from './storage.js';

const router = Router();

/**
 * GET /api/ml/health
 * Check ML service health status
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await mlServiceClient.checkHealth();
    res.json({
      ml_service: isHealthy ? 'available' : 'unavailable',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ml_service: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/predictions/:ticketId
 * Get all ML predictions for a case
 * (Mock implementation - real ML service integration ready when Python service is available)
 */
router.get('/predictions/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    // Get ticket and related data
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const analysis = await storage.getAnalysisByTicket(ticketId);
    
    // Mock alerts for demonstration (replace with real ML predictions when service is running)
    const alerts = [];
    
    // Trigger escalation alert for high-risk cases (WorkCover claims)
    if (ticket.claimType === 'workcover' && analysis?.ragScore === 'red') {
      alerts.push({
        type: 'escalation',
        severity: 'high',
        message: 'This case shows patterns associated with WorkCover escalation. Consider early intervention.',
        probability: 0.82,
        shap_top: [
          { feature: 'claim_type', label: 'WorkCover Claim', impact: 0.31, direction: 'increase' },
          { feature: 'injury_severity', label: 'High Severity', impact: 0.24, direction: 'increase' },
          { feature: 'days_open', label: 'Days Open', impact: 0.15, direction: 'increase' }
        ]
      });
    }
    
    // Trigger compliance alert for cases with multiple issues
    if (ticket.status === 'AWAITING_REVIEW' && analysis?.ragScore === 'amber') {
      const caseAge = Math.floor((Date.now() - new Date(ticket.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
      if (caseAge > 7) {
        alerts.push({
          type: 'compliance',
          severity: 'high',
          message: 'Worker engagement declining. Recommend proactive outreach to maintain compliance.',
          entitlement_at_risk: true,
          shap_top: [
            { feature: 'response_time', label: 'Slow Response', impact: 0.28, direction: 'increase' },
            { feature: 'days_open', label: 'Case Duration', impact: 0.19, direction: 'increase' }
          ]
        });
      }
    }
    
    res.json({
      ticketId,
      alerts,
      generated_at: new Date().toISOString(),
      note: 'Mock implementation - Python ML service integration ready when available'
    });

  } catch (error) {
    console.error('Error getting ML predictions:', error);
    res.status(500).json({
      error: 'Failed to get predictions',
      details: error instanceof Error ? error.message : 'Unknown error',
      alerts: []
    });
  }
});

/**
 * POST /api/ml/predictions/:ticketId/fraud
 * Check document for fraud
 */
router.post('/predictions/:ticketId/fraud', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { doc_id, ocr_text, doc_hash_repeat, font_anomaly_flag } = req.body;
    
    const prediction = await mlServiceClient.predictFraud({
      case_id: ticketId,
      doc_id,
      ocr_text,
      doc_hash_repeat: doc_hash_repeat || false,
      font_anomaly_flag: font_anomaly_flag || false,
    });
    
    if (!prediction) {
      return res.status(503).json({ error: 'ML service unavailable' });
    }
    
    res.json(prediction);
  } catch (error) {
    console.error('Error predicting fraud:', error);
    res.status(500).json({
      error: 'Failed to predict fraud',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as mlRoutes };

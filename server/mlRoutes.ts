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
    const formSubmission = await storage.getFormSubmissionByTicket(ticketId);
    
    // Build feature data for ML predictions
    const caseAge = Math.floor((Date.now() - new Date(ticket.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
    
    const mlData = {
      case_id: ticketId,
      days_open: caseAge,
      sla_breaches: ticket.slaDueAt && new Date(ticket.slaDueAt) < new Date() ? 1 : 0,
      sentiment_compound: 0, // TODO: Extract from text analysis
      injury_terms_count: ticket.caseType === 'injury' ? 2 : 0,
      prior_escalations: 0,
      
      // Escalation features
      keyword_lawyer: 0,
      keyword_claim: ticket.claimType === 'workcover' ? 1 : 0,
      neg_sentiment_trend_7d: 0,
      diagnostic_delay_flag: false,
      refused_duties_flag: false,
      injury_severity_scale: analysis?.ragScore === 'red' ? 3 : analysis?.ragScore === 'amber' ? 2 : 1,
      imaging_delay_days: 0,
      doctor_changes_count: 0,
      psychosocial_flags_count: 0,
      communication_breakdown_flag: false,
      
      // Compliance features
      missed_appts_7d: 0,
      missed_appts_30d: 0,
      consecutive_missed_appts: 0,
      avg_response_latency_mins: 0,
      checkin_completion_rate: 1.0,
    };
    
    // Get all predictions in parallel
    const predictions = await mlServiceClient.getAllPredictions(mlData);
    
    // Filter to only alert-worthy predictions
    const alerts = [];
    
    // Check escalation risk (UC-13)
    if (predictions.escalation && predictions.escalation.band === 'High Risk') {
      alerts.push({
        type: 'escalation',
        severity: 'high',
        message: predictions.escalation.recommendation,
        probability: predictions.escalation.probabilities?.high_risk || 0,
        shap_top: predictions.escalation.shap_top
      });
    }
    
    // Check compliance issues (UC-12)
    if (predictions.compliance && predictions.compliance.band === 'High Risk') {
      alerts.push({
        type: 'compliance',
        severity: 'high',
        message: predictions.compliance.recommendation,
        entitlement_at_risk: (predictions.compliance as any).entitlement_at_risk,
        shap_top: predictions.compliance.shap_top
      });
    }
    
    // Check priority (UC-1)
    if (predictions.priority && predictions.priority.band === 'red') {
      alerts.push({
        type: 'priority',
        severity: 'high',
        message: predictions.priority.recommendation,
        score: predictions.priority.score,
        shap_top: predictions.priority.shap_top
      });
    }
    
    res.json({
      ticketId,
      alerts,
      all_predictions: predictions,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting ML predictions:', error);
    res.status(500).json({
      error: 'Failed to get predictions',
      details: error instanceof Error ? error.message : 'Unknown error',
      alerts: [] // Return empty alerts on error
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

/**
 * ML Service Client - Connects Node.js backend to Python ML microservice
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

interface MLResponse {
  model_version: string;
  decision?: string;
  band?: string;
  score?: number;
  probabilities?: Record<string, number>;
  recommendation: string;
  shap_top: Array<{
    feature: string;
    label: string;
    impact: number;
    direction: string;
  }>;
}

interface CasePriorityResponse extends MLResponse {}
interface FraudResponse extends MLResponse {
  quarantine: boolean;
}
interface ComplianceResponse extends MLResponse {
  entitlement_at_risk: boolean;
  evidence_log?: string[];
}
interface EscalationResponse extends MLResponse {}

class MLServiceClient {
  private baseUrl: string;
  private isAvailable: boolean = false;

  constructor(baseUrl: string = ML_SERVICE_URL) {
    this.baseUrl = baseUrl;
    this.checkHealth();
  }

  /**
   * Check if ML service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isAvailable = data.status === 'healthy';
        console.log('✅ ML Service health check:', data);
        return true;
      }
      
      this.isAvailable = false;
      return false;
    } catch (error) {
      console.warn('⚠️ ML Service unavailable:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * UC-1: Predict case priority (red/yellow/green)
   */
  async predictCasePriority(data: {
    case_id: string;
    days_open: number;
    sla_breaches?: number;
    sentiment_compound?: number;
    injury_terms_count?: number;
    prior_escalations?: number;
  }): Promise<CasePriorityResponse | null> {
    if (!this.isAvailable) {
      console.warn('ML Service unavailable - skipping case priority prediction');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/ml/score/case-priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.error('Case priority prediction failed:', response.statusText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling case priority endpoint:', error);
      return null;
    }
  }

  /**
   * UC-7: Detect document fraud
   */
  async predictFraud(data: {
    case_id: string;
    doc_id: string;
    ocr_text: string;
    ocr_text_mismatch_rate?: number;
    doc_hash_repeat?: boolean;
    font_anomaly_flag?: boolean;
    provider_abn_match?: boolean;
    doctor_changes_count?: number;
  }): Promise<FraudResponse | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/ml/score/fraud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error calling fraud detection:', error);
      return null;
    }
  }

  /**
   * UC-12: Predict obligation compliance risk
   */
  async predictCompliance(data: {
    case_id: string;
    missed_appts_7d?: number;
    missed_appts_30d?: number;
    consecutive_missed_appts?: number;
    refused_duties_flag?: boolean;
    avg_response_latency_mins?: number;
    checkin_completion_rate?: number;
    communication_breakdown_flag?: boolean;
  }): Promise<ComplianceResponse | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/ml/score/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error calling compliance prediction:', error);
      return null;
    }
  }

  /**
   * UC-13: Predict claim escalation risk (WorkCover likelihood)
   */
  async predictEscalation(data: {
    case_id: string;
    keyword_lawyer?: number;
    keyword_claim?: number;
    neg_sentiment_trend_7d?: number;
    diagnostic_delay_flag?: boolean;
    refused_duties_flag?: boolean;
    injury_severity_scale?: number;
    imaging_delay_days?: number;
    doctor_changes_count?: number;
    psychosocial_flags_count?: number;
    communication_breakdown_flag?: boolean;
  }): Promise<EscalationResponse | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/ml/score/claim-escalation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error calling escalation prediction:', error);
      return null;
    }
  }

  /**
   * Get all predictions for a case (parallel execution)
   */
  async getAllPredictions(caseData: any): Promise<{
    priority?: CasePriorityResponse;
    escalation?: EscalationResponse;
    compliance?: ComplianceResponse;
  }> {
    const [priority, escalation, compliance] = await Promise.all([
      this.predictCasePriority(caseData),
      this.predictEscalation(caseData),
      this.predictCompliance(caseData),
    ]);

    return { priority, escalation, compliance };
  }
}

// Export singleton instance
export const mlServiceClient = new MLServiceClient();
export type { MLResponse, CasePriorityResponse, FraudResponse, ComplianceResponse, EscalationResponse };

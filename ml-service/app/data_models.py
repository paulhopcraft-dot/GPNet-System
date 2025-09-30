"""Pydantic models for request/response schemas"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# Base response model
class MLResponse(BaseModel):
    model_version: str
    decision: Optional[str] = None
    band: Optional[str] = None
    score: Optional[int] = None
    probabilities: Optional[Dict[str, float]] = None
    recommendation: str
    shap_top: List[Dict[str, Any]]


# UC-1: Case Priority
class CasePriorityRequest(BaseModel):
    case_id: str
    latest_message_id: Optional[str] = None
    days_open: int = 0
    sla_breaches: int = 0
    sentiment_compound: float = 0.0
    injury_terms_count: int = 0
    prior_escalations: int = 0


class CasePriorityResponse(MLResponse):
    pass


# UC-2: Check-in Escalation
class CheckinEscalationRequest(BaseModel):
    case_id: str
    checkin_id: str
    pain_delta: float = 0.0
    fatigue_delta: float = 0.0
    sleep_decline_flag: bool = False
    refused_duties_flag: bool = False
    sentiment_compound: float = 0.0


class CheckinEscalationResponse(MLResponse):
    pass


# UC-3: Incident Routing
class IncidentRoutingRequest(BaseModel):
    case_id: str
    text: Optional[str] = None
    incident_logged: bool = False
    injury_register_logged: bool = False
    witness_present: bool = False
    injury_terms_count: int = 0


class IncidentRoutingResponse(MLResponse):
    pass


# UC-4: Document Completeness
class DocCompletenessRequest(BaseModel):
    case_id: str
    has_medical_cert: bool = False
    has_incident_report: bool = False
    has_imaging_referral: bool = False
    cert_late_days: int = 0


class DocCompletenessResponse(MLResponse):
    missing_documents: Optional[List[str]] = None


# UC-5: Email Auto-Send Strategy
class EmailStrategyRequest(BaseModel):
    thread_id: str
    draft_type: str
    text: str
    complaint_keywords_count: int = 0
    prior_human_overrides: int = 0
    sentiment_compound: float = 0.0
    thread_depth: int = 0


class EmailStrategyResponse(MLResponse):
    template_suggestion: Optional[str] = None
    tone_recommendation: Optional[str] = None


# UC-6: Complaint Risk
class ComplaintRiskRequest(BaseModel):
    thread_id: str
    subject: str
    body: str
    sentiment_compound: float = 0.0
    anger_score: float = 0.0
    accusatory_phrase_count: int = 0
    question_density: float = 0.0


class ComplaintRiskResponse(MLResponse):
    pass


# UC-7: Fraud Detection
class FraudDocRequest(BaseModel):
    case_id: str
    doc_id: str
    ocr_text: str
    ocr_text_mismatch_rate: float = 0.0
    doc_hash_repeat: bool = False
    font_anomaly_flag: bool = False
    provider_abn_match: bool = True
    doctor_changes_count: int = 0


class FraudDocResponse(MLResponse):
    quarantine: bool = False


# UC-8: Phishing Detection
class PhishingRequest(BaseModel):
    thread_id: str
    subject: str
    body: str
    sender: str
    urls: List[str] = []
    sender_domain_reputation: float = 1.0
    url_count: int = 0
    url_reputation_min: float = 1.0
    caps_ratio: float = 0.0


class PhishingResponse(MLResponse):
    quarantine: bool = False


# UC-9: Recovery Timeline
class RecoveryTimelineRequest(BaseModel):
    case_id: str
    injury_type_back: bool = False
    injury_type_shoulder: bool = False
    injury_type_knee: bool = False
    injury_type_psychological: bool = False
    injury_severity_scale: int = 1
    worker_age: int = 30
    comorbidities_count: int = 0
    treatment_sessions_total: int = 0
    imaging_delay_days: int = 0
    psychosocial_flags_count: int = 0


class RecoveryTimelineResponse(MLResponse):
    expected_weeks: float
    ci_lower: float
    ci_upper: float
    delayed_recovery_risk: bool = False


# UC-10: Inherent Requirements Non-Fit
class IRNFRequest(BaseModel):
    case_id: str
    restrictions_lift_kg: int = 0
    restrictions_stand_hours: float = 0.0
    cognitive_restrict_flag: bool = False
    role_lift_req_kg: int = 0
    role_stand_req_hours: float = 0.0
    role_cognitive_load: int = 1
    rtw_attempts_count: int = 0
    progress_weeks: int = 0


class IRNFResponse(MLResponse):
    pass


# UC-11: Work-Relatedness
class WorkRelatedRequest(BaseModel):
    case_id: str
    incident_logged: bool = False
    injury_register_logged: bool = False
    witness_present: bool = False
    report_delay_days: int = 0
    preexisting_same_bodypart: bool = False
    gradual_onset_flag: bool = False
    cctv_available: bool = False
    cert_wording_nonoccupational: bool = False


class WorkRelatedResponse(MLResponse):
    pass


# UC-12: Obligation Compliance
class ObligationComplianceRequest(BaseModel):
    case_id: str
    missed_appts_7d: int = 0
    missed_appts_30d: int = 0
    consecutive_missed_appts: int = 0
    refused_duties_flag: bool = False
    avg_response_latency_mins: float = 0.0
    checkin_completion_rate: float = 1.0
    communication_breakdown_flag: bool = False


class ObligationComplianceResponse(MLResponse):
    entitlement_at_risk: bool = False
    evidence_log: Optional[List[str]] = None


# UC-13: Claim Escalation
class ClaimEscalationRequest(BaseModel):
    case_id: str
    keyword_lawyer: int = 0
    keyword_claim: int = 0
    neg_sentiment_trend_7d: float = 0.0
    diagnostic_delay_flag: bool = False
    refused_duties_flag: bool = False
    injury_severity_scale: int = 1
    imaging_delay_days: int = 0
    doctor_changes_count: int = 0
    psychosocial_flags_count: int = 0
    communication_breakdown_flag: bool = False


class ClaimEscalationResponse(MLResponse):
    pass

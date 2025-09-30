"""Deterministic feature extraction pipeline"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List


class FeatureExtractor:
    def __init__(self):
        schema_path = Path(__file__).parent / "feature_schema_v3.json"
        with open(schema_path) as f:
            schema = json.load(f)
        self.features = [f["name"] for f in schema["features"]]
        self.feature_types = {f["name"]: f["type"] for f in schema["features"]}
    
    def extract(self, request_data: Dict[str, Any], uc: str) -> np.ndarray:
        """Extract features from request data for a specific use case"""
        feature_dict = {}
        
        # Initialize all features with defaults
        for feat in self.features:
            if self.feature_types[feat] == "bool":
                feature_dict[feat] = False
            elif self.feature_types[feat] in ["int", "float"]:
                feature_dict[feat] = 0
            else:
                feature_dict[feat] = 0
        
        # Update with provided values
        for key, value in request_data.items():
            if key in feature_dict:
                feature_dict[key] = value
        
        # Convert to ordered array
        feature_array = np.array([feature_dict[f] for f in self.features], dtype=float)
        return feature_array
    
    def get_feature_order(self) -> List[str]:
        """Get the ordered list of feature names"""
        return self.features
    
    def get_feature_labels(self) -> Dict[str, str]:
        """Get human-readable labels for features"""
        labels = {
            "days_open": "Days case open",
            "sla_breaches": "SLA breaches",
            "sentiment_compound": "Overall sentiment",
            "anger_score": "Anger level",
            "fear_score": "Fear level",
            "text_length": "Message length",
            "keyword_doctor": "Doctor mentions",
            "keyword_claim": "Claim mentions",
            "keyword_lawyer": "Lawyer mentions",
            "injury_terms_count": "Injury terms",
            "prior_escalations": "Prior escalations",
            "checkin_completion_rate": "Check-in completion",
            "missed_appts_7d": "Missed appointments (7d)",
            "missed_appts_30d": "Missed appointments (30d)",
            "refused_duties_flag": "Refused suitable duties",
            "cert_late_days": "Certificate delay (days)",
            "incident_logged": "Incident logged",
            "witness_present": "Witness present",
            "report_delay_days": "Report delay (days)",
            "injury_severity_scale": "Injury severity",
            "comorbidities_count": "Comorbidities",
            "treatment_sessions_total": "Treatment sessions",
            "imaging_delay_days": "Imaging delay (days)",
            "doctor_changes_count": "Doctor changes",
            "ocr_text_mismatch_rate": "OCR mismatch rate",
            "doc_hash_repeat": "Duplicate document",
            "font_anomaly_flag": "Font anomaly",
            "provider_abn_match": "Provider ABN match",
            "sender_domain_reputation": "Sender reputation",
            "url_count": "URL count",
            "url_reputation_min": "URL reputation",
            "preexisting_same_bodypart": "Prior same injury",
            "gradual_onset_flag": "Gradual onset",
            "neg_sentiment_trend_7d": "Negative trend (7d)",
            "diagnostic_delay_flag": "Diagnostic delay",
            "pain_delta": "Pain change",
            "fatigue_delta": "Fatigue change",
            "sleep_decline_flag": "Sleep declining",
            "has_medical_cert": "Medical certificate",
            "has_incident_report": "Incident report",
            "has_imaging_referral": "Imaging referral",
            "complaint_keywords_count": "Complaint keywords",
            "prior_human_overrides": "Prior overrides",
            "thread_depth": "Email thread depth",
            "accusatory_phrase_count": "Accusatory phrases",
            "worker_age": "Worker age",
            "psychosocial_flags_count": "Psychosocial flags",
            "rtw_attempts_count": "RTW attempts",
            "progress_weeks": "Recovery weeks",
            "restrictions_lift_kg": "Lifting restriction",
            "restrictions_stand_hours": "Standing restriction",
            "cognitive_restrict_flag": "Cognitive restriction",
            "role_lift_req_kg": "Role lifting requirement",
            "role_stand_req_hours": "Role standing requirement",
            "role_cognitive_load": "Role cognitive load",
            "cctv_available": "CCTV available",
            "cert_wording_nonoccupational": "Non-occupational wording",
            "communication_breakdown_flag": "Communication breakdown",
            "injury_type_back": "Back injury",
            "injury_type_shoulder": "Shoulder injury",
            "injury_type_knee": "Knee injury",
            "injury_type_psychological": "Psychological injury",
            "caps_ratio": "Uppercase ratio",
            "question_density": "Question density",
            "consecutive_missed_appts": "Consecutive missed",
            "avg_response_latency_mins": "Response latency",
            "injury_register_logged": "Injury register",
            "channel_email": "Email channel",
            "channel_whatsapp": "WhatsApp channel",
            "channel_web": "Web channel"
        }
        return labels


# Global instance
feature_extractor = FeatureExtractor()

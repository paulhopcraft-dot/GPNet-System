"""Configuration and thresholds for ML predictions"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"
DEMO_DATA_DIR = DATA_DIR / "demo"

# Model versions
MODEL_VERSION = "v1.0"

# UC-1: Case Priority Thresholds
UC1_HIGH_THRESHOLD = 0.75
UC1_MEDIUM_THRESHOLD = 0.40

# UC-2: Check-in Escalation Threshold
UC2_ESCALATE_THRESHOLD = 0.60

# UC-3: Incident Detection Threshold
UC3_INCIDENT_THRESHOLD = 0.70

# UC-4: Document Completeness Threshold
UC4_MISSING_CRITICAL_THRESHOLD = 0.60

# UC-5: Auto-Send Email Thresholds
UC5_SEND_THRESHOLD = 0.85
UC5_CONFIDENCE_THRESHOLD = 0.75

# UC-6: Complaint Risk Threshold
UC6_HIGH_RISK_THRESHOLD = 0.70

# UC-7: Fraud Detection Threshold
UC7_QUARANTINE_THRESHOLD = 0.80

# UC-8: Phishing Detection Threshold
UC8_QUARANTINE_THRESHOLD = 0.85

# UC-9: Recovery Timeline (weeks)
UC9_DELAYED_WEEKS_THRESHOLD = 12

# UC-10: Inherent Requirements Non-Fit Threshold
UC10_NONFIT_THRESHOLD = 0.70

# UC-11: Work-Relatedness Thresholds
UC11_WORK_THRESHOLD = 0.75
UC11_UNCLEAR_LOW = 0.40
UC11_UNCLEAR_HIGH = 0.74

# UC-12: Obligation Compliance Thresholds
UC12_HIGH_RISK_THRESHOLD = 0.70
UC12_MEDIUM_RISK_THRESHOLD = 0.40

# UC-13: Claim Escalation Thresholds
UC13_HIGH_RISK_THRESHOLD = 0.70
UC13_MEDIUM_RISK_THRESHOLD = 0.40

# Guardrail keywords
LEGAL_THREAT_KEYWORDS = [
    "lawyer", "attorney", "legal action", "solicitor",
    "defamation", "privacy complaint", "discrimination",
    "ombudsman", "tribunal", "sue", "lawsuit"
]

# XGBoost default parameters
XGB_PARAMS = {
    "max_depth": 6,
    "n_estimators": 400,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_lambda": 1.0,
    "min_child_weight": 1,
    "random_state": 42
}

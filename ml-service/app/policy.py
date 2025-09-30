"""Policy engine for banding, guardrails, and recommendations"""
from typing import Dict, Any, List, Tuple, Optional
from app.config import *


def check_guardrails(text: Optional[str] = None, fields: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
    """Check for guardrail conditions that force manual review"""
    if text:
        text_lower = text.lower()
        for keyword in LEGAL_THREAT_KEYWORDS:
            if keyword in text_lower:
                return {
                    "force_decision": "Hold/Manual",
                    "reason": f"guardrail:legal_threat:{keyword}",
                    "recommendation": "Legal threat detected - requires immediate manual review"
                }
    
    if fields:
        if not fields.get("case_id"):
            return {
                "force_decision": "Hold/Manual",
                "reason": "guardrail:missing_case_id",
                "recommendation": "Missing case ID - cannot process"
            }
    
    return None


def uc1_policy(probs: Dict[str, float]) -> Tuple[str, int, str]:
    """UC-1: Case Priority - High/Medium/Low"""
    if probs["high"] >= UC1_HIGH_THRESHOLD:
        return "red", int(probs["high"] * 100), "Review today; high priority case"
    elif probs["medium"] >= UC1_MEDIUM_THRESHOLD:
        return "yellow", int(probs["medium"] * 100), "Review this week; medium priority"
    else:
        return "green", int(probs["low"] * 100), "Routine monitoring; low priority"


def uc2_policy(probs: Dict[str, float]) -> Tuple[str, str]:
    """UC-2: Check-in Escalation - Escalate/Monitor"""
    if probs["escalate"] >= UC2_ESCALATE_THRESHOLD:
        return "Escalate", "Immediate case manager intervention required"
    else:
        return "Monitor", "Continue routine monitoring"


def uc3_policy(probs: Dict[str, float]) -> Tuple[str, str]:
    """UC-3: Incident Routing - Incident/Prevention"""
    if probs["incident"] >= UC3_INCIDENT_THRESHOLD:
        return "Incident", "Route to injury management workflow"
    else:
        return "Prevention", "Route to pre-employment/prevention workflow"


def uc4_policy(probs: Dict[str, float], features: Dict[str, Any]) -> Tuple[str, List[str], str]:
    """UC-4: Document Completeness - Complete/Missing"""
    missing = []
    
    if not features.get("has_medical_cert"):
        missing.append("Medical certificate")
    if not features.get("has_incident_report"):
        missing.append("Incident report")
    if not features.get("has_imaging_referral") and features.get("injury_severity_scale", 0) >= 3:
        missing.append("Imaging referral")
    
    if missing:
        decision = "Missing Critical"
        recommendation = f"Request: {', '.join(missing)}"
    else:
        decision = "Complete"
        recommendation = "All critical documents present"
    
    return decision, missing, recommendation


def uc5_policy(probs: Dict[str, float], confidence: float) -> Tuple[str, str, str, str]:
    """UC-5: Email Auto-Send - Send/Hold"""
    if probs["safe"] >= UC5_SEND_THRESHOLD and confidence >= UC5_CONFIDENCE_THRESHOLD:
        decision = "Send"
        recommendation = "Safe to auto-send"
        template = "Standard"
        tone = "Professional"
    else:
        decision = "Hold"
        recommendation = "Hold for Natalie; potential complaint risk"
        template = "Safer Alternative"
        tone = "Empathetic"
    
    return decision, recommendation, template, tone


def uc6_policy(probs: Dict[str, float]) -> Tuple[str, str]:
    """UC-6: Complaint Risk - High/Medium/Low"""
    if probs["high_risk"] >= UC6_HIGH_RISK_THRESHOLD:
        return "High Risk", "Rewrite with empathetic tone; avoid accusatory language"
    elif probs["medium_risk"] >= 0.40:
        return "Medium Risk", "Review tone and phrasing before sending"
    else:
        return "Low Risk", "Proceed with standard communication"


def uc7_policy(probs: Dict[str, float]) -> Tuple[bool, str, str]:
    """UC-7: Fraud Detection - Quarantine/Allow"""
    if probs["fraudulent"] >= UC7_QUARANTINE_THRESHOLD:
        return True, "Fraudulent", "Quarantine document; request verified re-upload"
    else:
        return False, "Legitimate", "Document appears legitimate"


def uc8_policy(probs: Dict[str, float]) -> Tuple[bool, str, str]:
    """UC-8: Phishing Detection - Quarantine/Allow"""
    if probs["phishing"] >= UC8_QUARANTINE_THRESHOLD:
        return True, "Phishing/Coached", "Quarantine and route to security review"
    else:
        return False, "Legitimate", "Email appears legitimate"


def uc9_policy(predicted_weeks: float, injury_type: str) -> Tuple[float, float, float, bool, str]:
    """UC-9: Recovery Timeline - Expected weeks with CI"""
    # Simple confidence interval (80%)
    ci_lower = predicted_weeks * 0.8
    ci_upper = predicted_weeks * 1.2
    
    # Benchmark delays by injury type
    benchmarks = {
        "back": 8,
        "shoulder": 10,
        "knee": 12,
        "psychological": 16
    }
    
    benchmark = benchmarks.get(injury_type, 10)
    delayed = predicted_weeks > benchmark * 1.3
    
    if delayed:
        recommendation = "Expedite imaging/specialist referral; review treatment plan"
    else:
        recommendation = "On track with typical recovery timeline"
    
    return predicted_weeks, ci_lower, ci_upper, delayed, recommendation


def uc10_policy(probs: Dict[str, float]) -> Tuple[str, str]:
    """UC-10: Inherent Requirements Non-Fit"""
    if probs["nonfit"] >= UC10_NONFIT_THRESHOLD:
        return "Non-Fit", "Recommend redeployment or vocational pathway"
    else:
        return "Fit/Progressing", "Worker can meet role requirements with current restrictions"


def uc11_policy(probs: Dict[str, float]) -> Tuple[str, str]:
    """UC-11: Work-Relatedness"""
    if probs["work_related"] >= UC11_WORK_THRESHOLD:
        return "Work-Related", "Proceed with workers' compensation pathway"
    elif UC11_UNCLEAR_LOW <= probs["work_related"] <= UC11_UNCLEAR_HIGH:
        return "Unclear", "Request GP notes + witness statement for clarification"
    else:
        return "Non-Work", "Likely non-occupational injury"


def uc12_policy(probs: Dict[str, float], is_workcover: bool) -> Tuple[str, bool, List[str], str]:
    """UC-12: Obligation Compliance"""
    if probs["high_risk"] >= UC12_HIGH_RISK_THRESHOLD:
        band = "High Risk"
        entitlement_risk = True
        evidence = [
            "Compile missed appointment log",
            "Document refused suitable duties",
            "Record communication delays"
        ]
        if is_workcover:
            recommendation = "Flag entitlement at risk; prepare evidence for insurer"
        else:
            recommendation = "Generate reasonable directives checklist"
    elif probs["medium_risk"] >= UC12_MEDIUM_RISK_THRESHOLD:
        band = "Medium Risk"
        entitlement_risk = False
        evidence = []
        recommendation = "Increase monitoring; document all interactions"
    else:
        band = "Compliant"
        entitlement_risk = False
        evidence = []
        recommendation = "Worker is meeting obligations"
    
    return band, entitlement_risk, evidence, recommendation


def uc13_policy(probs: Dict[str, float]) -> Tuple[str, str]:
    """UC-13: Claim Escalation Risk"""
    if probs["high_risk"] >= UC13_HIGH_RISK_THRESHOLD:
        return "High Risk", "⚠️ Likely to become WorkCover claim - early intervention critical"
    elif probs["medium_risk"] >= UC13_MEDIUM_RISK_THRESHOLD:
        return "Medium Risk", "Monitor closely; supportive communication recommended"
    else:
        return "Low Risk", "Unlikely to escalate to formal claim"

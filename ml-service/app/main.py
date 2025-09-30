"""FastAPI ML Service for GPNet Case Management"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from typing import Dict, Any
from app.uc_registry import registry
from app.features import feature_extractor
from app.policy import uc1_policy, uc7_policy, uc12_policy, uc13_policy
from app.data_models import (
    CasePriorityRequest, CasePriorityResponse,
    FraudDocRequest, FraudDocResponse,
    ObligationComplianceRequest, ObligationComplianceResponse,
    ClaimEscalationRequest, ClaimEscalationResponse
)
from app.config import MODEL_VERSION

app = FastAPI(
    title="GPNet ML Service",
    description="XGBoost-based ML predictions for case management",
    version=MODEL_VERSION
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": registry.loaded_models(),
        "version": MODEL_VERSION
    }


@app.post("/ml/score/case-priority", response_model=CasePriorityResponse)
async def score_case_priority(request: CasePriorityRequest):
    """UC-1: Case Priority Scoring
    
    Returns priority band (red/yellow/green), score, and recommendation
    """
    try:
        # Extract features
        request_dict = request.model_dump()
        features = feature_extractor.extract(request_dict, "uc_1")
        
        # Get prediction and SHAP values
        probs, shap_values = registry.predict("uc_1", features)
        
        # Handle multiclass probabilities
        # UC-1 binary model: high=1, medium/low=0
        # Map back to 3 classes for policy
        prob_high = float(probs[0, 1])
        prob_medium = float(probs[0, 0]) * 0.6  # Split low probability
        prob_low = float(probs[0, 0]) * 0.4
        
        probs_dict = {
            "high": prob_high,
            "medium": prob_medium,
            "low": prob_low
        }
        
        # Apply policy
        band, score, recommendation = uc1_policy(probs_dict)
        
        # Get top SHAP features
        shap_top = registry.get_top_shap_features("uc_1", shap_values, features, top_k=5)
        
        return CasePriorityResponse(
            model_version=MODEL_VERSION,
            band=band,
            score=score,
            probabilities=probs_dict,
            recommendation=recommendation,
            shap_top=shap_top
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/ml/score/fraud", response_model=FraudDocResponse)
async def score_fraud(request: FraudDocRequest):
    """UC-7: Fraud Detection
    
    Returns quarantine decision and fraud risk assessment
    """
    try:
        # Extract features
        request_dict = request.model_dump()
        features = feature_extractor.extract(request_dict, "uc_7")
        
        # Get prediction and SHAP values
        probs, shap_values = registry.predict("uc_7", features)
        
        # Binary classification: fraudulent=1, legitimate=0
        prob_fraudulent = float(probs[0, 1])
        prob_legitimate = float(probs[0, 0])
        
        probs_dict = {
            "fraudulent": prob_fraudulent,
            "legitimate": prob_legitimate
        }
        
        # Apply policy
        quarantine, decision, recommendation = uc7_policy(probs_dict)
        
        # Get top SHAP features
        shap_top = registry.get_top_shap_features("uc_7", shap_values, features, top_k=5)
        
        return FraudDocResponse(
            model_version=MODEL_VERSION,
            decision=decision,
            quarantine=quarantine,
            probabilities=probs_dict,
            recommendation=recommendation,
            shap_top=shap_top
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/ml/score/compliance", response_model=ObligationComplianceResponse)
async def score_compliance(request: ObligationComplianceRequest):
    """UC-12: Obligation Compliance Scoring
    
    Returns compliance risk band and entitlement assessment
    """
    try:
        # Extract features
        request_dict = request.model_dump()
        features = feature_extractor.extract(request_dict, "uc_12")
        
        # Get prediction and SHAP values
        probs, shap_values = registry.predict("uc_12", features)
        
        # Binary classification: non-compliant=1, compliant=0
        prob_high_risk = float(probs[0, 1])
        prob_compliant = float(probs[0, 0])
        
        # Split compliant into medium/low
        prob_medium_risk = prob_compliant * 0.3
        prob_low_risk = prob_compliant * 0.7
        
        probs_dict = {
            "high_risk": prob_high_risk,
            "medium_risk": prob_medium_risk,
            "low_risk": prob_low_risk
        }
        
        # Determine if WorkCover case (simple heuristic)
        is_workcover = request_dict.get("case_id", "").startswith("WC") or \
                      request_dict.get("missed_appts_7d", 0) > 2
        
        # Apply policy
        band, entitlement_risk, evidence_log, recommendation = uc12_policy(
            probs_dict, 
            is_workcover
        )
        
        # Get top SHAP features
        shap_top = registry.get_top_shap_features("uc_12", shap_values, features, top_k=5)
        
        return ObligationComplianceResponse(
            model_version=MODEL_VERSION,
            band=band,
            probabilities=probs_dict,
            recommendation=recommendation,
            shap_top=shap_top,
            entitlement_at_risk=entitlement_risk,
            evidence_log=evidence_log if evidence_log else None
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/ml/score/claim-escalation", response_model=ClaimEscalationResponse)
async def score_claim_escalation(request: ClaimEscalationRequest):
    """UC-13: Claim Escalation Risk
    
    Returns escalation risk band and intervention recommendation
    """
    try:
        # Extract features
        request_dict = request.model_dump()
        features = feature_extractor.extract(request_dict, "uc_13")
        
        # Get prediction and SHAP values
        probs, shap_values = registry.predict("uc_13", features)
        
        # Binary classification: escalates=1, stable=0
        prob_high_risk = float(probs[0, 1])
        prob_stable = float(probs[0, 0])
        
        # Split stable into medium/low
        prob_medium_risk = prob_stable * 0.4
        prob_low_risk = prob_stable * 0.6
        
        probs_dict = {
            "high_risk": prob_high_risk,
            "medium_risk": prob_medium_risk,
            "low_risk": prob_low_risk
        }
        
        # Apply policy
        band, recommendation = uc13_policy(probs_dict)
        
        # Get top SHAP features
        shap_top = registry.get_top_shap_features("uc_13", shap_values, features, top_k=5)
        
        return ClaimEscalationResponse(
            model_version=MODEL_VERSION,
            band=band,
            probabilities=probs_dict,
            recommendation=recommendation,
            shap_top=shap_top
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "GPNet ML Service",
        "version": MODEL_VERSION,
        "endpoints": [
            "/health",
            "/ml/score/case-priority",
            "/ml/score/fraud",
            "/ml/score/compliance",
            "/ml/score/claim-escalation"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

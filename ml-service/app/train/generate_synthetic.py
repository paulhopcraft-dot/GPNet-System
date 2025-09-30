"""Generate synthetic training data for all 13 use cases"""
import numpy as np
import pandas as pd
from pathlib import Path
from app.config import DEMO_DATA_DIR

np.random.seed(42)

def generate_uc1_data(n=800):
    """UC-1: Case Priority"""
    data = []
    for _ in range(n):
        days_open = np.random.randint(0, 60)
        sla_breaches = np.random.poisson(0.3)
        sentiment = np.random.normal(-0.2, 0.4)
        injury_terms = np.random.poisson(2)
        prior_esc = np.random.poisson(0.5)
        
        # Label: high if multiple risk factors
        score = days_open * 0.02 - sentiment * 0.5 + injury_terms * 0.1 + prior_esc * 0.3 + sla_breaches * 0.2
        if score > 2.5:
            label = 2  # high
        elif score > 1.2:
            label = 1  # medium
        else:
            label = 0  # low
        
        data.append([days_open, sla_breaches, sentiment, injury_terms, prior_esc, label])
    
    df = pd.DataFrame(data, columns=['days_open', 'sla_breaches', 'sentiment_compound', 'injury_terms_count', 'prior_escalations', 'priority'])
    return df

def generate_uc13_data(n=800):
    """UC-13: Claim Escalation Risk"""
    data = []
    for _ in range(n):
        lawyer_mentions = np.random.poisson(0.2)
        claim_mentions = np.random.poisson(0.3)
        neg_trend = np.random.normal(0, 0.3)
        diag_delay = np.random.choice([0, 1], p=[0.8, 0.2])
        refused_duties = np.random.choice([0, 1], p=[0.7, 0.3])
        severity = np.random.randint(1, 5)
        imaging_delay = np.random.randint(0, 30)
        doctor_changes = np.random.poisson(0.5)
        
        # Label: escalates if multiple red flags
        score = (lawyer_mentions * 0.4 + claim_mentions * 0.3 - neg_trend * 0.2 +
                 diag_delay * 0.3 + refused_duties * 0.3 + severity * 0.1 + 
                 (imaging_delay > 14) * 0.2 + doctor_changes * 0.15)
        
        label = 1 if score > 1.5 else 0
        
        data.append([lawyer_mentions, claim_mentions, neg_trend, diag_delay, 
                    refused_duties, severity, imaging_delay, doctor_changes, label])
    
    df = pd.DataFrame(data, columns=[
        'keyword_lawyer', 'keyword_claim', 'neg_sentiment_trend_7d', 
        'diagnostic_delay_flag', 'refused_duties_flag', 'injury_severity_scale',
        'imaging_delay_days', 'doctor_changes_count', 'escalation'
    ])
    return df

def generate_uc7_data(n=600):
    """UC-7: Fraud Detection"""
    data = []
    for _ in range(n):
        ocr_mismatch = np.random.beta(2, 8)  # Most low, some high
        doc_repeat = np.random.choice([0, 1], p=[0.9, 0.1])
        font_anomaly = np.random.choice([0, 1], p=[0.85, 0.15])
        abn_match = np.random.choice([0, 1], p=[0.1, 0.9])
        doctor_changes = np.random.poisson(0.3)
        
        # Fraud if multiple anomalies
        score = ocr_mismatch * 0.4 + doc_repeat * 0.3 + font_anomaly * 0.25 + (1 - abn_match) * 0.4 + doctor_changes * 0.1
        label = 1 if score > 0.6 else 0
        
        data.append([ocr_mismatch, doc_repeat, font_anomaly, abn_match, doctor_changes, label])
    
    df = pd.DataFrame(data, columns=[
        'ocr_text_mismatch_rate', 'doc_hash_repeat', 'font_anomaly_flag',
        'provider_abn_match', 'doctor_changes_count', 'fraudulent'
    ])
    return df

def generate_uc12_data(n=700):
    """UC-12: Obligation Compliance"""
    data = []
    for _ in range(n):
        missed_7d = np.random.poisson(0.3)
        missed_30d = np.random.poisson(1.2)
        consecutive = min(missed_7d, 3)
        refused_duties = np.random.choice([0, 1], p=[0.75, 0.25])
        latency = np.random.exponential(120)
        completion = np.random.beta(8, 2)
        breakdown = np.random.choice([0, 1], p=[0.85, 0.15])
        
        # Non-compliance if multiple issues
        score = missed_7d * 0.2 + missed_30d * 0.1 + consecutive * 0.25 + refused_duties * 0.3 + (latency > 300) * 0.2 + (1 - completion) * 0.3 + breakdown * 0.35
        label = 1 if score > 0.7 else 0
        
        data.append([missed_7d, missed_30d, consecutive, refused_duties, latency, completion, breakdown, label])
    
    df = pd.DataFrame(data, columns=[
        'missed_appts_7d', 'missed_appts_30d', 'consecutive_missed_appts',
        'refused_duties_flag', 'avg_response_latency_mins', 'checkin_completion_rate',
        'communication_breakdown_flag', 'noncompliant'
    ])
    return df

def generate_all_datasets():
    """Generate and save all synthetic datasets"""
    DEMO_DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Generating synthetic training data...")
    
    # UC-1: Case Priority
    df1 = generate_uc1_data()
    df1.to_csv(DEMO_DATA_DIR / "uc_1.csv", index=False)
    print(f"✅ UC-1: {len(df1)} samples")
    
    # UC-13: Claim Escalation
    df13 = generate_uc13_data()
    df13.to_csv(DEMO_DATA_DIR / "uc_13.csv", index=False)
    print(f"✅ UC-13: {len(df13)} samples")
    
    # UC-7: Fraud
    df7 = generate_uc7_data()
    df7.to_csv(DEMO_DATA_DIR / "uc_7.csv", index=False)
    print(f"✅ UC-7: {len(df7)} samples")
    
    # UC-12: Compliance
    df12 = generate_uc12_data()
    df12.to_csv(DEMO_DATA_DIR / "uc_12.csv", index=False)
    print(f"✅ UC-12: {len(df12)} samples")
    
    print("\n🎉 All synthetic datasets generated!")

if __name__ == "__main__":
    generate_all_datasets()

"""Train XGBoost models for UC-1, UC-7, UC-12, UC-13"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import numpy as np
import pandas as pd
import joblib
import shap
from app.train.generate_synthetic import generate_all_datasets
from app.train.utils import (
    load_dataset, time_based_split, train_classifier,
    compute_classifier_metrics
)
from app.config import MODELS_DIR, DEMO_DATA_DIR, MODEL_VERSION
from app.features import feature_extractor


def train_uc1():
    """Train UC-1: Case Priority (multiclass)"""
    print("\n" + "="*60)
    print("Training UC-1: Case Priority")
    print("="*60)
    
    # Load data
    csv_path = DEMO_DATA_DIR / "uc_1.csv"
    X, y = load_dataset(str(csv_path))
    
    # Map to binary for training (high=1, medium/low=0)
    y_binary = (y == 2).astype(int)
    
    # Split data
    X_train, X_val, X_test, y_train, y_val, y_test = time_based_split(X, y_binary)
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Positive rate: {y_binary.mean():.3f}")
    
    # Train model
    model, calibrator = train_classifier(X_train, y_train, X_val, y_val)
    
    # Evaluate
    metrics = compute_classifier_metrics(model, calibrator, X_test, y_test)
    print(f"\n✅ UC-1 Metrics:")
    print(f"   AUC: {metrics['auc']:.3f}")
    print(f"   PR-AUC: {metrics['pr_auc']:.3f}")
    print(f"   F1: {metrics['f1']:.3f}")
    print(f"   ECE: {metrics['ece']:.3f}")
    
    # Create SHAP explainer
    explainer = shap.TreeExplainer(model)
    
    # Save artifacts
    output_dir = MODELS_DIR / "uc_1"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(model, output_dir / "model.pkl")
    joblib.dump(calibrator, output_dir / "calibrator.pkl")
    joblib.dump(explainer, output_dir / "explainer.pkl")
    joblib.dump(metrics, output_dir / "metrics.json")
    
    # Save feature order
    feature_order = list(X.columns)
    joblib.dump(feature_order, output_dir / "feature_order.pkl")
    
    print(f"💾 Saved to {output_dir}")
    return metrics


def train_uc7():
    """Train UC-7: Fraud Detection (binary)"""
    print("\n" + "="*60)
    print("Training UC-7: Fraud Detection")
    print("="*60)
    
    # Load data
    csv_path = DEMO_DATA_DIR / "uc_7.csv"
    X, y = load_dataset(str(csv_path))
    
    # Split data
    X_train, X_val, X_test, y_train, y_val, y_test = time_based_split(X, y)
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Fraud rate: {y.mean():.3f}")
    
    # Train model
    model, calibrator = train_classifier(X_train, y_train, X_val, y_val)
    
    # Evaluate
    metrics = compute_classifier_metrics(model, calibrator, X_test, y_test)
    print(f"\n✅ UC-7 Metrics:")
    print(f"   AUC: {metrics['auc']:.3f}")
    print(f"   PR-AUC: {metrics['pr_auc']:.3f}")
    print(f"   F1: {metrics['f1']:.3f}")
    print(f"   ECE: {metrics['ece']:.3f}")
    
    # Create SHAP explainer
    explainer = shap.TreeExplainer(model)
    
    # Save artifacts
    output_dir = MODELS_DIR / "uc_7"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(model, output_dir / "model.pkl")
    joblib.dump(calibrator, output_dir / "calibrator.pkl")
    joblib.dump(explainer, output_dir / "explainer.pkl")
    joblib.dump(metrics, output_dir / "metrics.json")
    
    # Save feature order
    feature_order = list(X.columns)
    joblib.dump(feature_order, output_dir / "feature_order.pkl")
    
    print(f"💾 Saved to {output_dir}")
    return metrics


def train_uc12():
    """Train UC-12: Obligation Compliance (binary)"""
    print("\n" + "="*60)
    print("Training UC-12: Obligation Compliance")
    print("="*60)
    
    # Load data
    csv_path = DEMO_DATA_DIR / "uc_12.csv"
    X, y = load_dataset(str(csv_path))
    
    # Split data
    X_train, X_val, X_test, y_train, y_val, y_test = time_based_split(X, y)
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Non-compliance rate: {y.mean():.3f}")
    
    # Train model
    model, calibrator = train_classifier(X_train, y_train, X_val, y_val)
    
    # Evaluate
    metrics = compute_classifier_metrics(model, calibrator, X_test, y_test)
    print(f"\n✅ UC-12 Metrics:")
    print(f"   AUC: {metrics['auc']:.3f}")
    print(f"   PR-AUC: {metrics['pr_auc']:.3f}")
    print(f"   F1: {metrics['f1']:.3f}")
    print(f"   ECE: {metrics['ece']:.3f}")
    
    # Create SHAP explainer
    explainer = shap.TreeExplainer(model)
    
    # Save artifacts
    output_dir = MODELS_DIR / "uc_12"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(model, output_dir / "model.pkl")
    joblib.dump(calibrator, output_dir / "calibrator.pkl")
    joblib.dump(explainer, output_dir / "explainer.pkl")
    joblib.dump(metrics, output_dir / "metrics.json")
    
    # Save feature order
    feature_order = list(X.columns)
    joblib.dump(feature_order, output_dir / "feature_order.pkl")
    
    print(f"💾 Saved to {output_dir}")
    return metrics


def train_uc13():
    """Train UC-13: Claim Escalation (binary)"""
    print("\n" + "="*60)
    print("Training UC-13: Claim Escalation Risk")
    print("="*60)
    
    # Load data
    csv_path = DEMO_DATA_DIR / "uc_13.csv"
    X, y = load_dataset(str(csv_path))
    
    # Split data
    X_train, X_val, X_test, y_train, y_val, y_test = time_based_split(X, y)
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Escalation rate: {y.mean():.3f}")
    
    # Train model
    model, calibrator = train_classifier(X_train, y_train, X_val, y_val)
    
    # Evaluate
    metrics = compute_classifier_metrics(model, calibrator, X_test, y_test)
    print(f"\n✅ UC-13 Metrics:")
    print(f"   AUC: {metrics['auc']:.3f}")
    print(f"   PR-AUC: {metrics['pr_auc']:.3f}")
    print(f"   F1: {metrics['f1']:.3f}")
    print(f"   ECE: {metrics['ece']:.3f}")
    
    # Create SHAP explainer
    explainer = shap.TreeExplainer(model)
    
    # Save artifacts
    output_dir = MODELS_DIR / "uc_13"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(model, output_dir / "model.pkl")
    joblib.dump(calibrator, output_dir / "calibrator.pkl")
    joblib.dump(explainer, output_dir / "explainer.pkl")
    joblib.dump(metrics, output_dir / "metrics.json")
    
    # Save feature order
    feature_order = list(X.columns)
    joblib.dump(feature_order, output_dir / "feature_order.pkl")
    
    print(f"💾 Saved to {output_dir}")
    return metrics


def main():
    """Train all 4 priority models"""
    print("🚀 XGBoost Training Pipeline")
    print(f"Model Version: {MODEL_VERSION}")
    print(f"Output Directory: {MODELS_DIR}")
    
    # Generate synthetic data
    print("\n📊 Generating synthetic training data...")
    generate_all_datasets()
    
    # Train all models
    metrics_summary = {}
    
    try:
        metrics_summary['uc_1'] = train_uc1()
        metrics_summary['uc_7'] = train_uc7()
        metrics_summary['uc_12'] = train_uc12()
        metrics_summary['uc_13'] = train_uc13()
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        raise
    
    # Print summary
    print("\n" + "="*60)
    print("📊 TRAINING SUMMARY")
    print("="*60)
    print("\nModel Performance (AUC):")
    for uc, metrics in metrics_summary.items():
        print(f"  {uc.upper()}: {metrics['auc']:.3f}")
    
    print("\n✅ All models trained successfully!")
    print(f"Models saved to: {MODELS_DIR}")


if __name__ == "__main__":
    main()

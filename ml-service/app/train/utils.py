"""Training utilities for XGBoost models with calibration"""
import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score,
    confusion_matrix, mean_squared_error, mean_absolute_error
)
import xgboost as xgb
from typing import Tuple, Dict, Any
from app.config import XGB_PARAMS, MODELS_DIR


def load_dataset(csv_path: str) -> Tuple[pd.DataFrame, pd.Series]:
    """Load dataset and split features/labels"""
    df = pd.read_csv(csv_path)
    
    # Assume last column is target
    X = df.iloc[:, :-1]
    y = df.iloc[:, -1]
    
    return X, y


def time_based_split(X: pd.DataFrame, y: pd.Series, 
                     train_ratio: float = 0.70,
                     val_ratio: float = 0.15) -> Tuple:
    """Split data chronologically (simulating time-based split)"""
    n = len(X)
    train_idx = int(n * train_ratio)
    val_idx = int(n * (train_ratio + val_ratio))
    
    X_train = X.iloc[:train_idx]
    y_train = y.iloc[:train_idx]
    
    X_val = X.iloc[train_idx:val_idx]
    y_val = y.iloc[train_idx:val_idx]
    
    X_test = X.iloc[val_idx:]
    y_test = y.iloc[val_idx:]
    
    return X_train, X_val, X_test, y_train, y_val, y_test


def train_classifier(X_train, y_train, X_val, y_val, scale_pos_weight: float = None):
    """Train XGBoost classifier with calibration"""
    params = XGB_PARAMS.copy()
    
    # Handle class imbalance
    if scale_pos_weight is None:
        neg_count = (y_train == 0).sum()
        pos_count = (y_train == 1).sum()
        if pos_count > 0:
            scale_pos_weight = neg_count / pos_count
        else:
            scale_pos_weight = 1.0
    
    params['scale_pos_weight'] = scale_pos_weight
    
    # Train XGBoost
    model = xgb.XGBClassifier(**params)
    model.fit(X_train, y_train)
    
    # Calibrate on validation set
    n_samples = len(X_val)
    calibration_method = 'isotonic' if n_samples >= 1000 else 'sigmoid'
    
    calibrator = CalibratedClassifierCV(model, method=calibration_method, cv='prefit')
    calibrator.fit(X_val, y_val)
    
    return model, calibrator


def train_regressor(X_train, y_train):
    """Train XGBoost regressor"""
    params = XGB_PARAMS.copy()
    params.pop('scale_pos_weight', None)  # Not used in regression
    
    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train)
    
    return model


def compute_classifier_metrics(model, calibrator, X_test, y_test) -> Dict[str, float]:
    """Compute classification metrics"""
    y_pred_proba = calibrator.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)
    
    metrics = {
        'auc': roc_auc_score(y_test, y_pred_proba),
        'pr_auc': average_precision_score(y_test, y_pred_proba),
        'f1': f1_score(y_test, y_pred),
        'accuracy': (y_pred == y_test).mean()
    }
    
    # Compute ECE (Expected Calibration Error)
    ece = compute_ece(y_test, y_pred_proba)
    metrics['ece'] = ece
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    metrics['confusion_matrix'] = cm.tolist()
    
    return metrics


def compute_regressor_metrics(model, X_test, y_test) -> Dict[str, float]:
    """Compute regression metrics"""
    y_pred = model.predict(X_test)
    
    metrics = {
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
        'mae': mean_absolute_error(y_test, y_pred),
        'r2': 1 - (np.sum((y_test - y_pred) ** 2) / np.sum((y_test - y_test.mean()) ** 2))
    }
    
    # 80% confidence interval coverage
    residuals = np.abs(y_test - y_pred)
    ci_80 = np.percentile(residuals, 80)
    coverage = (residuals <= ci_80).mean()
    metrics['ci_80_coverage'] = coverage
    
    return metrics


def compute_ece(y_true, y_pred_proba, n_bins: int = 10) -> float:
    """Compute Expected Calibration Error"""
    bins = np.linspace(0, 1, n_bins + 1)
    bin_indices = np.digitize(y_pred_proba, bins) - 1
    
    ece = 0.0
    for i in range(n_bins):
        mask = bin_indices == i
        if mask.sum() > 0:
            bin_accuracy = y_true[mask].mean()
            bin_confidence = y_pred_proba[mask].mean()
            bin_weight = mask.sum() / len(y_true)
            ece += bin_weight * np.abs(bin_accuracy - bin_confidence)
    
    return ece


def save_artifacts(uc_name: str, model, calibrator, explainer, 
                   feature_order: list, metrics: dict, version: str = "v1.0"):
    """Save all training artifacts"""
    uc_dir = MODELS_DIR / uc_name
    uc_dir.mkdir(parents=True, exist_ok=True)
    
    # Save model and calibrator
    joblib.dump(model, uc_dir / "model.joblib")
    if calibrator is not None:
        joblib.dump(calibrator, uc_dir / "calibrator.joblib")
    if explainer is not None:
        joblib.dump(explainer, uc_dir / "explainer.joblib")
    
    # Save feature order
    with open(uc_dir / "feature_order.json", "w") as f:
        json.dump(feature_order, f)
    
    # Save metrics
    with open(uc_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    
    # Save version
    with open(uc_dir / "version.txt", "w") as f:
        f.write(version)
    
    print(f"✅ Saved artifacts for {uc_name}")
    print(f"   Metrics: {metrics}")

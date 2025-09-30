"""Model registry with lazy loading and SHAP explainers"""
import joblib
import numpy as np
from pathlib import Path
from typing import Dict, Tuple, Optional, Any
from app.config import MODELS_DIR
from app.features import feature_extractor


class UCRegistry:
    """Lazy-loading registry for trained models"""
    
    def __init__(self):
        self.models = {}
        self.calibrators = {}
        self.explainers = {}
        self.feature_orders = {}
        self._loaded_ucs = set()
    
    def _load_uc(self, uc_id: str):
        """Load model, calibrator, and explainer for a use case"""
        if uc_id in self._loaded_ucs:
            return
        
        uc_dir = MODELS_DIR / uc_id
        if not uc_dir.exists():
            raise FileNotFoundError(f"Model directory not found: {uc_dir}")
        
        # Load model
        model_path = uc_dir / "model.pkl"
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        self.models[uc_id] = joblib.load(model_path)
        
        # Load calibrator
        calibrator_path = uc_dir / "calibrator.pkl"
        if not calibrator_path.exists():
            raise FileNotFoundError(f"Calibrator not found: {calibrator_path}")
        self.calibrators[uc_id] = joblib.load(calibrator_path)
        
        # Load SHAP explainer
        explainer_path = uc_dir / "explainer.pkl"
        if not explainer_path.exists():
            raise FileNotFoundError(f"SHAP explainer not found: {explainer_path}")
        self.explainers[uc_id] = joblib.load(explainer_path)
        
        # Load feature order
        feature_order_path = uc_dir / "feature_order.pkl"
        if not feature_order_path.exists():
            raise FileNotFoundError(f"Feature order not found: {feature_order_path}")
        self.feature_orders[uc_id] = joblib.load(feature_order_path)
        
        self._loaded_ucs.add(uc_id)
        print(f"✅ Loaded {uc_id}")
    
    def get_model(self, uc_id: str):
        """Get model for a use case (lazy load if needed)"""
        if uc_id not in self._loaded_ucs:
            self._load_uc(uc_id)
        return self.models[uc_id]
    
    def get_calibrator(self, uc_id: str):
        """Get calibrator for a use case (lazy load if needed)"""
        if uc_id not in self._loaded_ucs:
            self._load_uc(uc_id)
        return self.calibrators[uc_id]
    
    def get_explainer(self, uc_id: str):
        """Get SHAP explainer for a use case (lazy load if needed)"""
        if uc_id not in self._loaded_ucs:
            self._load_uc(uc_id)
        return self.explainers[uc_id]
    
    def get_feature_order(self, uc_id: str):
        """Get feature order for a use case (lazy load if needed)"""
        if uc_id not in self._loaded_ucs:
            self._load_uc(uc_id)
        return self.feature_orders[uc_id]
    
    def validate_features(self, uc_id: str, feature_array: np.ndarray) -> bool:
        """Validate feature array matches expected order"""
        expected_order = self.get_feature_order(uc_id)
        
        if len(feature_array) != len(expected_order):
            raise ValueError(
                f"Feature count mismatch for {uc_id}: "
                f"got {len(feature_array)}, expected {len(expected_order)}"
            )
        
        return True
    
    def predict(self, uc_id: str, features: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Make calibrated prediction
        
        Returns:
            Tuple of (class_probabilities, shap_values)
        """
        # Validate features
        self.validate_features(uc_id, features)
        
        # Get model and calibrator
        calibrator = self.get_calibrator(uc_id)
        explainer = self.get_explainer(uc_id)
        
        # Reshape if single sample
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Get calibrated probabilities
        probs = calibrator.predict_proba(features)
        
        # Get SHAP values
        shap_values = explainer.shap_values(features)
        
        return probs, shap_values
    
    def get_top_shap_features(
        self, 
        uc_id: str, 
        shap_values: np.ndarray, 
        features: np.ndarray,
        top_k: int = 5
    ) -> list:
        """Get top K contributing features by SHAP value
        
        Returns:
            List of dicts with feature name, value, and SHAP contribution
        """
        feature_order = self.get_feature_order(uc_id)
        feature_labels = feature_extractor.get_feature_labels()
        
        # Handle single sample
        if shap_values.ndim == 1:
            shap_vals = shap_values
            feat_vals = features
        else:
            shap_vals = shap_values[0] if shap_values.shape[0] == 1 else shap_values
            feat_vals = features[0] if features.shape[0] == 1 else features
        
        # For binary classification, use positive class SHAP values
        if isinstance(shap_vals, list) and len(shap_vals) == 2:
            shap_vals = shap_vals[1]
        
        # Get absolute SHAP values for ranking
        abs_shap = np.abs(shap_vals)
        top_indices = np.argsort(abs_shap)[::-1][:top_k]
        
        top_features = []
        for idx in top_indices:
            feature_name = feature_order[idx]
            feature_label = feature_labels.get(feature_name, feature_name)
            
            top_features.append({
                "feature": feature_label,
                "value": float(feat_vals[idx]),
                "shap_contribution": float(shap_vals[idx])
            })
        
        return top_features
    
    def is_loaded(self, uc_id: str) -> bool:
        """Check if a use case is loaded"""
        return uc_id in self._loaded_ucs
    
    def loaded_models(self) -> list:
        """Get list of loaded model IDs"""
        return list(self._loaded_ucs)


# Global registry instance
registry = UCRegistry()

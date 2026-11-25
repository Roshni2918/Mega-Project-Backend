import os
import sys
import json
import pandas as pd
from flask import Blueprint, request, jsonify
from database import get_session
from models import PredictionLog
from routes.auth_routes import get_current_user

# ML pipeline and artifacts are at the backend repository root
ML_FINAL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARTIFACTS_DIR = os.path.join(ML_FINAL_DIR, "ml_artifacts")

if ML_FINAL_DIR not in sys.path:
    sys.path.insert(0, ML_FINAL_DIR)

try:
    import ml_pipeline as ml
except ImportError:
    ml = None

ml_bp = Blueprint("ml", __name__)

_bundle = None

def get_bundle():
    global _bundle
    if ml is None:
        return None
    if _bundle is None:
        if os.path.exists(os.path.join(ARTIFACTS_DIR, "model_bundle.joblib")):
            try:
                print(f"[ML] Loading model bundle from {ARTIFACTS_DIR}...")
                _bundle = ml.load_bundle(ARTIFACTS_DIR)
                print(f"[ML] Bundle loaded successfully: best={_bundle.get('best_name')}")
            except Exception as e:
                print(f"[ML] Error loading model bundle: {e}")
    return _bundle


@ml_bp.route("/train", methods=["POST"])
def train():
    if ml is None:
        return jsonify({"error": "ML pipeline not available in this deployment."}), 503
    global _bundle
    data = request.get_json() or {}
    train_rows = data.get("train", [])
    test_rows = data.get("test", [])

    all_rows = train_rows + test_rows
    if not all_rows:
        return jsonify({"error": "No training or testing rows provided."}), 400

    try:
        df = pd.DataFrame(all_rows)
        print(f"[ML] Training models on {len(df)} rows from uploaded dataset...")
        payload, bundle = ml.train_pipeline(df)
        
        # Save updated bundle and metrics
        ml.save_artifacts(bundle, payload, ARTIFACTS_DIR)
        _bundle = bundle
        print(f"[ML] Training completed. Best model: {payload['best']}")

        return jsonify({
            "models": payload["models"],
            "best": payload["best"],
            "confusion": payload["confusion"],
            "perClass": payload.get("perClass"),
            "selectedFeatures": payload.get("selectedFeatures"),
        })
    except Exception as e:
        print(f"[ML] Training error: {e}")
        return jsonify({"error": str(e)}), 500


@ml_bp.route("/predict", methods=["POST"])
def predict():
    if ml is None:
        return jsonify({"error": "ML pipeline not available in this deployment."}), 503
    bundle = get_bundle()
    if not bundle:
        return jsonify({"error": "No trained model bundle available. Please run model training first."}), 400

    data = request.get_json() or {}
    row = data.get("row")
    if not row or not isinstance(row, dict):
        return jsonify({"error": "Missing or invalid 'row' in request body."}), 400

    try:
        res = ml.predict_row(bundle, row)

        # Log prediction to database
        user = get_current_user()
        user_email = user.get("email") if user else None
        
        try:
            session = get_session()
            log = PredictionLog(
                user_email=user_email,
                parameters_json=json.dumps(row),
                predicted_class=res["predicted"],
                predicted_label=res["label"],
                confidence=res["confidence"],
                probabilities_json=json.dumps(res["probabilities"])
            )
            session.add(log)
            session.commit()
            session.close()
        except Exception as log_err:
            print(f"[DB] Prediction log warning: {log_err}")

        return jsonify(res)
    except Exception as e:
        print(f"[ML] Prediction error: {e}")
        return jsonify({"error": str(e)}), 500


@ml_bp.route("/predict_batch", methods=["POST"])
def predict_batch():
    if ml is None:
        return jsonify({"error": "ML pipeline not available in this deployment."}), 503
    bundle = get_bundle()
    if not bundle:
        return jsonify({"error": "No trained model bundle available."}), 400

    data = request.get_json() or {}
    rows = data.get("rows")
    if not rows or not isinstance(rows, list):
        return jsonify({"error": "Missing or invalid 'rows' array in request body."}), 400

    try:
        res = ml.predict_batch(bundle, rows)
        return jsonify(res)
    except Exception as e:
        print(f"[ML] Batch prediction error: {e}")
        return jsonify({"error": str(e)}), 500


@ml_bp.route("/explain", methods=["POST"])
def explain():
    if ml is None:
        return jsonify({"error": "ML pipeline not available in this deployment."}), 503
    bundle = get_bundle()
    if not bundle:
        return jsonify({"error": "No trained model bundle available."}), 400

    data = request.get_json() or {}
    row = data.get("row")
    predicted = data.get("predicted")

    if not row:
        return jsonify({"error": "Missing 'row' in request body."}), 400

    try:
        res = ml.explain_row(bundle, row, predicted)
        return jsonify(res)
    except Exception as e:
        print(f"[ML] Explain error: {e}")
        return jsonify({"error": str(e)}), 500


@ml_bp.route("/recommend", methods=["POST"])
def recommend():
    if ml is None:
        return jsonify({"error": "ML pipeline not available in this deployment."}), 503
    bundle = get_bundle()
    if not bundle:
        return jsonify({"error": "No trained model bundle available."}), 400

    data = request.get_json() or {}
    row = data.get("row")
    predicted = data.get("predicted")

    if not row:
        return jsonify({"error": "Missing 'row' in request body."}), 400

    try:
        res = ml.recommend_row(bundle, row, predicted)
        return jsonify(res)
    except Exception as e:
        print(f"[ML] Recommend error: {e}")
        return jsonify({"error": str(e)}), 500

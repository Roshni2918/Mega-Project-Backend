# STEP 3 and STEP 4: prediction, explanation, recommendations and training.
# Every route here needs  Authorization: Bearer <token> (see auth_utils).
import os
import threading
import time
import uuid
from datetime import datetime, timezone

import pandas as pd
from flask import Blueprint, current_app, jsonify, request

import ml.bridge as bridge
import ml.ml_pipeline as ml
from auth_utils import current_user, token_required
from models import Model, db

ml_bp = Blueprint("ml", __name__, url_prefix="/api")


def _utcnow():
    # naive UTC, same convention as the database columns
    return datetime.now(timezone.utc).replace(tzinfo=None)

# Per-user models are cached in memory (keyed by database id) so the What-if
# page stays fast after the first prediction. Only files saved by this server
# are ever loaded (never a file uploaded by a user).
_MODEL_CACHE = {}
_CACHE_LOCK = threading.Lock()

# Simple in-memory status for GET /api/train/status. Training runs
# synchronously today (the front end waits for the POST /api/train response);
# this route reports the last run so the team can decide on a background job.
TRAIN_STATUS = {
    "state": "idle",           # idle | running | done | error
    "progress": 1.0,
    "startedAt": None,
    "finishedAt": None,
    "durationS": None,
    "error": None,
    "modelId": None,
    "best": None,
}


# ---------------------------------------------------------------------------
# helpers
def _default_bundle():
    return current_app.extensions.get("default_bundle")


def bundle_for_user(user):
    """The user's latest trained model, or the default model from Step 2."""
    row = (
        Model.query.filter_by(user_id=user.id)
        .order_by(Model.created_at.desc(), Model.id.desc())
        .first()
    )
    if row is None:
        return _default_bundle(), None
    with _CACHE_LOCK:
        cached = _MODEL_CACHE.get(row.id)
    if cached is not None:
        return cached, row
    # Only load files this server saved (file_path lives in model_store/).
    bundle = ml.load_bundle(row.file_path)
    with _CACHE_LOCK:
        _MODEL_CACHE[row.id] = bundle
    return bundle, row


def _json_body():
    return request.get_json(silent=True) or {}


def _bad(message, status=400):
    return jsonify({"error": message}), status


def _get_row():
    """The 13 features of the request, validated; or an error response."""
    row = _json_body().get("row")
    if not isinstance(row, dict):
        return None, _bad('Body must be {"row": {...}} with the 13 features.')
    try:
        return bridge.clean_row(row), None
    except ValueError as e:
        return None, _bad(str(e))


# ---------------------------------------------------------------------------
# STEP 3: prediction endpoints
@ml_bp.post("/predict")
@token_required
def predict():
    """POST /api/predict  body: {"row": {...13 values}}"""
    row, err = _get_row()
    if err:
        return err
    bundle, _ = bundle_for_user(current_user())
    try:
        result = ml.predict_row(bundle, row)
    except ValueError as e:
        return _bad(str(e))
    return jsonify(result)


@ml_bp.post("/predict_batch")
@token_required
def predict_batch():
    """POST /api/predict_batch  body: {"rows": [ {...}, {...} ]}  max 5000 rows."""
    data = _json_body()
    rows = data.get("rows")
    if not isinstance(rows, list):
        return _bad('Body must be {"rows": [ ... ]}.')
    if not rows:
        return _bad("The list of rows is empty.")
    limit = current_app.config["MAX_BATCH_ROWS"]
    if len(rows) > limit:
        return _bad(f"Too many rows: {len(rows)}. The limit is {limit} rows.", 413)
    try:
        rows = bridge.clean_rows(rows)  # numbers only; "Row N" in the message
    except ValueError as e:
        return _bad(str(e))
    bundle, _ = bundle_for_user(current_user())
    try:
        results = ml.predict_batch(bundle, rows)
    except ValueError as e:
        return _bad(str(e))
    return jsonify(results)


@ml_bp.post("/explain")
@token_required
def explain():
    """POST /api/explain  body: {"row": {...}, "predicted": 2}"""
    row, err = _get_row()
    if err:
        return err
    predicted = _json_body().get("predicted")
    if predicted is not None:
        try:
            predicted = int(predicted)
        except (TypeError, ValueError):
            return _bad('"predicted" must be a number from 1 to 4.')
        if predicted not in bridge.LABELS:
            return _bad('"predicted" must be a number from 1 to 4.')
    bundle, _ = bundle_for_user(current_user())
    try:
        result = bridge.explain_full(bundle, row, predicted)
    except ValueError as e:
        return _bad(str(e))
    return jsonify(result)


@ml_bp.post("/recommend")
@token_required
def recommend():
    """POST /api/recommend  body: {"row": {...}, "predicted": 2}"""
    row, err = _get_row()
    if err:
        return err
    predicted = _json_body().get("predicted")
    if predicted is not None:
        try:
            predicted = int(predicted)
        except (TypeError, ValueError):
            return _bad('"predicted" must be a number from 1 to 4.')
        if predicted not in bridge.LABELS:
            return _bad('"predicted" must be a number from 1 to 4.')
    bundle, _ = bundle_for_user(current_user())
    try:
        result = ml.recommend_row(bundle, row, predicted)
    except ValueError as e:
        return _bad(str(e))
    return jsonify(result)


# ---------------------------------------------------------------------------
# STEP 4: training (the user uploads a dataset)
@ml_bp.post("/train")
@token_required
def train():
    """POST /api/train  body: {"train": [rows], "test": [rows]}
    Returns the payload from ml.train_pipeline plus the new model id."""
    data = _json_body()
    train_rows = data.get("train")
    test_rows = data.get("test")
    if not isinstance(train_rows, list) or not isinstance(test_rows, list):
        return _bad('Body must be {"train": [rows], "test": [rows]}.')
    rows = list(train_rows) + list(test_rows)
    if not rows:
        return _bad("The dataset is empty.")
    limit = current_app.config["MAX_TRAIN_ROWS"]
    if len(rows) > limit:
        return _bad(f"Too many rows: {len(rows)}. The limit is {limit} rows.", 413)

    # Both parts come from the same uploaded file, so each part must contain
    # all required columns on its own (otherwise joining would hide a broken
    # file behind the valid part).
    required = set(ml.FEATURES + [bridge.TARGET])
    for part_name, part in (("train", train_rows), ("test", test_rows)):
        missing = sorted(required - set(pd.DataFrame(part).columns))
        if missing:
            msg = f'The "{part_name}" part is missing column(s): {", ".join(missing[:3])}.'
            TRAIN_STATUS.update({"state": "error", "error": msg})
            return _bad(msg)

    df = pd.concat([pd.DataFrame(train_rows), pd.DataFrame(test_rows)], ignore_index=True)
    user = current_user()
    started = time.time()
    TRAIN_STATUS.update({
        "state": "running", "progress": 0.1, "startedAt": _utcnow().isoformat(),
        "finishedAt": None, "durationS": None, "error": None, "modelId": None, "best": None,
    })
    try:
        payload, bundle = ml.train_pipeline(df)
    except ValueError as e:
        # invalid data - the front end shows this message on the Upload page
        TRAIN_STATUS.update({"state": "error", "error": str(e)})
        return _bad(str(e))
    except Exception as e:  # pragma: no cover - unexpected training error
        current_app.logger.exception("Training failed")
        TRAIN_STATUS.update({"state": "error", "error": "Training failed on the server."})
        return _bad("Training failed on the server.", 500)

    bridge.enrich_payload(payload)  # split.trainCount / testCount for the front end

    # Save the model: model_store/<user_id>/<model_id> (Step 4) and remember it.
    model_id = f"{_utcnow():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}"
    model_dir = os.path.join(current_app.config["MODEL_STORE_DIR"], str(user.id), model_id)
    ml.save_artifacts(bundle, payload, model_dir)

    best_row = next((m for m in payload["models"] if m["name"] == payload["best"]), None)
    record = Model(
        user_id=user.id,
        best_model=payload["best"],
        accuracy=(best_row or {}).get("accuracy"),
        file_path=model_dir,
        metrics=payload,
    )
    db.session.add(record)
    db.session.commit()
    with _CACHE_LOCK:
        _MODEL_CACHE[record.id] = bundle

    duration = round(time.time() - started, 2)
    TRAIN_STATUS.update({
        "state": "done", "progress": 1.0, "finishedAt": _utcnow().isoformat(),
        "durationS": duration, "modelId": record.id, "best": payload["best"],
    })
    current_app.logger.info("Training finished in %ss (user %s)", duration, user.id)
    # payload as returned by ml.train_pipeline, plus the model id for later use
    return jsonify({**payload, "modelId": record.id, "trainedAt": record.created_at.isoformat()}), 200


@ml_bp.get("/train/status")
@token_required
def train_status():
    """GET /api/train/status - info about the last training run."""
    return jsonify(TRAIN_STATUS)


@ml_bp.post("/datasets/validate")
@token_required
def validate_dataset_route():
    """POST /api/datasets/validate  body: {"rows": [...]} (optional route).
    Server-side copy of the front end's upload check - the front end check
    alone cannot be trusted."""
    data = _json_body()
    rows = data.get("rows") if isinstance(data, dict) else data
    if isinstance(rows, dict):      # also accept {"train": [...], "test": [...]}
        rows = rows.get("train") or rows.get("data") or []
    if not isinstance(rows, list) or not rows:
        return _bad('Body must be {"rows": [ ... ]} with at least one row.')
    df = pd.DataFrame(rows)
    return jsonify(ml.validate_dataset(df))

import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_session
from models import Analysis, DraftAnalysis
from routes.auth_routes import get_current_user

history_bp = Blueprint("history", __name__)

SAMPLE_ENTRIES = [
    {
        "id": "sample-1",
        "fileName": "sample_run_1.csv",
        "rows": 1451,
        "model": "Random Forest",
        "accuracy": 0.9347,
        "predicted": 3,
        "label": "Target",
        "confidence": 0.86,
        "topFeature": "ZUx - Cycle time",
        "sample": True,
    },
    {
        "id": "sample-2",
        "fileName": "sample_run_2.csv",
        "rows": 1180,
        "model": "Random Forest",
        "accuracy": 0.9211,
        "predicted": 2,
        "label": "Acceptable",
        "confidence": 0.71,
        "topFeature": "APVs - Specific injection pressure peak value",
        "sample": True,
    },
    {
        "id": "sample-3",
        "fileName": "sample_run_3.csv",
        "rows": 960,
        "model": "XGBoost",
        "accuracy": 0.9102,
        "predicted": 1,
        "label": "Waste",
        "confidence": 0.57,
        "topFeature": "Mold temperature",
        "sample": True,
    },
]

def seed_sample_history(session, email):
    for s in SAMPLE_ENTRIES:
        a = Analysis(
            id=f"{s['id']}-{email[:6]}",
            user_email=email,
            file_name=s["fileName"],
            row_count=s["rows"],
            model_name=s["model"],
            accuracy=s["accuracy"],
            predicted_class=s["predicted"],
            predicted_label=s["label"],
            confidence=s["confidence"],
            top_feature=s["topFeature"],
            is_sample=True,
            snapshot_json=None,
            created_at=datetime.utcnow()
        )
        session.add(a)
    session.commit()


def _safe_float(val, default=0.0):
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def _safe_int(val, default=0):
    try:
        return int(val) if val is not None else default
    except (ValueError, TypeError):
        return default

@history_bp.route("", methods=["GET"])
def get_history():
    user = get_current_user()
    email = user.get("email") if user else request.args.get("email", "guest@demo.com")
    email = str(email).lower().strip()

    session = get_session()
    try:
        items = session.query(Analysis).filter(Analysis.user_email == email).order_by(Analysis.created_at.desc()).all()
        return jsonify([item.to_dict() for item in items])
    finally:
        session.close()


@history_bp.route("", methods=["POST"])
def add_history():
    data = request.get_json() or {}
    user = get_current_user()
    email = user.get("email") if user else (request.args.get("email") or data.get("user_email") or data.get("email") or "guest@demo.com")
    email = str(email).lower().strip()

    entry_id = str(data.get("id") or "").strip()
    if not entry_id:
        import time, uuid
        entry_id = "h" + hex(int(time.time()))[2:] + uuid.uuid4().hex[:4]

    snapshot = data.get("snapshot")
    snapshot_str = json.dumps(snapshot) if snapshot else None

    row_count = _safe_int(data.get("rows") if data.get("rows") is not None else data.get("row_count"), 0)
    accuracy = _safe_float(data.get("accuracy"), 0.0)
    predicted_class = _safe_int(data.get("predicted") if data.get("predicted") is not None else data.get("predicted_class"), 3)
    predicted_label = str(data.get("label") or data.get("predicted_label") or "Target")
    confidence = _safe_float(data.get("confidence"), 0.0)
    top_feature = str(data.get("topFeature") or data.get("top_feature") or "")
    file_name = str(data.get("fileName") or data.get("file_name") or "analysis.csv")
    model_name = str(data.get("model") or data.get("model_name") or "Random Forest")
    is_sample = bool(data.get("sample", False))

    session = get_session()
    try:
        existing = session.query(Analysis).filter(Analysis.id == entry_id).first()
        if existing:
            existing.user_email = email
            existing.file_name = file_name
            existing.row_count = row_count
            existing.model_name = model_name
            existing.accuracy = accuracy
            existing.predicted_class = predicted_class
            existing.predicted_label = predicted_label
            existing.confidence = confidence
            existing.top_feature = top_feature
            if snapshot_str:
                existing.snapshot_json = snapshot_str
        else:
            item = Analysis(
                id=entry_id,
                user_email=email,
                file_name=file_name,
                row_count=row_count,
                model_name=model_name,
                accuracy=accuracy,
                predicted_class=predicted_class,
                predicted_label=predicted_label,
                confidence=confidence,
                top_feature=top_feature,
                is_sample=is_sample,
                snapshot_json=snapshot_str,
                created_at=datetime.utcnow()
            )
            session.add(item)
        session.commit()

        # Return updated list for this specific user
        all_items = session.query(Analysis).filter(Analysis.user_email == email).order_by(Analysis.created_at.desc()).all()
        return jsonify([it.to_dict() for it in all_items])
    except Exception as e:
        session.rollback()
        print(f"[DB] Error saving analysis: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@history_bp.route("/<entry_id>", methods=["GET"])
def get_entry(entry_id):
    user = get_current_user()
    email = user.get("email") if user else request.args.get("email", "guest@demo.com")
    email = email.lower().strip()

    session = get_session()
    try:
        item = session.query(Analysis).filter(Analysis.id == entry_id, Analysis.user_email == email).first()
        if not item:
            return jsonify({"error": "Analysis not found"}), 404
        return jsonify(item.to_dict())
    finally:
        session.close()


@history_bp.route("/<entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    user = get_current_user()
    email = user.get("email") if user else request.args.get("email", "guest@demo.com")
    email = email.lower().strip()

    session = get_session()
    try:
        session.query(Analysis).filter(Analysis.id == entry_id, Analysis.user_email == email).delete()
        session.commit()
        all_items = session.query(Analysis).filter(Analysis.user_email == email).order_by(Analysis.created_at.desc()).all()
        return jsonify([it.to_dict() for it in all_items])
    finally:
        session.close()


@history_bp.route("", methods=["DELETE"])
def clear_all():
    user = get_current_user()
    email = user.get("email") if user else request.args.get("email", "guest@demo.com")
    email = email.lower().strip()

    session = get_session()
    try:
        session.query(Analysis).filter(Analysis.user_email == email).delete()
        session.commit()
        return jsonify([])
    finally:
        session.close()


# ----------------------------------------------------------------------------
# Incomplete Analysis / Draft persistence endpoints
# ----------------------------------------------------------------------------
@history_bp.route("/draft", methods=["GET"])
def get_draft():
    user = get_current_user()
    email = user.get("email") if user else request.args.get("email", "guest@demo.com")
    email = str(email).lower().strip()

    session = get_session()
    try:
        draft = session.query(DraftAnalysis).filter(DraftAnalysis.user_email == email).first()
        if not draft:
            return jsonify(None)
        return jsonify(draft.to_dict())
    except Exception as e:
        print(f"[DB] Error loading draft: {e}")
        return jsonify(None)
    finally:
        session.close()


@history_bp.route("/draft", methods=["POST"])
def save_draft():
    user = get_current_user()
    data = request.get_json() or {}
    email = user.get("email") if user else (data.get("email") or request.args.get("email", "guest@demo.com"))
    email = str(email).lower().strip()

    file_name = str(data.get("fileName") or "analysis_dataset.csv")
    step = int(data.get("step") if data.get("step") is not None else 0)
    draft_state = data.get("state") or {}

    session = get_session()
    try:
        draft = session.query(DraftAnalysis).filter(DraftAnalysis.user_email == email).first()
        draft_str = json.dumps({"state": draft_state})
        if draft:
            draft.file_name = file_name
            draft.step = step
            draft.draft_json = draft_str
            draft.updated_at = datetime.utcnow()
        else:
            draft = DraftAnalysis(
                user_email=email,
                file_name=file_name,
                step=step,
                draft_json=draft_str,
                updated_at=datetime.utcnow(),
            )
            session.add(draft)
        session.commit()
        return jsonify({"success": True, "message": "Draft saved successfully."})
    except Exception as e:
        session.rollback()
        print(f"[DB] Error saving draft: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@history_bp.route("/draft", methods=["DELETE"])
def delete_draft():
    user = get_current_user()
    email = user.get("email") if user else request.args.get("email", "guest@demo.com")
    email = str(email).lower().strip()

    session = get_session()
    try:
        session.query(DraftAnalysis).filter(DraftAnalysis.user_email == email).delete()
        session.commit()
        return jsonify({"success": True, "message": "Draft cleared successfully."})
    except Exception as e:
        session.rollback()
        print(f"[DB] Error clearing draft: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

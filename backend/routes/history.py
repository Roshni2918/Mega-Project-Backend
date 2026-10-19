# STEP 5: saved analyses (history) in the database.
# Every route needs login and each user sees only their own rows.
import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from auth_utils import current_user, token_required
from models import Analysis, db

history_bp = Blueprint("history", __name__, url_prefix="/api/history")

MAX_ENTRIES = 25  # keep at most 25 entries per user (the front end does the same)


def _field(data, *names):
    """Accept both naming styles (file_name and fileName) from the front end."""
    for n in names:
        if n in data and data[n] is not None:
            return data[n]
    return None


def _parse_snapshot(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return None
    return value


def _parse_date(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except Exception:
        return None


@history_bp.get("")
@token_required
def list_history():
    """GET /api/history - list, newest first, snapshot left out (keeps it light)."""
    rows = (
        Analysis.query.filter_by(user_id=current_user().id)
        .order_by(Analysis.created_at.desc())
        .all()
    )
    return jsonify([r.to_row(include_snapshot=False) for r in rows])


@history_bp.post("")
@token_required
def add_history():
    """POST /api/history - body is one entry (field names of the table or camelCase).
    Keeps at most 25 entries per user and deletes the oldest."""
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Body must be one history entry (object)."}), 400

    entry = Analysis(
        user_id=current_user().id,
        file_name=str(_field(data, "file_name", "fileName") or "report")[:255],
        rows=int(_field(data, "rows") or 0),
        model=str(_field(data, "model") or "")[:50] or None,
        accuracy=_field(data, "accuracy"),
        predicted=_field(data, "predicted"),
        label=str(_field(data, "label") or "")[:30] or None,
        confidence=_field(data, "confidence"),
        top_feature=str(_field(data, "top_feature", "topFeature") or "")[:100] or None,
        snapshot=_parse_snapshot(_field(data, "snapshot")),
    )
    created = _parse_date(_field(data, "created_at", "date"))
    if created:
        entry.created_at = created

    db.session.add(entry)
    # keep only the newest 25 entries per user
    old = (
        Analysis.query.filter_by(user_id=entry.user_id)
        .order_by(Analysis.created_at.desc())
        .offset(MAX_ENTRIES)
        .all()
    )
    for row in old:
        db.session.delete(row)
    db.session.commit()

    return jsonify(entry.to_row(include_snapshot=False)), 201


@history_bp.get("/<entry_id>")
@token_required
def get_history(entry_id):
    """GET /api/history/<id> - one entry including the snapshot."""
    row = db.session.get(Analysis, entry_id)
    if row is None or row.user_id != current_user().id:
        return jsonify({"error": "History entry not found."}), 404
    return jsonify(row.to_row(include_snapshot=True))


@history_bp.delete("/<entry_id>")
@token_required
def delete_history(entry_id):
    """DELETE /api/history/<id> - delete one entry (only your own)."""
    row = db.session.get(Analysis, entry_id)
    if row is None or row.user_id != current_user().id:
        return jsonify({"error": "History entry not found."}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({"message": "Entry deleted."})


@history_bp.delete("")
@token_required
def clear_history():
    """DELETE /api/history - clear all history of this user."""
    deleted = Analysis.query.filter_by(user_id=current_user().id).delete()
    db.session.commit()
    return jsonify({"message": f"{deleted} entries deleted."})

# JWT helpers and the decorator that protects every route except
# /api/health, /api/auth/register and /api/auth/login.
import functools
from datetime import datetime, timezone

import jwt
from flask import current_app, g, jsonify, request

from models import User, db


def _now():
    return datetime.now(timezone.utc)


def create_token(user_id):
    """JWT with the user id, expires according to TOKEN_MINUTES (default 2 h).
    The "sub" claim must be a string (PyJWT validates this)."""
    payload = {"sub": str(user_id), "iat": _now(), "exp": _now() + current_app.config["JWT_EXPIRES"]}
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def decode_token(token):
    """Returns the user id or raises jwt.PyJWTError."""
    data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    return int(data["sub"])


def _extract_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def token_required(view):
    """Every other /api route needs  Authorization: Bearer <token>.
    A missing or expired token returns 401 and the front end logs the user out."""

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "Missing authorization token."}), 401
        try:
            user_id = decode_token(token)
        except Exception:
            # expired or invalid signature - same message, never leak details
            return jsonify({"error": "Invalid or expired token."}), 401
        user = db_get_user(user_id)
        if user is None:
            return jsonify({"error": "Invalid or expired token."}), 401
        g.user = user
        return view(*args, **kwargs)

    return wrapper


def db_get_user(user_id):
    from models import db

    return db.session.get(User, user_id)


def current_user():
    return getattr(g, "user", None)

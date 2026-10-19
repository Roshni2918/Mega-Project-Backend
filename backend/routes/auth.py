# STEP 1: register, login and the token check route.
import re
from datetime import datetime, timezone

import bcrypt
from flask import Blueprint, jsonify, request

from auth_utils import create_token, current_user, token_required
from models import User, db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


@auth_bp.post("/register")
def register():
    """POST /api/auth/register  body: {name, email, password}
    -> 201 {"message": "Account created", "user": {name, email, role}}"""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are all required."}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "Please enter a valid email address."}), 400
    if len(password) < 8:
        return jsonify({"error": "Your password must be at least 8 characters."}), 400

    exists = db.session.query(User.id).filter(User.email == email).first()
    if exists:
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(
        name=name[:100],
        email=email[:150],
        password_hash=_hash_password(password),
        role="Researcher",   # default role from the spec
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Account created", "user": user.to_public()}), 201


@auth_bp.post("/login")
def login():
    """POST /api/auth/login  body: {email, password}
    -> 200 {"token": "<JWT>", "user": {name, email, role}}"""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.session.query(User).filter(User.email == email).first()
    # Same message for a wrong email and a wrong password (never reveal which).
    if not user or not _check_password(password, user.password_hash):
        return jsonify({"error": "Invalid email or password."}), 401

    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()

    token = create_token(user.id)
    return jsonify({"token": token, "user": user.to_public()}), 200


@auth_bp.get("/me")
@token_required
def me():
    """GET /api/auth/me  (Authorization: Bearer <token>) -> current user"""
    user = current_user()
    return jsonify({"id": user.id, **user.to_public()}), 200

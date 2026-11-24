import jwt
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from config import Config
from database import get_session, check_pw, hash_pw
from models import User

auth_bp = Blueprint("auth", __name__)

def generate_token(user):
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.name,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif "token" in request.args:
        token = request.args.get("token")
    if not token:
        return None
    return decode_token(token)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", "")).strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    session = get_session()
    try:
        user = session.query(User).filter(User.email == email).first()
        if not user or not check_pw(password, user.password_hash):
            return jsonify({"error": "Invalid email or password."}), 401

        token = generate_token(user)
        return jsonify({
            "token": token,
            "user": {
                "name": user.name,
                "email": user.email,
                "role": user.role,
            }
        })
    finally:
        session.close()

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", "")).strip()
    confirm_password = str(data.get("confirmPassword") or data.get("confirm_password") or "").strip()
    role = str(data.get("role", "Process Engineer")).strip() or "Process Engineer"

    if not name:
        return jsonify({"error": "Full name is required."}), 400
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400
    if confirm_password and password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400

    session = get_session()
    try:
        existing = session.query(User).filter(User.email == email).first()
        if existing:
            return jsonify({"error": "An account with this email already exists. Please log in."}), 409

        new_user = User(
            name=name,
            email=email,
            password_hash=hash_pw(password),
            role=role,
            created_at=datetime.utcnow()
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)

        return jsonify({
            "message": "Account created successfully! Please sign in with your email and password.",
            "user": {
                "name": new_user.name,
                "email": new_user.email,
            }
        }), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500
    finally:
        session.close()

@auth_bp.route("/me", methods=["GET"])
def me():
    decoded = get_current_user()
    if not decoded:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": decoded})

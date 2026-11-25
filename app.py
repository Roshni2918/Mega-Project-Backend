import os
import sys
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import init_db
from routes.auth_routes import auth_bp
from routes.ml_routes import ml_bp, get_bundle
from routes.history_routes import history_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for React frontend (production Vercel domain)
    # Set CORS_ORIGINS env var on Render as comma-separated list; defaults to production frontend + localhost
    default_origins = [
        "https://injection-molding-quality.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    env_origins = os.getenv("CORS_ORIGINS", "")
    if env_origins:
        allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    else:
        allowed_origins = default_origins
    CORS(app, resources={r"/api/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
    }})

    # Initialize Database & Tables
    # Use try/except to prevent app crash if MySQL is unavailable during deployment
    # Database will be configured later (migration postponed)
    try:
        init_db()
    except Exception as e:
        print(f"[APP] Database initialization skipped (will be configured later): {type(e).__name__}")

    # Pre-load ML bundle
    bundle = get_bundle()
    if bundle:
        print(f"[APP] Ready with ML model: {bundle.get('best_name')}")
    else:
        print("[APP] Note: ML bundle will be trained or loaded on request.")

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(ml_bp, url_prefix="/api")
    app.register_blueprint(history_bp, url_prefix="/api/history")

    @app.route("/", methods=["GET"])
    def index():
        return jsonify({
            "service": "Injection Molding Quality Predictor API",
            "version": "1.0.0",
            "status": "online",
            "endpoints": [
                "/api/health",
                "/api/auth/login",
                "/api/train",
                "/api/predict",
                "/api/predict_batch",
                "/api/explain",
                "/api/recommend",
                "/api/history"
            ]
        })

    @app.route("/api/health", methods=["GET"])
    def health():
        b = get_bundle()
        # Determine database status with a real connection test
        db_status = "MySQL Disconnected"
        try:
            from database import _engine, _db_explicitly_configured
            from sqlalchemy import text
            if not _db_explicitly_configured:
                db_status = "MySQL Disconnected"
            elif _engine is not None:
                with _engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    db_status = "MySQL Connected"
            else:
                db_status = "MySQL Disconfigured"
        except Exception:
            db_status = "MySQL Disconfigured"
        
        return jsonify({
            "status": "degraded" if db_status == "MySQL Disconfigured" else "healthy",
            "database": db_status,
            "model_loaded": b is not None,
            "best_model": b.get("best_name") if b else None,
            "selected_features": b.get("selected_features") if b else None,
        })

    return app

if __name__ == "__main__":
    app = create_app()
    port = Config.PORT
    print(f"\n=======================================================")
    print(f" Injection Molding Backend API Running on http://localhost:{port}")
    print(f"=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=False)
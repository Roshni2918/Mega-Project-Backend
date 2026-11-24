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

    # Enable CORS for React frontend (default http://localhost:5173 and all origins)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize Database & Tables
    init_db()

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
        return jsonify({
            "status": "healthy",
            "database": "MySQL Connected",
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

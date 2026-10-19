# Injection Molding Quality Predictor - Flask backend.
#
#   python app.py          -> http://localhost:5000
#
# Steps of the requirements document implemented here:
#   Setup  : app, config, CORS, database, GET /api/health
#   Step 1 : register / login / me (routes/auth.py)
#   Step 2 : load the default ML model once at start + warm-up (ml/ml_pipeline.py)
#   Step 3 : predict, predict_batch, explain, recommend (routes/ml.py)
#   Step 4 : train, per-user model storage (routes/ml.py, model_store/)
#   Step 5 : history routes (routes/history.py)
#   Step 7 : bcrypt passwords, JWT, CORS for the front end only, one error
#            format {"error": "message"} everywhere, no secrets in the code
import logging
import os
import sys
import time

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from models import db

# Make the ml/ and routes/ folders importable when run as a script
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)

    # CORS: only the front end address (http://localhost:5173 by default)
    CORS(
        app,
        origins=app.config["CORS_ORIGINS"],
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "DELETE", "OPTIONS"],
    )

    db.init_app(app)

    from routes import auth_bp, history_bp, ml_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(ml_bp)
    app.register_blueprint(history_bp)

    # ------------------------------------------------------------------
    # STEP 2: load the default model once and warm it up (SHAP explainer)
    with app.app_context():
        db.create_all()
        _load_default_model(app)

    # ------------------------------------------------------------------
    # Step 7: same error format everywhere - {"error": "message"}
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(400)
    def e400(e):
        return jsonify({"error": getattr(e, "description", "Bad request.")}), 400

    @app.errorhandler(401)
    def e401(e):
        return jsonify({"error": getattr(e, "description", "Not logged in.")}), 401

    @app.errorhandler(404)
    def e404(e):
        return jsonify({"error": "Route not found."}), 404

    @app.errorhandler(405)
    def e405(e):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(413)
    def e413(e):
        mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify({"error": f"The upload is too large (max {mb} MB)."}), 413

    @app.errorhandler(Exception)
    def e500(e):
        # log the error, never passwords or tokens
        app.logger.exception("Server error")
        return jsonify({"error": "Server error."}), 500

    return app


def _load_default_model(app):
    """Load ml_artifacts once at start (never on every request). When the
    folder does not exist yet, train the default model once from the sample
    dataset - the same job the notebook does."""
    import ml.bridge as bridge
    import ml.ml_pipeline as ml

    artifacts = app.config["ARTIFACTS_DIR"]
    bundle_file = os.path.join(artifacts, "model_bundle.joblib")
    started = time.time()
    if os.path.exists(bundle_file):
        bundle = ml.load_bundle(artifacts)
        app.logger.info("Default model loaded in %.1fs", time.time() - started)
    else:
        csv = app.config["DEFAULT_DATASET"]
        if not os.path.exists(csv):
            raise RuntimeError(
                f"No default model in {artifacts} and no dataset at {csv}. "
                "Put the sample CSV there or run the notebook first."
            )
        app.logger.warning("ml_artifacts missing - training the default model once from %s", csv)
        payload, bundle = bridge.build_default_artifacts(csv, artifacts)
        app.logger.info(
            "Default model trained (%s, accuracy %.3f) in %.1fs",
            payload["best"],
            next(m["accuracy"] for m in payload["models"] if m["name"] == payload["best"]),
            time.time() - started,
        )

    # Warm up: build the SHAP explainer so the first user does not wait.
    warm = time.time()
    bridge.warm_up(bundle)
    app.logger.info("Warm-up done in %.1fs", time.time() - warm)
    app.extensions["default_bundle"] = bundle
    return bundle


# Created at import time so `flask run` and `python app.py` both work.
app = create_app()

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    # use_reloader=False: the reloader would load the ML model twice
    app.run(host="127.0.0.1", port=port, debug=debug, use_reloader=False)

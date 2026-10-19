# Route blueprints are registered in app.py.
from routes.auth import auth_bp
from routes.history import history_bp
from routes.ml import ml_bp

__all__ = ["auth_bp", "ml_bp", "history_bp"]

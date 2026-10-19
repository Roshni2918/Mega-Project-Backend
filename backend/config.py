# Application configuration. Everything comes from environment variables so no
# secret is ever committed. Copy .env.example to .env and edit it for your machine.
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


def _load_dotenv():
    """Tiny .env reader (no extra dependency). KEY=VALUE lines, # comments."""
    path = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


class Config:
    # --- Security -----------------------------------------------------------
    # In production set SECRET_KEY to a long random value, e.g.
    #   python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me-in-production")
    JWT_EXPIRES = timedelta(minutes=int(os.environ.get("TOKEN_MINUTES", "120")))

    # --- Database -----------------------------------------------------------
    # Default: SQLite file inside the backend folder (works with no setup).
    # To use MySQL (team decision) set for example:
    #   DATABASE_URL=mysql+pymysql://user:password@localhost:3306/injection_quality
    DATABASE_URL = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'app.db')}"
    )
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- CORS ---------------------------------------------------------------
    # The front end runs on http://localhost:5173 (vite).
    CORS_ORIGINS = [
        o.strip()
        for o in os.environ.get("CORS_ORIGIN", "http://localhost:5173").split(",")
        if o.strip()
    ]

    # --- ML / uploads -------------------------------------------------------
    ARTIFACTS_DIR = os.environ.get("ARTIFACTS_DIR", os.path.join(BASE_DIR, "ml_artifacts"))
    MODEL_STORE_DIR = os.environ.get("MODEL_STORE_DIR", os.path.join(BASE_DIR, "model_store"))
    # The default model is built from this CSV when ml_artifacts does not exist yet.
    DEFAULT_DATASET = os.environ.get(
        "DEFAULT_DATASET", os.path.join(BASE_DIR, "data", "sample_dataset.csv")
    )
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_MB", "50")) * 1024 * 1024
    MAX_BATCH_ROWS = int(os.environ.get("MAX_BATCH_ROWS", "5000"))
    MAX_TRAIN_ROWS = int(os.environ.get("MAX_TRAIN_ROWS", "60000"))

    ENV = os.environ.get("FLASK_ENV", "production")

# Database tables: users (Step 1), models (Step 4), analyses (Step 5).
import json
import uuid
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    # naive UTC (stored the same way in SQLite and MySQL, sortable in SQL)
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_analysis_id():
    # varchar(40) primary key for the analyses table (uuid hex = 32 chars)
    return uuid.uuid4().hex


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    # email is always saved in lower case and indexed (unique index)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="Researcher")
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)

    models = db.relationship("Model", backref="user", cascade="all, delete-orphan")
    analyses = db.relationship("Analysis", backref="user", cascade="all, delete-orphan")

    def to_public(self):
        return {"name": self.name, "email": self.email, "role": self.role}


class Model(db.Model):
    __tablename__ = "models"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    best_model = db.Column(db.String(50), nullable=False)
    accuracy = db.Column(db.Float, nullable=True)
    file_path = db.Column(db.String(255), nullable=False)
    metrics = db.Column(db.JSON, nullable=True)   # models list, confusion, perClass...
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


class Analysis(db.Model):
    __tablename__ = "analyses"

    id = db.Column(db.String(40), primary_key=True, default=new_analysis_id)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    file_name = db.Column(db.String(255))
    rows = db.Column(db.Integer)                  # number of rows after cleaning
    model = db.Column(db.String(50))
    accuracy = db.Column(db.Float)
    predicted = db.Column(db.Integer)
    label = db.Column(db.String(30))
    confidence = db.Column(db.Float)
    top_feature = db.Column(db.String(100))
    snapshot = db.Column(db.JSON, nullable=True)  # everything needed to rebuild the PDF

    def to_row(self, include_snapshot=False):
        """Both naming styles so the front end can keep using camelCase."""
        # stored timestamps are naive UTC; the trailing Z tells the browser
        created = (self.created_at.isoformat() + "Z") if self.created_at else None
        data = {
            "id": self.id,
            "date": created,            # front end reads entry.date
            "created_at": created,      # spec name
            "fileName": self.file_name,
            "file_name": self.file_name,
            "rows": self.rows,
            "model": self.model,
            "accuracy": self.accuracy,
            "predicted": self.predicted,
            "label": self.label,
            "confidence": self.confidence,
            "topFeature": self.top_feature,
            "top_feature": self.top_feature,
            "sample": False,
        }
        if include_snapshot:
            snap = self.snapshot
            if isinstance(snap, str):
                try:
                    snap = json.loads(snap)
                except Exception:
                    snap = None
            data["snapshot"] = snap
        return data

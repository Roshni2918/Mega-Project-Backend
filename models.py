from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import declarative_base

Base = declarative_base()
JsonTextType = Text().with_variant(LONGTEXT, "mysql")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(64), nullable=False, default="Process Engineer")
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
        }


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String(64), primary_key=True)
    user_email = Column(String(128), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    row_count = Column(Integer, default=0)
    model_name = Column(String(64), nullable=False)
    accuracy = Column(Float, default=0.0)
    predicted_class = Column(Integer, nullable=False)
    predicted_label = Column(String(64), nullable=False)
    confidence = Column(Float, default=0.0)
    top_feature = Column(String(128), default="")
    is_sample = Column(Boolean, default=False)
    snapshot_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        snapshot = None
        if self.snapshot_json:
            try:
                snapshot = json.loads(self.snapshot_json)
            except Exception:
                snapshot = None
        return {
            "id": self.id,
            "date": self.created_at.isoformat(),
            "fileName": self.file_name,
            "rows": self.row_count,
            "model": self.model_name,
            "accuracy": self.accuracy,
            "predicted": self.predicted_class,
            "label": self.predicted_label,
            "confidence": self.confidence,
            "topFeature": self.top_feature,
            "sample": self.is_sample,
            "snapshot": snapshot,
        }


class PredictionLog(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_email = Column(String(128), nullable=True)
    parameters_json = Column(Text, nullable=False)
    predicted_class = Column(Integer, nullable=False)
    predicted_label = Column(String(64), nullable=False)
    confidence = Column(Float, nullable=False)
    probabilities_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DraftAnalysis(Base):
    __tablename__ = "draft_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_email = Column(String(128), unique=True, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    step = Column(Integer, default=0)
    draft_json = Column(JsonTextType, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        import json
        draft_data = {}
        if self.draft_json:
            try:
                draft_data = json.loads(self.draft_json)
            except Exception:
                draft_data = {}
        return {
            "fileName": self.file_name,
            "step": self.step,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else datetime.utcnow().isoformat(),
            "state": draft_data.get("state", draft_data),
        }

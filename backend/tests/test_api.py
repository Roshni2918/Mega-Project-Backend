# Basic tests for auth, predict and train (Step 7 of the requirements).
# Run from the backend folder:  .venv\Scripts\python.exe -m pytest tests -v
import os
import sys
import tempfile

import pandas as pd
import pytest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND_DIR)

from app import create_app  # noqa: E402
from models import db as sqla  # noqa: E402

TEST_DB = os.path.join(tempfile.gettempdir(), "imq_test.db")
DATA_DIR = os.path.join(BACKEND_DIR, "..", "test-data")


# The app (with the default model from ml_artifacts) is created once per run
# because loading the model takes a few seconds.
@pytest.fixture(scope="module")
def app():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    application = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{TEST_DB}",
    })
    yield application
    try:
        os.remove(TEST_DB)
    except OSError:
        pass


@pytest.fixture()
def client(app):
    with app.app_context():
        sqla.create_all()
    return app.test_client()


@pytest.fixture(scope="module")
def sample_row():
    df = pd.read_csv(os.path.join(DATA_DIR, "1_valid_dataset.csv"), sep=None, engine="python")
    return {c: float(df[c].iloc[0]) for c in df.columns if c != "quality"}, df


def register(client, email="tester@example.com", password="Password123", name="Tester"):
    return client.post("/api/auth/register", json={"name": name, "email": email, "password": password})


def login(client, email="tester@example.com", password="Password123"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def auth_header(client, email="tester@example.com", password="Password123", name="Tester"):
    # register first (a 409 "already exists" is fine) and then log in
    register(client, email=email, password=password, name=name)
    token = login(client, email=email, password=password).get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Setup
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# STEP 1: register and login
def test_register_and_login(client):
    r = register(client)
    assert r.status_code == 201
    body = r.get_json()
    assert body["message"] == "Account created"
    assert body["user"]["role"] == "Researcher"      # default role
    assert "password" not in str(body).lower()

    r = login(client)
    assert r.status_code == 200
    body = r.get_json()
    assert body["token"]
    assert body["user"]["email"] == "tester@example.com"


def test_register_validation(client):
    assert register(client, email="not-an-email").status_code == 400
    assert register(client, password="short").status_code == 400
    assert register(client, name="").status_code == 400
    # email already used
    register(client, email="dup@example.com")
    r = register(client, email="dup@example.com")
    assert r.status_code == 409
    # email comparison ignores case
    r = register(client, email="DUP@example.com")
    assert r.status_code == 409


def test_login_wrong_password_same_message(client):
    register(client, email="msg@example.com", password="Password123")
    wrong_pw = client.post("/api/auth/login", json={"email": "msg@example.com", "password": "WrongPass1"})
    wrong_email = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "Password123"})
    assert wrong_pw.status_code == wrong_email.status_code == 401
    # never reveal which one was wrong
    assert wrong_pw.get_json()["error"] == wrong_email.get_json()["error"]


# ---------------------------------------------------------------------------
# STEP 1.4: everything else needs a token
def test_protected_routes_reject_missing_token(client, sample_row):
    row, _ = sample_row
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/predict", json={"row": row}).status_code == 401
    assert client.post("/api/train", json={"train": [], "test": []}).status_code == 401
    assert client.get("/api/history").status_code == 401
    # a broken token is also rejected
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_me(client):
    r = client.get("/api/auth/me", headers=auth_header(client))
    assert r.status_code == 200
    assert r.get_json()["email"] == "tester@example.com"


# ---------------------------------------------------------------------------
# STEP 3: prediction endpoints
def test_predict(client, sample_row):
    row, _ = sample_row
    r = client.post("/api/predict", json={"row": row}, headers=auth_header(client))
    assert r.status_code == 200
    body = r.get_json()
    assert body["predicted"] in (1, 2, 3, 4)
    assert body["label"] in ("Waste", "Acceptable", "Target", "Inefficient")
    assert 0.0 <= body["confidence"] <= 1.0
    assert [p["key"] for p in body["probabilities"]] == [1, 2, 3, 4]
    assert abs(sum(p["probability"] for p in body["probabilities"]) - 1.0) < 0.01


def test_predict_bad_rows(client, sample_row):
    row, _ = sample_row
    h = auth_header(client)
    bad = dict(row)
    del bad["ZUx - Cycle time"]
    assert client.post("/api/predict", json={"row": bad}, headers=h).status_code == 400
    bad2 = dict(row)
    bad2["ZUx - Cycle time"] = "hot"
    assert client.post("/api/predict", json={"row": bad2}, headers=h).status_code == 400
    assert client.post("/api/predict", json={}, headers=h).status_code == 400


def test_predict_batch(client, sample_row):
    row, _ = sample_row
    h = auth_header(client)
    r = client.post("/api/predict_batch", json={"rows": [row, row]}, headers=h)
    assert r.status_code == 200
    assert len(r.get_json()) == 2
    # a row with a missing value is rejected with the row number in the message
    bad = dict(row)
    del bad["SVo - Shot volume"]
    r = client.post("/api/predict_batch", json={"rows": [row, bad]}, headers=h)
    assert r.status_code == 400
    assert "Row 2" in r.get_json()["error"]
    # too many rows
    r = client.post("/api/predict_batch", json={"rows": [row] * 5001}, headers=h)
    assert r.status_code == 413


def test_explain_and_recommend(client, sample_row):
    row, _ = sample_row
    h = auth_header(client)
    pred = client.post("/api/predict", json={"row": row}, headers=h).get_json()["predicted"]

    r = client.post("/api/explain", json={"row": row, "predicted": pred}, headers=h)
    assert r.status_code == 200
    items = r.get_json()
    assert len(items) == 13
    assert [abs(i["value"]) for i in items] == sorted((abs(i["value"]) for i in items), reverse=True)
    assert abs(sum(abs(i["share"]) for i in items) - 100.0) < 1.0

    r = client.post("/api/recommend", json={"row": row, "predicted": pred}, headers=h)
    assert r.status_code == 200
    body = r.get_json()
    assert isinstance(body["alreadyBest"], bool)
    assert 0 < len(body["recs"]) <= 6
    for rec in body["recs"]:
        assert rec["action"] in ("increase", "decrease", "keep")
    assert body["afterPrediction"]["predicted"] in (1, 2, 3, 4)


# ---------------------------------------------------------------------------
# STEP 4: training with an uploaded dataset
def test_train_and_use_user_model(client, sample_row):
    row, df = sample_row
    h = auth_header(client, email="trainer@example.com")
    train = df.head(150).to_dict("records")
    test = df.iloc[150:190].to_dict("records")
    r = client.post("/api/train", json={"train": train, "test": test}, headers=h)
    assert r.status_code == 200
    payload = r.get_json()
    assert len(payload["models"]) == 7
    assert payload["best"] in [m["name"] for m in payload["models"]]
    matrix = payload["confusion"]["matrix"]
    # one cell per test row (cleaning may drop duplicates before the split)
    assert sum(sum(r_) for r_ in matrix) == payload["split"]["testCount"] > 0
    assert payload["modelId"]

    # the status route reports the last run (still the successful one here)
    status = client.get("/api/train/status", headers=h).get_json()
    assert status["state"] == "done"
    assert status["durationS"]

    # invalid uploads must be rejected with a clear message
    bad_df = pd.read_csv(os.path.join(DATA_DIR, "3_invalid_wrong_column_name.csv"), sep=None, engine="python")
    r = client.post("/api/train", json={"train": bad_df.to_dict("records"), "test": test}, headers=h)
    assert r.status_code == 400
    assert "missing" in r.get_json()["error"].lower()
    # the failed run is visible in the status route too
    assert client.get("/api/train/status", headers=h).get_json()["state"] == "error"

    # after training, prediction still works (now with the user's own model)
    r = client.post("/api/predict", json={"row": row}, headers=h)
    assert r.status_code == 200


def test_datasets_validate(client, sample_row):
    _, df = sample_row
    h = auth_header(client)
    r = client.post("/api/datasets/validate", json={"rows": df.head(120).to_dict("records")}, headers=h)
    assert r.status_code == 200
    assert r.get_json()["ok"] is True

    bad = pd.read_csv(os.path.join(DATA_DIR, "5_invalid_quality_labels.csv"), sep=None, engine="python")
    r = client.post("/api/datasets/validate", json={"rows": bad.to_dict("records")}, headers=h)
    assert r.get_json()["ok"] is False
    assert r.get_json()["errors"]

    few = pd.read_csv(os.path.join(DATA_DIR, "7_invalid_too_few_rows.csv"), sep=None, engine="python")
    r = client.post("/api/datasets/validate", json={"rows": few.to_dict("records")}, headers=h)
    assert r.get_json()["ok"] is False
    assert "100" in " ".join(r.get_json()["errors"])


# ---------------------------------------------------------------------------
# STEP 5: history (each user sees only their own rows)
def test_history_flow(client):
    h = auth_header(client, email="history@example.com")
    entry = {
        "fileName": "run_1.csv", "rows": 120, "model": "Random Forest",
        "accuracy": 0.93, "predicted": 3, "label": "Target", "confidence": 0.86,
        "topFeature": "ZUx - Cycle time", "date": "2026-01-01T10:00:00.000Z",
        "snapshot": {"training": {"best": "Random Forest"}},
    }
    r = client.post("/api/history", json=entry, headers=h)
    assert r.status_code == 201
    entry_id = r.get_json()["id"]

    r = client.get("/api/history", headers=h)
    assert r.status_code == 200
    rows = r.get_json()
    assert rows[0]["fileName"] == "run_1.csv"
    assert rows[0]["date"].startswith("2026-01-01")
    assert "snapshot" not in rows[0]             # kept out of the list

    r = client.get(f"/api/history/{entry_id}", headers=h)
    assert r.status_code == 200
    assert r.get_json()["snapshot"]["training"]["best"] == "Random Forest"

    # another user cannot read or delete this entry
    h2 = auth_header(client, email="other@example.com")
    assert client.get(f"/api/history/{entry_id}", headers=h2).status_code == 404
    assert client.delete(f"/api/history/{entry_id}", headers=h2).status_code == 404

    assert client.delete(f"/api/history/{entry_id}", headers=h).status_code == 200
    assert client.get(f"/api/history/{entry_id}", headers=h).status_code == 404
    assert client.get("/api/history", headers=h).get_json() == []


def test_history_keeps_only_25(client):
    h = auth_header(client, email="many@example.com")
    for i in range(30):
        client.post("/api/history", json={"fileName": f"run_{i}.csv", "rows": i}, headers=h)
    rows = client.get("/api/history", headers=h).get_json()
    assert len(rows) == 25
    assert rows[0]["fileName"] == "run_29.csv"   # newest kept


# ---------------------------------------------------------------------------
# STEP 7: error format everywhere
def test_error_format(client):
    r = client.get("/api/no-such-route")
    assert r.status_code == 404
    assert "error" in r.get_json()

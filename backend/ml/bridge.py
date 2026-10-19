# bridge.py - the glue between the Flask routes and the team's ml_pipeline.py
# (which is a verbatim copy of D:\ml_final\ml_pipeline.py, the single source of
# truth shared with the research notebook).
#
# Everything here is a *backend concern* - nothing machine-learning-related:
#   clean_row / clean_rows   HTTP input check: 13 features, must be numbers
#                            (ValueError -> routes answer {"error": ...} 400)
#   explain_full             the model only uses its selected features, but the
#                            front end lists all 13 - the ignored ones get 0
#   enrich_payload           a few extra split fields the tests/front end read
#   build_default_artifacts  the notebook's job, once at first start
#   warm_up                  builds the SHAP explainer so user 1 does not wait
#
# When the team updates ml_pipeline.py, copy the new file over this package and
# leave bridge.py (and the routes) alone.
import math

import ml.ml_pipeline as ml

# The routes speak "TARGET" and "LABELS"; the team's file uses TARGET_COL and
# CLASS_LABELS. Same values, one place to adapt.
TARGET = ml.TARGET_COL
LABELS = sorted(ml.CLASS_LABELS)


# ---------------------------------------------------------------------------
# HTTP input validation
def clean_row(row, where=""):
    """One JSON row -> dict of 13 floats. Raises ValueError with a clear
    message when a feature is missing or not a number."""
    if not isinstance(row, dict):
        raise ValueError(f'{where}Body must contain an object with the 13 features.')
    values = {}
    for f in ml.FEATURES:
        if f not in row or row[f] is None or row[f] == "":
            raise ValueError(f"{where}Missing feature: {f}")
        try:
            v = float(row[f])
        except (TypeError, ValueError):
            raise ValueError(f"{where}Feature '{f}' must be a number.")
        if not math.isfinite(v):  # NaN / Infinity are not valid inputs
            raise ValueError(f"{where}Feature '{f}' must be a number.")
        values[f] = v
    return values


def clean_rows(rows):
    """Same as clean_row for a list; the message names the row (1 based)."""
    return [clean_row(r, where=f"Row {i + 1}: ") for i, r in enumerate(rows)]


# ---------------------------------------------------------------------------
# Explanations
def explain_full(bundle, row, predicted=None):
    """SHAP explanation for all 13 features. The model only uses its selected
    features, so the others get a SHAP value of exactly 0 (they cannot
    influence the prediction) - the front end shows the full parameter list."""
    items = ml.explain_row(bundle, row, predicted)
    by_feature = {i["feature"]: i for i in items}
    out = []
    for f in ml.FEATURES:
        if f in by_feature:
            out.append(by_feature[f])
        else:
            out.append({
                "feature": f,
                "unit": ml.UNITS.get(f, ""),
                "actual": float(row[f]) if f in row else None,
                "value": 0.0,
                "share": 0.0,
            })
    out.sort(key=lambda i: abs(i["value"]), reverse=True)
    return out


# ---------------------------------------------------------------------------
# Training payload extras
def enrich_payload(payload):
    """The team's payload keeps its own split names; the tests and the front
    end also read trainCount / testCount (same numbers)."""
    split = payload.get("split") or {}
    payload["split"] = {
        "trainCount": split.get("train"),
        "testCount": split.get("test"),
        "testSize": 0.2,
        "seed": ml.RANDOM_STATE,
        "stratified": True,
        **split,
    }
    return payload


# ---------------------------------------------------------------------------
# Server startup helpers
def build_default_artifacts(csv_path, artifacts_dir):
    """Train the default model from the sample dataset and write
    ml_artifacts/ - the same job the notebook does. Runs once, at first start
    (or after deleting the folder)."""
    df = ml.load_dataset(csv_path)
    payload, bundle = ml.train_pipeline(df)
    # same split as inside the pipeline (same seed) -> one sample cycle per class
    clean, _ = ml.clean_dataset(df)
    _, X_test, _, y_test = ml.split_data(clean)
    ml.save_artifacts(bundle, payload, artifacts_dir, X_test, y_test)
    return payload, bundle


def warm_up(bundle):
    """Predict + explain one sample row so the SHAP explainer exists before
    the first user asks for it."""
    ranges = bundle.get("feature_range") or {}
    row = {}
    for f in ml.FEATURES:
        lo, hi = ranges.get(f) or (0.0, 1.0)
        row[f] = float(lo + hi) / 2.0
    try:
        predicted = ml.predict_row(bundle, row)["predicted"]
        explain_full(bundle, row, predicted)
    except Exception as e:  # pragma: no cover - warm-up must never block start
        print(f"[ml] warm-up skipped: {e}")
    return bundle

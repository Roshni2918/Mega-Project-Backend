"""
ml_pipeline.py
==============
Machine learning code for the Injection Molding Quality Predictor.

One source of truth for:
  - the Jupyter notebook (research / paper results)
  - the Flask backend (upload check, training, prediction, SHAP explanation, recommendations)

Every function that the backend calls returns plain Python dicts and lists
(JSON friendly) in the same shape the React front end already expects.
"""
import json
import os
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import f_classif, mutual_info_classif
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

warnings.filterwarnings("ignore")

# ----------------------------------------------------------------------------
# 1. Project settings (change them here only)
# ----------------------------------------------------------------------------
RANDOM_STATE = 42
TARGET_COL = "quality"
TOP_K = 6  # number of features kept (your guide asked for 5 to 6)

# !!! VERIFY THIS AGAINST THE DATASET DOCUMENTATION !!!
# This is the mapping used by the front end and by the first project notebook
# (370 Waste, 406 Acceptable, 310 Target, 365 Inefficient).
# Another notebook used a different order, so please confirm it once.
CLASS_LABELS = {1: "Waste", 2: "Acceptable", 3: "Target", 4: "Inefficient"}
TARGET_CLASS = 3  # the "best" quality class used by the recommendations

# Feature order is a contract with the front end. Do not change it.
FEATURES = [
    "Melt temperature",
    "Mold temperature",
    "time_to_fill",
    "ZDx - Plasticizing time",
    "ZUx - Cycle time",
    "SKx - Closing force",
    "SKs - Clamping force peak value",
    "Ms - Torque peak value current cycle",
    "Mm - Torque mean value current cycle",
    "APSs - Specific back pressure peak value",
    "APVs - Specific injection pressure peak value",
    "CPn - Screw position at the end of hold pressure",
    "SVo - Shot volume",
]

# Units are typical guesses. Check them against your dataset documentation.
UNITS = {
    "Melt temperature": "°C",
    "Mold temperature": "°C",
    "time_to_fill": "s",
    "ZDx - Plasticizing time": "s",
    "ZUx - Cycle time": "s",
    "SKx - Closing force": "kN",
    "SKs - Clamping force peak value": "kN",
    "Ms - Torque peak value current cycle": "Nm",
    "Mm - Torque mean value current cycle": "Nm",
    "APSs - Specific back pressure peak value": "bar",
    "APVs - Specific injection pressure peak value": "bar",
    "CPn - Screw position at the end of hold pressure": "mm",
    "SVo - Shot volume": "cm³",
}

# Value range of the original dataset (used to check units of uploaded files).
FEATURE_RANGES = {
    "Melt temperature": (81.747, 155.032),
    "Mold temperature": (78.409, 82.159),
    "time_to_fill": (6.084, 11.232),
    "ZDx - Plasticizing time": (2.78, 6.61),
    "ZUx - Cycle time": (74.78, 75.79),
    "SKx - Closing force": (876.7, 930.6),
    "SKs - Clamping force peak value": (894.8, 946.5),
    "Ms - Torque peak value current cycle": (94.2, 130.3),
    "Mm - Torque mean value current cycle": (76.5, 114.9),
    "APSs - Specific back pressure peak value": (144.8, 150.5),
    "APVs - Specific injection pressure peak value": (780.5, 943.0),
    "CPn - Screw position at the end of hold pressure": (8.33, 9.06),
    "SVo - Shot volume": (18.51, 19.23),
}

MODEL_NAMES = [
    "Logistic Regression",
    "Decision Tree",
    "SVM",
    "Random Forest",
    "XGBoost",
    "LightGBM",
    "CatBoost",
]
TREE_MODELS = {"Decision Tree", "Random Forest", "XGBoost", "LightGBM", "CatBoost"}


def class_label(k):
    return CLASS_LABELS.get(int(k), str(k))


# ----------------------------------------------------------------------------
# 2. Loading, checking and cleaning data
# ----------------------------------------------------------------------------
def load_dataset(path):
    """Reads a CSV file. The separator (; or , or tab) is detected automatically."""
    return pd.read_csv(path, sep=None, engine="python")


def _norm(s):
    return " ".join(str(s).lower().split())


def validate_dataset(df, require_target=True, min_rows=100):
    """
    Same rules as the upload page of the front end.
    Returns {"ok": bool, "errors": [...], "warnings": [...], "columns": [...]}
    """
    errors, warnings_, checks = [], [], []
    cols = [str(c).strip() for c in df.columns]
    needed = FEATURES + ([TARGET_COL] if require_target else [])

    for m in needed:
        if m not in cols:
            close = next((c for c in cols if _norm(c) == _norm(m)), None)
            errors.append(
                f'Column "{close}" must be written exactly as "{m}".' if close else f'Required column "{m}" is missing.'
            )
    extra = [c for c in cols if c not in FEATURES + [TARGET_COL] and not any(_norm(c) == _norm(m) for m in FEATURES + [TARGET_COL])]
    if extra:
        warnings_.append("Extra columns will be ignored: " + ", ".join(extra))
    if len(df) < min_rows:
        errors.append(f"At least {min_rows} rows are needed. Your file has {len(df)}.")

    for f in FEATURES:
        status, note = "ok", "OK"
        if f not in cols:
            checks.append({"name": f, "status": "fail", "note": "Column missing"})
            continue
        raw = pd.to_numeric(df[f].astype(str).str.replace(",", ".", regex=False), errors="coerce")
        non_empty = df[f].astype(str).str.strip().ne("") & df[f].notna()
        bad = int((raw.isna() & non_empty).sum())
        if bad:
            status, note = "fail", f"{bad} value(s) are not numbers"
            errors.append(f'"{f}" has {bad} non-numeric value(s).')
        else:
            valid = raw.dropna()
            if valid.empty:
                status, note = "fail", "No values"
                errors.append(f'"{f}" has no values.')
            else:
                lo_r, hi_r = FEATURE_RANGES[f]
                margin = (hi_r - lo_r) * 0.1
                lo, hi = lo_r - margin, hi_r + margin
                med = float(valid.median())
                outside = float(((valid < lo) | (valid > hi)).mean())
                if med < lo or med > hi:
                    status, note = "fail", f"Median {med:.2f} is outside the expected range. Check the unit."
                    errors.append(f'"{f}": values look like a different unit (median {med:.2f}, expected {lo_r} to {hi_r} {UNITS[f]}).')
                elif outside > 0.1:
                    status, note = "warn", f"{outside * 100:.0f}% of values are outside the usual range"
                    warnings_.append(f'"{f}": {outside * 100:.0f}% of values are outside the usual range.')
        checks.append({"name": f, "status": status, "note": note})

    if TARGET_COL in cols and (require_target or True):
        lab = pd.to_numeric(df[TARGET_COL], errors="coerce")
        badn = int((~lab.isin(list(CLASS_LABELS))).sum())
        if badn:
            errors.append(f'"{TARGET_COL}" must contain only {sorted(CLASS_LABELS)}. {badn} row(s) are invalid.')
    return {"ok": not errors, "errors": errors, "warnings": warnings_, "columns": checks}


def clean_dataset(df):
    """
    Cleans an uploaded dataset like the notebook does.
    Returns (clean_df, steps) where steps is a list of {"title", "status", "detail"}.
    """
    steps = []
    data = df[FEATURES + [TARGET_COL]].copy()
    for c in data.columns:
        data[c] = pd.to_numeric(data[c].astype(str).str.replace(",", ".", regex=False), errors="coerce")
    start = len(data)

    # missing values
    no_target = int(data[TARGET_COL].isna().sum())
    data = data[data[TARGET_COL].notna()]
    miss = int(data[FEATURES].isna().sum().sum())
    if miss:
        data[FEATURES] = data[FEATURES].fillna(data[FEATURES].median())
    steps.append({
        "title": "Missing values",
        "status": "ok" if miss + no_target == 0 else "fixed",
        "detail": "No missing values found." if miss + no_target == 0
        else f"{miss} missing input value(s) filled with the column median. {no_target} row(s) without a quality label removed.",
    })

    # duplicates
    dups = int(data.duplicated().sum())
    data = data.drop_duplicates()
    steps.append({
        "title": "Duplicate records",
        "status": "ok" if dups == 0 else "fixed",
        "detail": "No duplicate rows found." if dups == 0 else f"{dups} duplicate row(s) removed.",
    })

    # data type of the target
    data[TARGET_COL] = data[TARGET_COL].astype(int)
    steps.append({"title": "Target type", "status": "ok", "detail": "Target converted from float to integer class labels."})

    # constant features
    const = [c for c in FEATURES if data[c].std() == 0]
    steps.append({
        "title": "Constant features",
        "status": "warn" if const else "ok",
        "detail": f"Constant features (no information): {', '.join(const)}." if const else "No constant features found.",
    })

    # outliers are only reported, never removed
    steps.append({
        "title": "Outliers (IQR method)",
        "status": "ok",
        "detail": "Outliers are kept. This is real factory data, so extreme values are normal process variation.",
    })

    # class balance
    counts = data[TARGET_COL].value_counts()
    balanced = len(counts) > 0 and counts.min() > 0 and counts.max() / counts.min() < 2
    steps.append({
        "title": "Class balance",
        "status": "ok" if balanced else "warn",
        "detail": "Classes are balanced. No resampling needed." if balanced else "Classes are imbalanced. Consider resampling.",
    })
    data = data.reset_index(drop=True)
    return data, steps


def outlier_summary(df):
    """IQR outlier count per feature (report only)."""
    rows = []
    for c in FEATURES:
        q1, q3 = df[c].quantile(0.25), df[c].quantile(0.75)
        iqr = q3 - q1
        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        n = int(((df[c] < lo) | (df[c] > hi)).sum())
        rows.append({"Feature": c, "Outliers": n, "Percent": round(n / len(df) * 100, 2), "Lower": round(lo, 3), "Upper": round(hi, 3)})
    return pd.DataFrame(rows).sort_values("Outliers", ascending=False).reset_index(drop=True)


def split_data(df, test_size=0.2):
    """Stratified 80/20 split. Done BEFORE scaling and feature selection (no leakage)."""
    X, y = df[FEATURES], df[TARGET_COL]
    return train_test_split(X, y, test_size=test_size, random_state=RANDOM_STATE, stratify=y)


# ----------------------------------------------------------------------------
# 3. Feature selection (training data only)
# ----------------------------------------------------------------------------
def rank_features(X_train, y_train):
    """
    Ranks features with 4 methods: ANOVA F-score, Mutual Information,
    absolute Pearson correlation with the target, Random Forest importance.
    The 4 ranks are averaged into one final ranking (lower = better).
    """
    scores = pd.DataFrame(index=X_train.columns)
    scores["anova_f"] = f_classif(X_train, y_train)[0]
    scores["mutual_info"] = mutual_info_classif(X_train, y_train, random_state=RANDOM_STATE)
    scores["abs_pearson"] = [abs(np.corrcoef(X_train[c], y_train)[0, 1]) for c in X_train.columns]
    rf = RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE, n_jobs=-1).fit(X_train, y_train)
    scores["rf_importance"] = rf.feature_importances_
    ranks = scores.rank(ascending=False).add_prefix("rank_")
    out = pd.concat([scores, ranks], axis=1)
    out["avg_rank"] = ranks.mean(axis=1)
    out = out.sort_values("avg_rank").reset_index().rename(columns={"index": "feature"})
    out.index = out.index + 1
    return out


def choose_k(ranking, X_train, y_train, ks=(4, 5, 6, 8, 10, 13), cv_splits=5):
    """Cross-validation on the training set only: how many top features are enough?"""
    skf = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=RANDOM_STATE)
    order = ranking["feature"].tolist()
    rows = []
    for k in ks:
        feats = order[:k]
        rf = cross_val_score(RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1),
                             X_train[feats], y_train, cv=skf, scoring="f1_macro")
        lr = cross_val_score(Pipeline([("s", StandardScaler()), ("c", LogisticRegression(max_iter=2000))]),
                             X_train[feats], y_train, cv=skf, scoring="f1_macro")
        rows.append({"top_k": k, "rf_f1_cv": rf.mean(), "rf_f1_std": rf.std(), "lr_f1_cv": lr.mean(), "lr_f1_std": lr.std()})
    return pd.DataFrame(rows)


# ----------------------------------------------------------------------------
# 4. Models
# ----------------------------------------------------------------------------
class ZeroBasedClassifier(BaseEstimator, ClassifierMixin):
    """Lets XGBoost (needs labels 0,1,2,3) work with our labels 1,2,3,4 without manual +1 / -1."""

    def __init__(self, estimator=None):
        self.estimator = estimator

    def fit(self, X, y):
        self.classes_ = np.sort(np.unique(y))
        self.estimator_ = clone(self.estimator).fit(X, np.searchsorted(self.classes_, y))
        return self

    def predict(self, X):
        return self.classes_[np.asarray(self.estimator_.predict(X)).astype(int).ravel()]

    def predict_proba(self, X):
        return self.estimator_.predict_proba(X)


def build_models():
    """The 7 models of the project. Fixed settings (no tuning)."""
    from catboost import CatBoostClassifier
    from lightgbm import LGBMClassifier
    from xgboost import XGBClassifier

    return {
        "Logistic Regression": Pipeline([("scaler", StandardScaler()),
                                         ("clf", LogisticRegression(max_iter=2000, random_state=RANDOM_STATE))]),
        "Decision Tree": DecisionTreeClassifier(max_depth=12, min_samples_split=4, random_state=RANDOM_STATE),
        "SVM": Pipeline([("scaler", StandardScaler()),
                         ("clf", SVC(kernel="rbf", C=1.5, probability=True, random_state=RANDOM_STATE))]),
        "Random Forest": RandomForestClassifier(n_estimators=150, random_state=RANDOM_STATE, n_jobs=-1),
        "XGBoost": ZeroBasedClassifier(XGBClassifier(n_estimators=150, learning_rate=0.1, max_depth=6,
                                                     random_state=RANDOM_STATE, eval_metric="mlogloss")),
        "LightGBM": LGBMClassifier(n_estimators=150, learning_rate=0.1, random_state=RANDOM_STATE, verbose=-1),
        "CatBoost": CatBoostClassifier(iterations=150, learning_rate=0.1, random_state=RANDOM_STATE,
                                       verbose=0, allow_writing_files=False),
    }


def compare_models(X_train, X_test, y_train, y_test, cv_splits=5, progress=None):
    """
    Trains all 7 models.
      - 5-fold stratified cross-validation on the TRAINING set (used to choose the best model)
      - one final score on the untouched TEST set (reported once)
    Best model = highest cross-validated macro F1 (ties: cross-validated accuracy).
    """
    skf = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=RANDOM_STATE)
    fitted, rows, preds = {}, [], {}
    models = build_models()
    for i, (name, model) in enumerate(models.items()):
        if progress:
            progress(i, name)
        cv = cross_validate(model, X_train, y_train, cv=skf, scoring=["accuracy", "f1_macro"])
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        fitted[name], preds[name] = model, y_pred
        rows.append({
            "name": name,
            "accuracy": accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred, average="macro", zero_division=0),
            "recall": recall_score(y_test, y_pred, average="macro", zero_division=0),
            "f1": f1_score(y_test, y_pred, average="macro"),
            "cvAccuracy": cv["test_accuracy"].mean(),
            "cvF1": cv["test_f1_macro"].mean(),
            "cvStd": cv["test_f1_macro"].std(),
        })
    if progress:
        progress(len(models), "")
    results = pd.DataFrame(rows)
    best = results.sort_values(["cvF1", "cvAccuracy"], ascending=False).iloc[0]["name"]
    return results, fitted, best, preds


def evaluate_model(y_test, y_pred):
    """Confusion matrix and per-class report for one model."""
    labels = sorted(CLASS_LABELS)
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    rep = classification_report(y_test, y_pred, labels=labels, output_dict=True, zero_division=0)
    per_class = [{
        "key": k, "label": class_label(k),
        "precision": rep[str(k)]["precision"], "recall": rep[str(k)]["recall"],
        "f1": rep[str(k)]["f1-score"], "support": int(rep[str(k)]["support"]),
    } for k in labels]
    return {"labels": labels, "matrix": cm.tolist(), "perClass": per_class}


# ----------------------------------------------------------------------------
# 5. SHAP explanations
# ----------------------------------------------------------------------------
def _unwrap(model):
    """Returns the inner estimator (removes Pipeline and ZeroBased wrappers)."""
    if isinstance(model, Pipeline):
        return _unwrap(model.steps[-1][1])
    if isinstance(model, ZeroBasedClassifier):
        return model.estimator_
    return model


def make_explainer(bundle):
    """SHAP explainer for the best model. Tree models use TreeExplainer (fast)."""
    import shap

    model = bundle["model"]
    inner = _unwrap(model)
    if bundle["best_name"] in TREE_MODELS:
        return shap.TreeExplainer(inner)
    background = shap.kmeans(bundle["background"], 15)
    return shap.KernelExplainer(lambda d: model.predict_proba(pd.DataFrame(d, columns=bundle["selected_features"])), background)


def _shap_for_class(explainer, X, class_index, n_classes):
    """Returns SHAP values (n_rows, n_features) for one class. Works with old and new SHAP formats."""
    sv = explainer.shap_values(X)
    if isinstance(sv, list):
        return np.asarray(sv[class_index])
    sv = np.asarray(sv)
    if sv.ndim == 3:
        if sv.shape[2] == n_classes:
            return sv[:, :, class_index]
        return sv[class_index]
    return sv


def shap_global_importance(bundle, X_sample):
    """Mean absolute SHAP value per feature (all classes). For the paper figure."""
    explainer = bundle.get("_explainer") or make_explainer(bundle)
    X = X_sample[bundle["selected_features"]]
    n = len(bundle["classes"])
    total = np.zeros(X.shape[1])
    for ci in range(n):
        total += np.abs(_shap_for_class(explainer, X, ci, n)).mean(axis=0)
    return (pd.DataFrame({"feature": bundle["selected_features"], "mean_abs_shap": total / n})
            .sort_values("mean_abs_shap", ascending=False).reset_index(drop=True))


# ----------------------------------------------------------------------------
# 6. Bundle: everything the backend needs, in one object
# ----------------------------------------------------------------------------
def make_bundle(best_name, model, selected_features, ranking, X_train, y_train):
    X_sel = X_train[selected_features]
    target_rows = X_sel[y_train == TARGET_CLASS]
    return {
        "best_name": best_name,
        "model": model,
        "classes": [int(c) for c in model.classes_],
        "all_features": list(FEATURES),
        "selected_features": list(selected_features),
        "class_labels": {int(k): v for k, v in CLASS_LABELS.items()},
        "target_class": TARGET_CLASS,
        # for recommendations
        "target_median": {c: float(target_rows[c].median()) for c in selected_features} if len(target_rows) else {},
        "feature_range": {c: [float(X_train[c].min()), float(X_train[c].max())] for c in FEATURES},
        # for explanations
        "background": X_sel.sample(min(100, len(X_sel)), random_state=RANDOM_STATE).reset_index(drop=True),
        "ranking": ranking[["feature", "avg_rank"]].to_dict(orient="records"),
    }


def _row_frame(bundle, row):
    missing = [f for f in bundle["selected_features"] if f not in row]
    if missing:
        raise ValueError("Missing feature(s): " + ", ".join(missing))
    return pd.DataFrame([[float(row[f]) for f in bundle["selected_features"]]], columns=bundle["selected_features"])


def predict_row(bundle, row):
    """
    row: dict with the 13 feature values (extra values are ignored).
    Returns {"predicted", "label", "confidence", "probabilities": [{"key","label","probability"}]}
    """
    X = _row_frame(bundle, row)
    proba = bundle["model"].predict_proba(X)[0]
    by_class = {int(c): float(p) for c, p in zip(bundle["classes"], proba)}
    probs = [{"key": k, "label": class_label(k), "probability": by_class.get(k, 0.0)} for k in sorted(CLASS_LABELS)]
    best = max(probs, key=lambda d: d["probability"])
    return {"predicted": best["key"], "label": best["label"], "confidence": best["probability"], "probabilities": probs}


def predict_batch(bundle, rows):
    """rows: list of dicts. Returns a list of predict_row results."""
    return [predict_row(bundle, r) for r in rows]


def explain_row(bundle, row, predicted=None):
    """
    SHAP explanation for the predicted class.
    Returns [{"feature","unit","actual","value","share"}] sorted by influence.
    value = signed share of the total influence (-1 to 1); share = absolute percent.
    """
    if predicted is None:
        predicted = predict_row(bundle, row)["predicted"]
    if "_explainer" not in bundle:
        bundle["_explainer"] = make_explainer(bundle)
    X = _row_frame(bundle, row)
    n = len(bundle["classes"])
    vals = _shap_for_class(bundle["_explainer"], X, bundle["classes"].index(int(predicted)), n)[0]
    total = float(np.abs(vals).sum()) or 1.0
    out = [{
        "feature": f, "unit": UNITS.get(f, ""), "actual": float(X[f].iloc[0]),
        "value": float(v) / total, "share": abs(float(v)) / total * 100,
    } for f, v in zip(bundle["selected_features"], vals)]
    return sorted(out, key=lambda d: abs(d["value"]), reverse=True)


def recommend_row(bundle, row, predicted=None, tolerance=0.01, top_n=None):
    """
    Process optimisation: move each selected parameter towards the typical value
    (median) of the Target class in the training data. The model then re-checks the
    result ("afterPrediction"). top_n limits how many parameters are changed (None = all).
    """
    pred = predict_row(bundle, row)
    predicted = pred["predicted"] if predicted is None else int(predicted)
    recs, improved = [], dict(row)
    for f in bundle["selected_features"][:top_n]:
        if f not in bundle["target_median"]:
            continue
        current, optimal = float(row[f]), bundle["target_median"][f]
        lo, hi = bundle["feature_range"][f]
        change = optimal - current
        action = "keep" if abs(change) <= (hi - lo) * tolerance else ("increase" if change > 0 else "decrease")
        recs.append({
            "feature": f, "unit": UNITS.get(f, ""), "current": current, "optimal": optimal,
            "change": change, "percent": (change / current * 100) if current else 0.0, "action": action,
        })
        improved[f] = optimal
    after = predict_row(bundle, improved)
    return {
        "alreadyBest": predicted == bundle["target_class"],
        "recs": recs,
        "afterPrediction": {"predicted": after["predicted"], "label": after["label"], "confidence": after["confidence"]},
    }


# ----------------------------------------------------------------------------
# 7. One call for the whole pipeline (used by the backend /api/train)
# ----------------------------------------------------------------------------
def train_pipeline(df, k=TOP_K, cv_splits=5, progress=None):
    """
    Whole workflow on an uploaded dataset:
    validate -> clean -> split -> rank features -> keep top k -> train 7 models ->
    pick best by cross-validation -> build bundle.

    Returns (payload, bundle). `payload` is JSON ready and matches the front end:
      {"models": [...], "best": "...", "confusion": {...}, "perClass": [...], "selectedFeatures": [...],
       "ranking": [...], "preprocessing": [...], "split": {...}}
    """
    check = validate_dataset(df)
    if not check["ok"]:
        raise ValueError("Dataset is not valid: " + " | ".join(check["errors"]))
    clean, steps = clean_dataset(df)
    X_train, X_test, y_train, y_test = split_data(clean)
    steps.append({"title": "Train-test split", "status": "ok",
                  "detail": f"80/20 stratified split: {len(X_train)} training rows, {len(X_test)} testing rows."})
    steps.append({"title": "Feature scaling", "status": "ok",
                  "detail": "StandardScaler is part of the Logistic Regression and SVM pipelines, so it is fitted on training data only."})
    ranking = rank_features(X_train, y_train)
    selected = ranking["feature"].tolist()[:k]
    steps.append({"title": "Feature selection", "status": "ok",
                  "detail": f"Top {k} features by average rank of ANOVA, Mutual Information, Pearson and Random Forest importance."})

    results, fitted, best, preds = compare_models(X_train[selected], X_test[selected], y_train, y_test, cv_splits, progress)
    evaluation = evaluate_model(y_test, preds[best])
    bundle = make_bundle(best, fitted[best], selected, ranking, X_train, y_train)
    payload = build_payload(results, best, evaluation, selected, ranking, steps, len(X_train), len(X_test), len(clean))
    return payload, bundle


def build_payload(results, best, evaluation, selected, ranking, steps, n_train, n_test, n_clean):
    """JSON-ready result for the front end (also saved as model_metrics.json)."""
    return _json_safe({
        "models": results.sort_values("accuracy", ascending=False).to_dict(orient="records"),
        "best": best,
        "confusion": {"labels": evaluation["labels"], "matrix": evaluation["matrix"]},
        "perClass": evaluation["perClass"],
        "selectedFeatures": list(selected),
        "ranking": ranking.reset_index(drop=True).to_dict(orient="records"),
        "preprocessing": steps,
        "split": {"train": int(n_train), "test": int(n_test), "rowsAfterCleaning": int(n_clean)},
    })


# ----------------------------------------------------------------------------
# 8. Saving and loading
# ----------------------------------------------------------------------------
def _json_safe(obj):
    return json.loads(json.dumps(obj, default=lambda o: o.item() if hasattr(o, "item") else str(o)))


def save_artifacts(bundle, payload, out_dir, X_test=None, y_test=None):
    """
    Writes everything the backend and the front end need:
      model_bundle.joblib  best model + settings (load with load_bundle)
      metadata.json        features, units, ranges, selected features, class labels
      model_metrics.json   model comparison, confusion matrix, per-class, ranking (front end format)
      sample_cycles.json   one real test cycle per class (for quick demos)
    """
    os.makedirs(out_dir, exist_ok=True)
    keep = {k: v for k, v in bundle.items() if not k.startswith("_")}
    joblib.dump(keep, os.path.join(out_dir, "model_bundle.joblib"))

    meta = {
        "features": FEATURES,
        "selectedFeatures": bundle["selected_features"],
        "units": UNITS,
        "ranges": {f: {"min": FEATURE_RANGES[f][0], "max": FEATURE_RANGES[f][1]} for f in FEATURES},
        "classLabels": {str(k): v for k, v in CLASS_LABELS.items()},
        "targetClass": TARGET_CLASS,
        "bestModel": bundle["best_name"],
        "featureRanking": bundle["ranking"],
    }
    with open(os.path.join(out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(_json_safe(meta), f, indent=2, ensure_ascii=False)
    with open(os.path.join(out_dir, "model_metrics.json"), "w", encoding="utf-8") as f:
        json.dump(_json_safe(payload), f, indent=2, ensure_ascii=False)

    if X_test is not None and y_test is not None:
        samples = {}
        for k in sorted(CLASS_LABELS):
            rows = X_test[(y_test == k).values]
            if len(rows):
                samples[str(k)] = {"label": class_label(k), "parameters": {c: float(rows.iloc[0][c]) for c in FEATURES}}
        with open(os.path.join(out_dir, "sample_cycles.json"), "w", encoding="utf-8") as f:
            json.dump(samples, f, indent=2, ensure_ascii=False)
    return sorted(os.listdir(out_dir))


def load_bundle(out_dir):
    """Loads the saved bundle. Call this ONCE when the backend starts."""
    return joblib.load(os.path.join(out_dir, "model_bundle.joblib"))

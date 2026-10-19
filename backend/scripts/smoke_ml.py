# Quick smoke test for the ML layer (not part of the pytest suite).
# Runs: validate -> train -> predict -> explain -> recommend -> save -> load.
import sys
import time

import pandas as pd

sys.path.insert(0, ".")
import ml.bridge as bridge
import ml.ml_pipeline as ml

df = pd.read_csv("data/sample_dataset.csv", sep=None, engine="python")
print(f"dataset: {len(df)} rows, classes: {sorted(df['quality'].unique())}")

check = ml.validate_dataset(df)
print(f"validate: ok={check['ok']} warnings={len(check['warnings'])}")

t0 = time.time()
payload, bundle = ml.train_pipeline(df, progress=lambda i, name: print(f"  .. {i}/7 {name}"))
print(f"train: {time.time()-t0:.1f}s best={payload['best']}")
for m in payload["models"]:
    print(f"   {m['name']:<20} acc={m['accuracy']:.3f} cv={m['cvAccuracy']:.3f}±{m['cvStd']:.3f}")
print("selected:", payload["selectedFeatures"])
print("confusion:", payload["confusion"]["matrix"])

row = {f: float(df[f].iloc[0]) for f in ml.FEATURES}
t0 = time.time()
pred = ml.predict_row(bundle, row)
print(f"predict: {(time.time()-t0)*1000:.1f}ms ->", pred["predicted"], pred["label"], round(pred["confidence"], 3))
print("probs:", [(p["key"], round(p["probability"], 3)) for p in pred["probabilities"]])

t0 = time.time()
bridge.warm_up(bundle)
exp = bridge.explain_full(bundle, row, pred["predicted"])
print(f"explain (after warm-up): {time.time()-t0:.2f}s top3:",
      [(e["feature"][:24], round(e["share"], 1)) for e in exp[:3]])

rec = ml.recommend_row(bundle, row, pred["predicted"])
print("recommend: alreadyBest=", rec["alreadyBest"], "n_recs=", len(rec["recs"]),
      "after=", rec["afterPrediction"]["label"] if rec["afterPrediction"] else None)

batch = ml.predict_batch(bundle, [row, row])
print("batch:", len(batch), "rows ok")

ml.save_artifacts(bundle, payload, "ml_artifacts")
b2 = ml.load_bundle("ml_artifacts")
pred2 = ml.predict_row(b2, row)
print("save/load roundtrip:", pred2["predicted"] == pred["predicted"], "match")
print("SMOKE OK")

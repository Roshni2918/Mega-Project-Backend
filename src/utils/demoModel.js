// DEMO model, runs fully in the browser so the interface works without a backend.
// It uses k-nearest-neighbours on the uploaded training data.
// When the Flask backend is ready, api.js calls the real Random Forest + SHAP instead.
import { FEATURES, FEATURE_NAMES, TARGET, CLASSES, BEST_CLASS } from "../schema";
import { scaleRow } from "./preprocess";
import { median, mean } from "./stats";

const K = 7;
const W = Object.fromEntries(FEATURES.map((f) => [f.name, f.weight]));

// The scaled training data is prepared once and reused (keeps sliders and batch fast).
let cache = { train: null, scaler: null, scaled: null };
function scaledTrain(train, scaler) {
  if (cache.train !== train || cache.scaler !== scaler) {
    cache = { train, scaler, scaled: train.map((t) => ({ z: scaleRow(t, scaler), label: t[TARGET] })) };
  }
  return cache.scaled;
}

export function demoPredict(row, train, scaler) {
  const z = scaleRow(row, scaler);
  const sc = scaledTrain(train, scaler);
  const dists = sc.map((t) => {
    let d = 0;
    for (const c of FEATURE_NAMES) {
      const diff = z[c] - t.z[c];
      d += W[c] * diff * diff;
    }
    return { d, label: t.label };
  });
  dists.sort((a, b) => a.d - b.d);
  const votes = {};
  dists.slice(0, K).forEach((n) => (votes[n.label] = (votes[n.label] || 0) + 1));
  const probs = Object.keys(CLASSES).map((k) => ({
    key: Number(k),
    label: CLASSES[k].label,
    probability: (votes[k] || 0) / K,
  }));
  const best = [...probs].sort((a, b) => b.probability - a.probability)[0];
  return { predicted: best.key, label: best.label, confidence: best.probability, probabilities: probs };
}

export function demoPredictBatch(rows, train, scaler) {
  return rows.map((r) => demoPredict(r, train, scaler));
}

// Approximate local explanation: how much each feature moves this row
// towards the predicted class, compared with the other classes.
export function demoExplain(row, predicted, train, scaler) {
  const z = scaleRow(row, scaler);
  const inClass = train.filter((t) => t[TARGET] === predicted);
  const others = train.filter((t) => t[TARGET] !== predicted);
  const contributions = FEATURES.map((f) => {
    const cIn = mean(inClass.map((t) => (t[f.name] - scaler[f.name].mean) / scaler[f.name].std));
    const cOut = mean(others.map((t) => (t[f.name] - scaler[f.name].mean) / scaler[f.name].std));
    const value = f.weight * (Math.abs(z[f.name] - cOut) - Math.abs(z[f.name] - cIn));
    return { feature: f.name, unit: f.unit, actual: row[f.name], value };
  });
  const total = contributions.reduce((s, c) => s + Math.abs(c.value), 0) || 1;
  return contributions
    .map((c) => ({ ...c, value: c.value / total, share: (Math.abs(c.value) / total) * 100 }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

// Process optimisation: move the most important features towards the typical
// values of the "Target" class (median of the Target rows in the training data).
export function demoRecommend(row, predicted, train, topN = 6) {
  const good = train.filter((t) => t[TARGET] === BEST_CLASS);
  const ranked = [...FEATURES].sort((a, b) => b.weight - a.weight).slice(0, topN);
  const recs = ranked.map((f) => {
    const optimal = median(good.map((t) => t[f.name]));
    const current = row[f.name];
    const change = optimal - current;
    const tol = (f.max - f.min) * 0.01;
    return {
      feature: f.name,
      unit: f.unit,
      current,
      optimal,
      change,
      percent: current ? (change / current) * 100 : 0,
      action: Math.abs(change) <= tol ? "keep" : change > 0 ? "increase" : "decrease",
    };
  });
  return { alreadyBest: predicted === BEST_CLASS, recs };
}

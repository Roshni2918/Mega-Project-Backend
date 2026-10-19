import { FEATURE_NAMES, TARGET, CLASSES } from "../schema";
import { num, median, quantile, mean, std, rng } from "./stats";

// Turn raw parsed rows into numeric rows (only the 14 needed columns).
export function toNumeric(rows) {
  return rows.map((r) => {
    const o = {};
    [...FEATURE_NAMES, TARGET].forEach((c) => (o[c] = num(r[c])));
    return o;
  });
}

export function basicDetails(rawRows, columns) {
  const targetValues = rawRows.map((r) => num(r[TARGET]));
  const counts = {};
  targetValues.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return {
    rows: rawRows.length,
    columns: columns.length,
    inputFeatures: FEATURE_NAMES,
    target: TARGET,
    classCounts: Object.keys(CLASSES).map((k) => ({
      key: k,
      label: CLASSES[k].label,
      count: counts[k] || 0,
      percent: ((counts[k] || 0) / rawRows.length) * 100,
    })),
  };
}

// Full preprocessing: missing values, duplicates, outliers, balance, split, scaling.
export function runPreprocessing(rows) {
  const steps = [];
  let data = toNumeric(rows);
  const startRows = data.length;

  // 1. missing values
  const missingBefore = {};
  FEATURE_NAMES.forEach((c) => (missingBefore[c] = data.filter((r) => !Number.isFinite(r[c])).length));
  const totalMissing = Object.values(missingBefore).reduce((a, b) => a + b, 0);
  const noTarget = data.filter((r) => !Number.isFinite(r[TARGET])).length;
  data = data.filter((r) => Number.isFinite(r[TARGET]));
  if (totalMissing > 0) {
    const med = {};
    FEATURE_NAMES.forEach((c) => (med[c] = median(data.map((r) => r[c]).filter(Number.isFinite))));
    data = data.map((r) => {
      const o = { ...r };
      FEATURE_NAMES.forEach((c) => { if (!Number.isFinite(o[c])) o[c] = med[c]; });
      return o;
    });
  }
  steps.push({
    title: "Missing values",
    status: totalMissing + noTarget === 0 ? "ok" : "fixed",
    detail:
      totalMissing + noTarget === 0
        ? "No missing values found."
        : `${totalMissing} missing input value(s) filled with the column median. ${noTarget} row(s) without a quality label removed.`,
  });

  // 2. duplicates
  const seen = new Set();
  const unique = [];
  data.forEach((r) => {
    const key = [...FEATURE_NAMES, TARGET].map((c) => r[c]).join("|");
    if (!seen.has(key)) { seen.add(key); unique.push(r); }
  });
  const dups = data.length - unique.length;
  data = unique;
  steps.push({
    title: "Duplicate records",
    status: dups === 0 ? "ok" : "fixed",
    detail: dups === 0 ? "No duplicate rows found." : `${dups} duplicate row(s) removed.`,
  });

  // 3. constant features
  const constant = FEATURE_NAMES.filter((c) => std(data.map((r) => r[c])) === 0);
  steps.push({
    title: "Constant features",
    status: constant.length ? "warn" : "ok",
    detail: constant.length ? `Constant features (no information): ${constant.join(", ")}.` : "No constant features found.",
  });

  // 4. outliers (IQR). Kept, same decision as in the notebook.
  const outliers = FEATURE_NAMES.map((c) => {
    const v = data.map((r) => r[c]);
    const q1 = quantile(v, 0.25), q3 = quantile(v, 0.75), iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    const count = v.filter((x) => x < lo || x > hi).length;
    return { feature: c, count, percent: (count / v.length) * 100 };
  }).sort((a, b) => b.count - a.count);
  steps.push({
    title: "Outliers (IQR method)",
    status: "ok",
    detail: "Outliers are kept. This is real factory data, so extreme values are normal process variation.",
  });

  // 5. class balance
  const balance = Object.keys(CLASSES).map((k) => {
    const count = data.filter((r) => r[TARGET] === Number(k)).length;
    return { key: k, label: CLASSES[k].label, count, percent: (count / data.length) * 100 };
  });
  const maxC = Math.max(...balance.map((b) => b.count));
  const minC = Math.min(...balance.map((b) => b.count));
  const balanced = minC > 0 && maxC / minC < 2;
  steps.push({
    title: "Class balance",
    status: balanced ? "ok" : "warn",
    detail: balanced ? "Classes are balanced. No resampling needed." : "Classes are imbalanced. Consider resampling.",
  });

  // 6. stratified train-test split (80/20), before scaling
  const rand = rng(42);
  const train = [], test = [];
  Object.keys(CLASSES).forEach((k) => {
    const group = data.filter((r) => r[TARGET] === Number(k));
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    const nTest = Math.round(group.length * 0.2);
    test.push(...group.slice(0, nTest));
    train.push(...group.slice(nTest));
  });
  steps.push({
    title: "Train-test split",
    status: "ok",
    detail: `80/20 stratified split: ${train.length} training rows, ${test.length} testing rows.`,
  });

  // 7. scaling, fit on training data only
  const scaler = {};
  FEATURE_NAMES.forEach((c) => {
    const v = train.map((r) => r[c]);
    scaler[c] = { mean: mean(v), std: std(v) || 1 };
  });
  steps.push({
    title: "Feature scaling",
    status: "ok",
    detail: "StandardScaler fitted on training data only, then applied to the test data (no data leakage).",
  });

  return {
    steps,
    clean: data,
    train,
    test,
    scaler,
    outliers,
    balance,
    summary: { startRows, endRows: data.length, removed: startRows - data.length },
  };
}

export const scaleRow = (row, scaler) => {
  const o = {};
  FEATURE_NAMES.forEach((c) => (o[c] = (row[c] - scaler[c].mean) / scaler[c].std));
  return o;
};

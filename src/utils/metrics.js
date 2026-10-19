export function confusionMatrix(yTrue, yPred, labels) {
  const idx = Object.fromEntries(labels.map((l, i) => [l, i]));
  const m = labels.map(() => labels.map(() => 0));
  yTrue.forEach((t, i) => {
    const a = idx[t], b = idx[yPred[i]];
    if (a !== undefined && b !== undefined) m[a][b] += 1;
  });
  return m;
}

// Per-class precision, recall, F1 and support from a confusion matrix.
export function classMetrics(matrix, labels) {
  const n = labels.length;
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  let correct = 0;
  const rows = labels.map((label, i) => {
    const tp = matrix[i][i];
    correct += tp;
    const support = matrix[i].reduce((a, b) => a + b, 0);
    const predicted = matrix.reduce((s, r) => s + r[i], 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, precision, recall, f1, support };
  });
  return { rows, accuracy: total ? correct / total : 0, total, n };
}

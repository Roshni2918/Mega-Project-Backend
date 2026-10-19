export const num = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
};
export const sorted = (a) => [...a].sort((x, y) => x - y);
export const quantile = (arr, q) => {
  const s = sorted(arr);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
export const median = (a) => quantile(a, 0.5);
export const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
export const std = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1));
};
// seeded random so the split is repeatable
export function rng(seed = 42) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const fmt = (v, d = 2) => (Number.isFinite(v) ? Number(v).toFixed(d) : "-");

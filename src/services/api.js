// Single place where the front end talks to the machine learning part.
// Demo mode (default): works in the browser with no backend.
// Backend mode: set VITE_API_URL (see .env.example). The Flask routes expected are listed below.
import { SAMPLE_MODEL_RESULTS, TARGET } from "../schema";
import { demoPredict, demoPredictBatch, demoExplain, demoRecommend } from "../utils/demoModel";
import { confusionMatrix } from "../utils/metrics";

const BASE = import.meta.env.VITE_API_URL;
export const DEMO_MODE = !BASE;

const NOTICE_KEY = "imq_notice"; // shown as a toast after the reload below

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The JWT saved by AuthContext on login/register (session key "imq_user").
function getToken() {
  try {
    const raw = localStorage.getItem("imq_user");
    const s = raw ? JSON.parse(raw) : null;
    if (!s?.token) return null;
    if (s.expiresAt && Date.now() >= s.expiresAt) return null;
    return s.token;
  } catch {
    return null;
  }
}

// The token is missing or expired (the server answered 401): log the user
// out. The message is shown as a toast after the page reloads.
function logoutForTokenError() {
  try {
    localStorage.removeItem("imq_user");
    localStorage.setItem(NOTICE_KEY, "Your session expired. Please log in again.");
  } catch {
    /* ignore */
  }
  if (!window.__imqReloading) {
    window.__imqReloading = true;
    window.location.reload();
  }
}

// One helper for every backend request: sends the token, understands the
// {"error": "message"} format and logs out on 401.
export async function apiRequest(path, { method = "POST", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) logoutForTokenError();
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new Error(data?.error || `Server error (${res.status}) on ${path}`);
  return data;
}

const post = (path, body) => apiRequest(path, { method: "POST", body });
export { post as apiPost };
export const apiGet = (path) => apiRequest(path, { method: "GET" });
export const apiDelete = (path) => apiRequest(path, { method: "DELETE" });

const MODEL_NAMES = SAMPLE_MODEL_RESULTS.map((m) => m.name);
const LABELS = [1, 2, 3, 4];

// POST /api/train    body: { train, test }
//   -> { models: [{name, accuracy, precision, recall, f1}], best, confusion: { labels, matrix } }
//   (confusion matrix is for the best model on the test set)
export async function trainModels({ train, test, scaler }, onProgress) {
  if (!DEMO_MODE) return post("/api/train", { train, test });
  const out = [];
  for (let i = 0; i < MODEL_NAMES.length; i++) {
    onProgress?.(i, MODEL_NAMES[i]);
    await sleep(700);
    out.push(SAMPLE_MODEL_RESULTS[i]);
  }
  onProgress?.(MODEL_NAMES.length, "");
  const best = [...out].sort((a, b) => b.accuracy - a.accuracy)[0].name;
  // Demo: the matrix comes from the in-browser demo model on your test rows.
  const yTrue = test.map((r) => r[TARGET]);
  const yPred = test.map((r) => demoPredict(r, train, scaler).predicted);
  return {
    models: out,
    best,
    confusion: { labels: LABELS, matrix: confusionMatrix(yTrue, yPred, LABELS), source: "demo" },
  };
}

// POST /api/predict   body: { row }               -> { predicted, label, confidence, probabilities }
export async function predict(row, ctx, opts = {}) {
  if (!DEMO_MODE) return post("/api/predict", { row });
  if (!opts.fast) await sleep(500);
  return demoPredict(row, ctx.train, ctx.scaler);
}

// POST /api/predict_batch   body: { rows }        -> [{ predicted, label, confidence, probabilities }]
export async function predictBatch(rows, ctx) {
  if (!DEMO_MODE) return post("/api/predict_batch", { rows });
  await sleep(400);
  return demoPredictBatch(rows, ctx.train, ctx.scaler);
}

// POST /api/explain   body: { row, predicted }    -> [{ feature, unit, actual, value, share }]
export async function explain(row, predicted, ctx) {
  if (!DEMO_MODE) return post("/api/explain", { row, predicted });
  await sleep(500);
  return demoExplain(row, predicted, ctx.train, ctx.scaler);
}

// POST /api/recommend body: { row, predicted }    -> { alreadyBest, recs: [{ feature, unit, current, optimal, change, percent, action }] }
export async function recommend(row, predicted, ctx) {
  if (!DEMO_MODE) return post("/api/recommend", { row, predicted });
  await sleep(400);
  return demoRecommend(row, predicted, ctx.train);
}

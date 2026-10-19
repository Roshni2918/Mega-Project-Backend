// Saved analyses (history).
// Demo mode: kept in this browser's localStorage, separately for each user.
// Backend mode: GET/POST/DELETE /api/history  (stored in the database; the
// sample entries below only exist in demo mode - the backend starts empty).
import { CLASSES } from "../schema";
import { DEMO_MODE, apiGet, apiPost, apiDelete } from "./api";

const MAX_ENTRIES = 25;
const keyFor = (user) => `imq_history_${(user?.email || "guest").toLowerCase()}`;

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// A few sample rows so the History page is not empty on first use. They have no report.
function seed() {
  return [
    { id: "sample-1", date: daysAgo(2), fileName: "sample_run_1.csv", rows: 1451, model: "Random Forest", accuracy: 0.9347, predicted: 3, label: CLASSES[3].label, confidence: 0.86, topFeature: "ZUx - Cycle time", sample: true },
    { id: "sample-2", date: daysAgo(5), fileName: "sample_run_2.csv", rows: 1180, model: "Random Forest", accuracy: 0.9211, predicted: 2, label: CLASSES[2].label, confidence: 0.71, topFeature: "APVs - Specific injection pressure peak value", sample: true },
    { id: "sample-3", date: daysAgo(9), fileName: "sample_run_3.csv", rows: 960, model: "XGBoost", accuracy: 0.9102, predicted: 1, label: CLASSES[1].label, confidence: 0.57, topFeature: "Mold temperature", sample: true },
  ];
}

export async function loadHistory(user) {
  if (!DEMO_MODE) {
    try {
      return await apiGet("/api/history");
    } catch {
      return [];
    }
  }
  try {
    const raw = localStorage.getItem(keyFor(user));
    if (raw === null) {
      const s = seed();
      localStorage.setItem(keyFor(user), JSON.stringify(s));
      return s;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(user, list) {
  try {
    localStorage.setItem(keyFor(user), JSON.stringify(list.slice(0, MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

// Returns the saved entry (truthy) or null when it could not be saved.
export async function addHistory(user, entry) {
  if (!DEMO_MODE) {
    try {
      return (await apiPost("/api/history", entry)) || null;
    } catch {
      return null;
    }
  }
  const list = [entry, ...(await loadHistory(user))];
  return save(user, list) ? entry : null;
}

// One entry with its snapshot (the list itself has no snapshot in backend mode).
export async function getHistoryEntry(user, id) {
  if (!DEMO_MODE) {
    try {
      return await apiGet(`/api/history/${id}`);
    } catch {
      return null;
    }
  }
  const list = await loadHistory(user);
  return list.find((e) => e.id === id) || null;
}

// Returns true when the entry was deleted.
export async function removeHistory(user, id) {
  if (!DEMO_MODE) {
    try {
      await apiDelete(`/api/history/${id}`);
      return true;
    } catch {
      return false;
    }
  }
  const list = (await loadHistory(user)).filter((e) => e.id !== id);
  return save(user, list);
}

// Returns true when the history was cleared.
export async function clearHistory(user) {
  if (!DEMO_MODE) {
    try {
      await apiDelete("/api/history");
      return true;
    } catch {
      return false;
    }
  }
  return save(user, []);
}

// Builds the history entry (with everything needed to recreate the PDF later).
export function makeEntry(state) {
  const best = state.training.models.find((m) => m.name === state.training.best);
  return {
    id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    fileName: state.fileName,
    rows: state.prep.summary.endRows,
    model: state.training.best,
    accuracy: best?.accuracy ?? 0,
    predicted: state.prediction.predicted,
    label: state.prediction.label,
    confidence: state.prediction.confidence,
    topFeature: state.explanation?.[0]?.feature || "",
    sample: false,
    snapshot: {
      fileName: state.fileName,
      details: state.details,
      prepLite: {
        steps: state.prep.steps,
        summary: state.prep.summary,
        trainCount: state.prep.train.length,
        testCount: state.prep.test.length,
      },
      training: state.training,
      sample: state.sample,
      prediction: state.prediction,
      explanation: state.explanation,
      recs: state.recs,
    },
  };
}

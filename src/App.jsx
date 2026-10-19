import React, { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Overview from "./pages/Overview.jsx";
import Preprocess from "./pages/Preprocess.jsx";
import Train from "./pages/Train.jsx";
import Predict from "./pages/Predict.jsx";
import Explain from "./pages/Explain.jsx";
import Optimize from "./pages/Optimize.jsx";
import WhatIf from "./pages/WhatIf.jsx";
import Report from "./pages/Report.jsx";
import Batch from "./pages/Batch.jsx";
import History from "./pages/History.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NotFound from "./pages/NotFound.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { Button } from "./components/ui.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { useToast } from "./context/ToastContext.jsx";
import { DEMO_MODE } from "./services/api";

const STEPS = [
  { id: "upload", label: "Upload dataset", Page: Upload },
  { id: "overview", label: "Dataset details", Page: Overview },
  { id: "pre", label: "Preprocessing", Page: Preprocess },
  { id: "train", label: "Train models", Page: Train },
  { id: "predict", label: "Prediction", Page: Predict },
  { id: "explain", label: "Explanation (XAI)", Page: Explain },
  { id: "optimize", label: "Recommendations", Page: Optimize },
  { id: "whatif", label: "What-if simulator", Page: WhatIf },
  { id: "report", label: "Export report", Page: Report },
];

const INITIAL = {
  fileName: null,
  columns: [],
  rawRows: [],
  validation: null,
  details: null,
  prep: null,
  training: null,
  sample: null,
  prediction: null,
  explanation: null,
  recs: null,
  savedId: null,
};

export default function App() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [view, setView] = useState("dashboard"); // dashboard | wizard | batch | history
  const [authView, setAuthView] = useState("login"); // login | register
  const [step, setStep] = useState(0);
  const [state, setState] = useState(INITIAL);
  const update = (patch) => setState((s) => ({ ...s, ...patch }));

  // Every time the page changes, open it from the top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step, view]);

  const go = (s) => { setStep(s); setView("wizard"); };
  const startNew = () => { setState(INITIAL); setStep(0); setView("wizard"); };
  const handleLogout = () => {
    logout();
    setState(INITIAL);
    setStep(0);
    setView("dashboard");
    setAuthView("login");
    toast.info("You have been logged out.");
  };

  const unlocked = [
    true,
    !!state.details,
    !!state.details,
    !!state.prep,
    !!state.training,
    !!state.prediction,
    !!state.explanation,
    !!state.recs,
    !!state.recs,
  ];

  if (!user)
    return authView === "register" ? (
      <Register onSwitch={setAuthView} />
    ) : (
      <Login onSwitch={setAuthView} />
    );

  const ctx = { state, update, step, go, setView, startNew, unlocked, reset: startNew };
  let content;
  if (view === "dashboard") content = <Dashboard {...ctx} />;
  else if (view === "wizard" && STEPS[step]) {
    const { Page } = STEPS[step];
    content = <Page {...ctx} />;
  } else if (view === "batch") content = <Batch {...ctx} />;
  else if (view === "history") content = <History {...ctx} />;
  else content = <NotFound {...ctx} />;

  const navBtn = (active, disabled) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "bg-blue-600 text-white" : "hover:bg-slate-800 disabled:hover:bg-transparent"
    }`;
  const groupLabel = "px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col overflow-y-auto bg-slate-900 p-4 text-slate-300 lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div className="flex items-center gap-3 px-2 pb-3 pt-1">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 font-bold text-white">IM</div>
          <div className="leading-tight">
            <strong className="block text-white">Quality Predictor</strong>
            <span className="text-xs text-slate-400">Plastic injection molding</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <button className={navBtn(view === "dashboard")} onClick={() => setView("dashboard")}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs">⌂</span>
            Dashboard
          </button>

          <div className={groupLabel}>Analysis</div>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              disabled={!unlocked[i]}
              onClick={() => go(i)}
              className={navBtn(view === "wizard" && i === step)}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs">{i + 1}</span>
              {s.label}
            </button>
          ))}

          <div className={groupLabel}>Tools</div>
          <button className={navBtn(view === "batch")} onClick={() => setView("batch")}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs">≡</span>
            Batch prediction
          </button>
          <button className={navBtn(view === "history")} onClick={() => setView("history")}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs">⟲</span>
            History
          </button>
        </nav>

        <div className="mt-4 flex flex-col gap-2.5 p-2 lg:mt-auto">
          {state.fileName && (
            <div className="break-all rounded-lg bg-slate-800 px-2.5 py-2 text-xs">{state.fileName}</div>
          )}
          <ThemeToggle />
          <div className="rounded-lg bg-slate-800 px-3 py-2.5">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="truncate text-xs text-slate-400">{user.role || user.email}</div>
          </div>
          <Button variant="dark" small onClick={handleLogout}>Logout</Button>
          <div className="text-xs text-slate-400">{DEMO_MODE ? "Demo mode (no backend)" : "Connected to backend"}</div>
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-14 pt-6 lg:px-10 lg:pt-8">
        <ErrorBoundary resetKey={`${view}-${step}`} onHome={() => setView("dashboard")}>
          {content}
        </ErrorBoundary>
      </main>
    </div>
  );
}

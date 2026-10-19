import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, PageTitle, NavButtons, Guard, DemoBanner, Button, Alert, Help } from "../components/ui.jsx";
import { FEATURES, CLASSES } from "../schema";
import { predict } from "../services/api";
import { GLOSSARY } from "../glossary";
import { fmt } from "../utils/stats";

export default function WhatIf({ state, go, step }) {
  const base = state.sample;
  const [values, setValues] = useState(() => ({ ...base }));
  const [res, setRes] = useState(state.prediction);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const features = useMemo(() => [...FEATURES].sort((a, b) => b.weight - a.weight), []);
  const list = showAll ? features : features.slice(0, 6);

  // Predict again 250 ms after the last slider move
  useEffect(() => {
    if (!base || !state.prep) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setError("");
        setRes(await predict(values, { train: state.prep.train, scaler: state.prep.scaler }, { fast: true }));
      } catch (e) {
        setError(e.message || "Prediction failed.");
      }
    }, 250);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line
  }, [values]);

  const reset = () => setValues({ ...base });
  const applyRecs = () => {
    const next = { ...values };
    state.recs?.recs.forEach((r) => { next[r.feature] = r.optimal; });
    setValues(next);
  };

  const original = state.prediction;
  const changed = res && original && res.predicted !== original.predicted;

  return (
    <>
      <PageTitle step={step} title="What-if simulator" text="Move the sliders to change the machine parameters and see how the predicted quality changes." />
      <Guard ok={!!base && !!state.prep} message="Please make a prediction first." goTo={() => go(4)}>
        <DemoBanner>predictions use a simple in-browser model. They will come from the real {state.training?.best} after backend connection.</DemoBanner>
        {error && <Alert kind="error">{error}</Alert>}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card
              title="Machine parameters"
              help={GLOSSARY.whatif}
              subtitle="Most important parameters first"
              right={
                <div className="flex gap-2">
                  {state.recs && <Button variant="ghost" small onClick={applyRecs}>Apply recommended values</Button>}
                  <Button variant="ghost" small onClick={reset}>Reset</Button>
                </div>
              }
            >
              <div className="space-y-5">
                {list.map((f) => {
                  const range = f.max - f.min;
                  const min = f.min - range * 0.1;
                  const max = f.max + range * 0.1;
                  const v = Number(values[f.name]);
                  const delta = v - base[f.name];
                  return (
                    <div key={f.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <label htmlFor={`s-${f.name}`} className="font-medium">{f.name}</label>
                        <span className="whitespace-nowrap">
                          <b>{fmt(v, 3)}</b> {f.unit}
                          {Math.abs(delta) > range * 0.0005 && (
                            <span className={`ml-2 text-xs ${delta > 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-700 dark:text-amber-300"}`}>
                              {delta > 0 ? "+" : ""}{fmt(delta, 3)}
                            </span>
                          )}
                        </span>
                      </div>
                      <input
                        id={`s-${f.name}`}
                        type="range"
                        className="h-2 w-full cursor-pointer accent-blue-600"
                        min={min}
                        max={max}
                        step={(max - min) / 200}
                        value={v}
                        onChange={(e) => setValues({ ...values, [f.name]: Number(e.target.value) })}
                      />
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{fmt(min, 2)}</span>
                        <span>{fmt(max, 2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" small className="mt-5" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer parameters" : `Show all ${FEATURES.length} parameters`}
              </Button>
            </Card>
          </div>

          <div>
            <div className="lg:sticky lg:top-6">
              <Card title="Predicted quality">
                {res && (
                  <>
                    <div className="mb-3 rounded-2xl border-2 px-4 py-3" style={{ borderColor: CLASSES[res.predicted].color }}>
                      <div className="text-2xl font-bold" style={{ color: CLASSES[res.predicted].color }}>{res.label}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Confidence {(res.confidence * 100).toFixed(0)}% <Help text={GLOSSARY.confidence} />
                      </div>
                    </div>
                    <div className="mb-4 text-sm">
                      Original prediction: <b style={{ color: CLASSES[original.predicted].color }}>{original.label}</b>
                      {changed && <span className="ml-2 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">Changed</span>}
                    </div>
                    <div className="space-y-2">
                      {res.probabilities.map((p) => (
                        <div key={p.key}>
                          <div className="flex justify-between text-xs">
                            <span>{p.label}</span>
                            <span>{(p.probability * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full transition-all" style={{ width: `${p.probability * 100}%`, background: CLASSES[p.key].color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </Guard>
      <NavButtons onBack={() => go(6)} onNext={() => go(8)} nextLabel="Export report" />
    </>
  );
}

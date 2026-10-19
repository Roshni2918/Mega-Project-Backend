import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, PageTitle, NavButtons, Guard, DemoBanner, Alert, Button, inputCls, Help } from "../components/ui.jsx";
import { GLOSSARY } from "../glossary";
import { FEATURES, CLASSES } from "../schema";
import { predict } from "../services/api";

export default function Predict({ state, update, go, step }) {
  const test = state.prep?.test || [];
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState(test[0] ? { ...test[0] } : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pr = state.prediction;

  const pick = (i) => {
    setIndex(i);
    setValues({ ...test[i] });
  };

  const run = async () => {
    setError("");
    setBusy(true);
    try {
      const row = {};
      FEATURES.forEach((f) => (row[f.name] = Number(values[f.name])));
      if (FEATURES.some((f) => !Number.isFinite(row[f.name]))) throw new Error("Every field must be a number.");
      const res = await predict(row, { train: state.prep.train, scaler: state.prep.scaler });
      update({ sample: row, prediction: res, explanation: null, recs: null });
    } catch (e) {
      setError(e.message || "Prediction failed.");
    }
    setBusy(false);
  };

  const actual = test[index]?.quality;

  return (
    <>
      <PageTitle
        step={step}
        title="Quality prediction"
        text={`Choose a molding cycle from the test data (or edit the values) and predict its quality with ${state.training?.best || "the selected model"}.`}
      />
      <Guard ok={!!state.training} message="Please train the models first." goTo={() => go(3)}>
        <DemoBanner>predictions use a simple in-browser model on your data. They will come from the real {state.training?.best} after backend connection.</DemoBanner>

        <Card
          title="Machine parameters"
          right={
            <select className={`${inputCls} !w-auto`} value={index} onChange={(e) => pick(Number(e.target.value))}>
              {test.map((r, i) => <option key={i} value={i}>Test cycle #{i + 1}</option>)}
            </select>
          }
        >
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <label key={f.name} className="flex flex-col gap-1 text-[13px]">
                <span className="text-slate-500 dark:text-slate-400">{f.name} <em className="not-italic text-slate-400">({f.unit})</em></span>
                <input
                  className={inputCls}
                  type="number"
                  step="any"
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <Button onClick={run} disabled={busy}>{busy ? "Predicting..." : "Predict quality"}</Button>
            {actual && <span className="text-sm text-slate-500 dark:text-slate-400">Known label of this test cycle: {CLASSES[actual]?.label}</span>}
          </div>
          {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
        </Card>

        {pr && (
          <Card title="Prediction result">
            <div className="mb-3.5 rounded-2xl border-2 bg-white dark:bg-slate-800 px-5 py-4" style={{ borderColor: CLASSES[pr.predicted].color }}>
              <div className="text-2xl font-bold" style={{ color: CLASSES[pr.predicted].color }}>
                Class {pr.predicted}: {pr.label}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Confidence {(pr.confidence * 100).toFixed(0)}% <Help text={GLOSSARY.confidence} /></div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pr.probabilities.map((p) => ({ ...p, pct: +(p.probability * 100).toFixed(1) }))}>
                <XAxis dataKey="label" />
                <YAxis unit="%" domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="pct" name="Probability" radius={[6, 6, 0, 0]}>
                  {pr.probabilities.map((p) => <Cell key={p.key} fill={CLASSES[p.key].color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </Guard>
      <NavButtons onBack={() => go(3)} onNext={() => go(5)} nextDisabled={!pr} nextLabel="Why this prediction?" />
    </>
  );
}

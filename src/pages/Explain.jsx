import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Card, PageTitle, NavButtons, Guard, DemoBanner, Alert, SkeletonCard } from "../components/ui.jsx";
import { GLOSSARY } from "../glossary";
import { CLASSES } from "../schema";
import { explain } from "../services/api";
import { fmt } from "../utils/stats";

export default function Explain({ state, update, go, step }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ex = state.explanation;
  const pr = state.prediction;

  useEffect(() => {
    if (!pr || ex) return;
    (async () => {
      setBusy(true);
      try {
        const res = await explain(state.sample, pr.predicted, { train: state.prep.train, scaler: state.prep.scaler });
        update({ explanation: res, recs: null });
      } catch (e) {
        setError(e.message || "Could not create the explanation.");
      }
      setBusy(false);
    })();
    // eslint-disable-next-line
  }, []);

  const top = ex ? ex.slice(0, 10).map((e) => ({ ...e, name: e.feature.length > 26 ? e.feature.slice(0, 26) + "…" : e.feature, pct: +(e.value * 100).toFixed(1) })) : [];
  const helped = ex ? ex.filter((e) => e.value > 0).slice(0, 3) : [];
  const hurt = ex ? ex.filter((e) => e.value < 0).slice(0, 2) : [];

  return (
    <>
      <PageTitle
        step={step}
        title="Why this prediction? (Explainable AI)"
        text="Shows which machine parameters pushed the model towards its decision."
      />
      <Guard ok={!!pr} message="Please make a prediction first." goTo={() => go(4)}>
        <DemoBanner>this is an approximate explanation. SHAP values will be shown after backend connection.</DemoBanner>
        {busy && (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={6} />
          </>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        {ex && pr && (
          <>
            <div className="mb-5 rounded-2xl border-2 bg-white dark:bg-slate-800 px-4 py-2.5" style={{ borderColor: CLASSES[pr.predicted].color }}>
              Predicted: <b style={{ color: CLASSES[pr.predicted].color }}>{pr.label}</b>
            </div>

            <Card title="Feature influence" help={GLOSSARY.influence} subtitle="Green bars supported this prediction. Red bars pushed against it.">
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={top} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" unit="%" />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Influence"]} />
                  <ReferenceLine x={0} stroke="#64748b" />
                  <Bar dataKey="pct" radius={4}>
                    {top.map((e) => <Cell key={e.feature} fill={e.value >= 0 ? "#16a34a" : "#dc2626"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="In simple words">
              <ul className="list-disc space-y-2 pl-5">
                {helped.map((e) => (
                  <li key={e.feature}>
                    <b>{e.feature}</b> (value {fmt(e.actual, 3)} {e.unit}) supported the prediction “{pr.label}”.
                  </li>
                ))}
                {hurt.map((e) => (
                  <li key={e.feature}>
                    <b>{e.feature}</b> (value {fmt(e.actual, 3)} {e.unit}) pointed towards a different class.
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Guard>
      <NavButtons onBack={() => go(4)} onNext={() => go(6)} nextDisabled={!ex} nextLabel="See recommendations" />
    </>
  );
}

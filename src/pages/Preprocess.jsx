import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, Stat, Stats, Badge, PageTitle, NavButtons, Guard, SkeletonCard, Help } from "../components/ui.jsx";
import { GLOSSARY } from "../glossary";
import { CLASSES } from "../schema";
import { runPreprocessing } from "../utils/preprocess";
import { fmt } from "../utils/stats";

const helpFor = { "Outliers (IQR method)": GLOSSARY.outliers, "Train-test split": GLOSSARY.split, "Feature scaling": GLOSSARY.scaling };
const kindOf = { ok: "ok", fixed: "info", warn: "warn" };
const labelOf = { ok: "Passed", fixed: "Fixed", warn: "Check" };

export default function Preprocess({ state, update, go, step }) {
  const [busy, setBusy] = useState(false);
  const p = state.prep;

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const prep = runPreprocessing(state.rawRows);
      update({ prep, training: null, sample: null, prediction: null, explanation: null, recs: null });
      setBusy(false);
    }, 400);
  };

  useEffect(() => {
    if (state.details && !state.prep) run();
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <PageTitle
        step={step}
        title="Data preprocessing"
        text="The same steps as in our research notebook: missing values, duplicates, outliers, class balance, train-test split and scaling."
      />
      <Guard ok={!!state.details} message="Please upload a valid dataset first." goTo={() => go(0)}>
        {busy && (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={5} />
          </>
        )}
        {p && !busy && (
          <>
            <Stats>
              <Stat label="Rows before" value={p.summary.startRows} />
              <Stat label="Rows after cleaning" value={p.summary.endRows} />
              <Stat label="Training rows" value={p.train.length} hint="80%" />
              <Stat label="Testing rows" value={p.test.length} hint="20%" />
            </Stats>

            <Card title="Steps performed">
              <ol className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {p.steps.map((s) => (
                  <li key={s.title} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2.5">
                      <strong>{s.title}</strong>{helpFor[s.title] && <Help text={helpFor[s.title]} />}
                      <Badge kind={kindOf[s.status]}>{labelOf[s.status]}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{s.detail}</p>
                  </li>
                ))}
              </ol>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Outliers per feature" subtitle="IQR method (kept in the data)">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={p.outliers} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="feature" width={150} tick={{ fontSize: 11 }}
                           tickFormatter={(v) => (v.length > 22 ? v.slice(0, 22) + "…" : v)} />
                    <Tooltip formatter={(v, n, x) => [`${v} rows (${fmt(x.payload.percent, 1)}%)`, "Outliers"]} />
                    <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Class balance after cleaning">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={p.balance}>
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {p.balance.map((c) => <Cell key={c.key} fill={CLASSES[c.key].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}
      </Guard>
      <NavButtons onBack={() => go(1)} onNext={() => go(3)} nextDisabled={!p} nextLabel="Continue to model training" />
    </>
  );
}

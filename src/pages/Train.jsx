import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Card, Badge, PageTitle, NavButtons, Guard, DemoBanner, Alert, Button, TableWrap, Th, Td } from "../components/ui.jsx";
import ConfusionMatrix from "../components/ConfusionMatrix.jsx";
import { GLOSSARY } from "../glossary";
import { trainModels } from "../services/api";
import { SAMPLE_MODEL_RESULTS } from "../schema";

const pct = (v) => (v * 100).toFixed(2) + "%";

export default function Train({ state, update, go, step }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, current: "" });
  const [error, setError] = useState("");
  const t = state.training;
  const total = SAMPLE_MODEL_RESULTS.length;

  const start = async () => {
    setError("");
    setRunning(true);
    setProgress({ done: 0, current: "" });
    try {
      const res = await trainModels(
        { train: state.prep.train, test: state.prep.test, scaler: state.prep.scaler },
        (done, current) => setProgress({ done, current })
      );
      const models = [...res.models].sort((a, b) => b.accuracy - a.accuracy);
      update({ training: { models, best: res.best, confusion: res.confusion }, sample: null, prediction: null, explanation: null, recs: null });
    } catch (e) {
      setError(e.message || "Training failed.");
    }
    setRunning(false);
  };

  return (
    <>
      <PageTitle
        step={step}
        title="Train and compare models"
        text="Seven classification models are trained on the training data and tested on the unseen test data. The best one is used for prediction."
      />
      <Guard ok={!!state.prep} message="Please finish preprocessing first." goTo={() => go(2)}>
        <DemoBanner>
          the table below shows the real results from our sample dataset. After connecting the backend, models will be trained on your uploaded data.
        </DemoBanner>

        {!t && (
          <Card>
            <p className="mb-3">
              Training set: <b>{state.prep?.train.length}</b> rows. Test set: <b>{state.prep?.test.length}</b> rows.
            </p>
            {running ? (
              <>
                <div className="my-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${(progress.done / total) * 100}%` }} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {progress.done < total ? `Training ${progress.current} (${progress.done + 1} of ${total})...` : "Finishing..."}
                </p>
              </>
            ) : (
              <Button onClick={start}>Train all models</Button>
            )}
            {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
          </Card>
        )}

        {t && (
          <>
            <Alert kind="success">
              Selected model for prediction: <b>{t.best}</b> (highest accuracy).
            </Alert>

            <Card title="Model comparison" subtitle="Test set results (precision, recall and F1 are macro averages)">
              <TableWrap>
                <thead>
                  <tr><Th>Rank</Th><Th>Model</Th><Th help={GLOSSARY.accuracy}>Accuracy</Th><Th help={GLOSSARY.precision}>Precision</Th><Th help={GLOSSARY.recall}>Recall</Th><Th help={GLOSSARY.f1}>F1 score</Th><Th /></tr>
                </thead>
                <tbody>
                  {t.models.map((m, i) => {
                    const best = m.name === t.best;
                    const cls = best ? "bg-green-50 dark:bg-green-900/30 font-semibold" : "";
                    return (
                      <tr key={m.name}>
                        <Td className={cls}>{i + 1}</Td>
                        <Td className={cls}>{m.name}</Td>
                        <Td className={cls}>{pct(m.accuracy)}</Td>
                        <Td className={cls}>{pct(m.precision)}</Td>
                        <Td className={cls}>{pct(m.recall)}</Td>
                        <Td className={cls}>{pct(m.f1)}</Td>
                        <Td className={cls}>{best && <Badge kind="ok">Selected</Badge>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </Card>

            {t.confusion && (
              <Card
                title={t.confusion.source === "demo" ? "Confusion matrix (demo model)" : `Confusion matrix: ${t.best}`}
                subtitle={
                  t.confusion.source === "demo"
                    ? "Demo: computed with the in-browser demo model on your test rows. The real model's matrix will appear after backend connection."
                    : "Results on the test set"
                }
              >
                <ConfusionMatrix labels={t.confusion.labels} matrix={t.confusion.matrix} />
              </Card>
            )}

            <Card title="Accuracy chart">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={t.models.map((m) => ({ ...m, accuracy: +(m.accuracy * 100).toFixed(2), f1: +(m.f1 * 100).toFixed(2) }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis domain={[70, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" name="Accuracy" radius={[6, 6, 0, 0]}>
                    {t.models.map((m) => <Cell key={m.name} fill={m.name === t.best ? "#16a34a" : "#2563eb"} />)}
                  </Bar>
                  <Bar dataKey="f1" name="F1 score" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
      </Guard>
      <NavButtons onBack={() => go(2)} onNext={() => go(4)} nextDisabled={!t} nextLabel="Continue to prediction" />
    </>
  );
}

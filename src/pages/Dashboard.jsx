import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, Stat, Stats, Button, Badge, PageTitle, TableWrap, Th, Td } from "../components/ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { loadHistory } from "../services/history";
import { CLASSES } from "../schema";
import { TOTAL_STEPS } from "../components/ui.jsx";

const STEP_NAMES = ["Upload dataset", "Dataset details", "Preprocessing", "Train models", "Prediction", "Explanation", "Recommendations", "What-if simulator", "Export report"];

export default function Dashboard({ state, unlocked, go, setView, startNew }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  useEffect(() => {
    let alive = true;
    loadHistory(user).then((l) => {
      if (alive) setHistory(l);
    });
    return () => {
      alive = false;
    };
  }, [user, state.savedId]);
  const real = history.filter((h) => !h.sample);
  const latest = history[0];
  const first = (user?.name || "").split(" ")[0] || "there";

  const reached = unlocked.lastIndexOf(true);
  const inProgress = !!state.fileName;

  const counts = Object.keys(CLASSES).map((k) => ({
    label: CLASSES[k].label,
    key: k,
    count: history.filter((h) => String(h.predicted) === k).length,
  }));

  return (
    <>
      <PageTitle title={`Welcome, ${first}`} text="Predict the quality of plastic injection molding cycles and see how to improve the process." />

      <Stats>
        <Stat label="Saved analyses" value={history.length} hint={real.length ? `${real.length} yours, ${history.length - real.length} sample` : "sample data"} />
        <Stat label="Latest model" value={latest?.model || "-"} hint={latest ? `${(latest.accuracy * 100).toFixed(1)}% accuracy` : undefined} />
        <Stat label="Latest prediction" value={latest?.label || "-"} hint={latest ? `${(latest.confidence * 100).toFixed(0)}% confidence` : undefined} />
        <Stat label="Current analysis" value={inProgress ? `Step ${reached + 1}/${TOTAL_STEPS}` : "None"} hint={inProgress ? state.fileName : "Upload a dataset to start"} />
      </Stats>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={inProgress ? "Continue your analysis" : "Start a new analysis"} subtitle="Follow the 9 steps from upload to report.">
            {inProgress && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{state.fileName}</span>
                  <span className="text-slate-500 dark:text-slate-400">Next: {STEP_NAMES[Math.min(reached + 1, TOTAL_STEPS - 1)]}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full bg-blue-600" style={{ width: `${((reached + 1) / TOTAL_STEPS) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {inProgress && <Button onClick={() => go(Math.min(reached + 1, TOTAL_STEPS - 1))}>Continue</Button>}
              <Button variant={inProgress ? "ghost" : "primary"} onClick={startNew}>New analysis</Button>
              <Button variant="ghost" onClick={() => setView("batch")}>Batch prediction</Button>
            </div>
          </Card>

          <Card title="Recent analyses" right={<Button variant="ghost" small onClick={() => setView("history")}>View all</Button>}>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No saved analyses yet. Finish an analysis and it will appear here.</p>
            ) : (
              <TableWrap>
                <thead>
                  <tr><Th>Date</Th><Th>Dataset</Th><Th>Model</Th><Th>Prediction</Th></tr>
                </thead>
                <tbody>
                  {history.slice(0, 5).map((h) => (
                    <tr key={h.id}>
                      <Td>{new Date(h.date).toLocaleDateString()}</Td>
                      <Td>{h.fileName} {h.sample && <Badge kind="gray">Sample</Badge>}</Td>
                      <Td>{h.model}</Td>
                      <Td><span className="font-semibold" style={{ color: CLASSES[h.predicted]?.color }}>{h.label}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>

        <Card title="Predictions so far" subtitle="Across saved analyses">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={counts}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Analyses" radius={[6, 6, 0, 0]}>
                {counts.map((c) => <Cell key={c.key} fill={CLASSES[c.key].color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}

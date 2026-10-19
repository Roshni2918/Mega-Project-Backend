import React from "react";
import { CLASSES } from "../schema";
import { classMetrics } from "../utils/metrics";
import { Help, TableWrap, Th, Td } from "./ui.jsx";
import { GLOSSARY } from "../glossary";

const pct = (v) => (v * 100).toFixed(1) + "%";

export default function ConfusionMatrix({ labels, matrix }) {
  const names = labels.map((l) => CLASSES[l]?.label || String(l));
  const cm = classMetrics(matrix, labels);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-2 text-sm font-semibold">
          Confusion matrix
          <Help text={GLOSSARY.confusion} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr>
                <th className="text-xs text-slate-500 dark:text-slate-400" />
                <th colSpan={labels.length} className="pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Predicted
                </th>
              </tr>
              <tr>
                <th className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actual</th>
                {names.map((n) => (
                  <th key={n} className="px-1 py-1 text-xs font-semibold">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => {
                const rowTotal = row.reduce((a, b) => a + b, 0) || 1;
                return (
                  <tr key={i}>
                    <th className="pr-2 text-right text-xs font-semibold">{names[i]}</th>
                    {row.map((v, j) => {
                      const share = v / rowTotal;
                      const diagonal = i === j;
                      const alpha = share * 0.85;
                      const bg = diagonal ? `rgba(22,163,74,${alpha})` : `rgba(220,38,38,${alpha})`;
                      return (
                        <td
                          key={j}
                          title={`${v} of ${rowTotal} real ${names[i]} rows predicted as ${names[j]}`}
                          className="rounded-lg px-2 py-3 font-semibold"
                          style={{ background: v ? bg : "rgba(148,163,184,0.12)", color: alpha > 0.5 ? "#fff" : undefined }}
                        >
                          {v}
                          <div className="text-[10px] font-normal opacity-80">{(share * 100).toFixed(0)}%</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Green = correct predictions. Red = mistakes.</p>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Results for each class</div>
        <TableWrap>
          <thead>
            <tr>
              <Th>Class</Th>
              <Th help={GLOSSARY.precision}>Precision</Th>
              <Th help={GLOSSARY.recall}>Recall</Th>
              <Th help={GLOSSARY.f1}>F1</Th>
              <Th help={GLOSSARY.support}>Rows</Th>
            </tr>
          </thead>
          <tbody>
            {cm.rows.map((r) => (
              <tr key={r.label}>
                <Td>{CLASSES[r.label]?.label || r.label}</Td>
                <Td>{pct(r.precision)}</Td>
                <Td>{pct(r.recall)}</Td>
                <Td>{pct(r.f1)}</Td>
                <Td>{r.support}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Accuracy on these {cm.total} test rows: <b>{pct(cm.accuracy)}</b></p>
      </div>
    </div>
  );
}

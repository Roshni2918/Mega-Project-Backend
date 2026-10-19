import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, Stat, Stats, PageTitle, NavButtons, Guard, TableWrap, Th, Td } from "../components/ui.jsx";
import { FEATURES, CLASSES } from "../schema";
import { fmt } from "../utils/stats";

export default function Overview({ state, go, step }) {
  const d = state.details;
  return (
    <>
      <PageTitle step={step} title="Dataset details" text="A quick summary of the file you uploaded." />
      <Guard ok={!!d} message="Please upload a valid dataset first." goTo={() => go(0)}>
        {d && (
          <>
            <Stats>
              <Stat label="Rows" value={d.rows} />
              <Stat label="Columns" value={d.columns} />
              <Stat label="Input features" value={d.inputFeatures.length} />
              <Stat label="Target variable" value={d.target} hint="4 classes" />
            </Stats>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Input features" subtitle="Machine parameters recorded during molding">
                <TableWrap tall>
                  <thead><tr><Th>#</Th><Th>Feature</Th><Th>Unit</Th></tr></thead>
                  <tbody>
                    {FEATURES.map((f, i) => (
                      <tr key={f.name}><Td>{i + 1}</Td><Td>{f.name}</Td><Td>{f.unit}</Td></tr>
                    ))}
                  </tbody>
                </TableWrap>
              </Card>

              <Card title="Target classes" subtitle={`"${d.target}" in your data`}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={d.classCounts}>
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v, n, p) => [`${v} rows (${fmt(p.payload.percent, 1)}%)`, "Count"]} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {d.classCounts.map((c) => <Cell key={c.key} fill={CLASSES[c.key].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <ul className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  {d.classCounts.map((c) => (
                    <li key={c.key} className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CLASSES[c.key].color }} />
                      {c.key} = {c.label}: <b>{c.count}</b> ({fmt(c.percent, 1)}%)
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card title="Data preview" subtitle="First 8 rows">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>{state.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">{c}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {state.rawRows.slice(0, 8).map((r, i) => (
                      <tr key={i}>{state.columns.map((c) => (
                        <td key={c} className="whitespace-nowrap border-b border-slate-100 dark:border-slate-700/60 px-2 py-1.5">{r[c]}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </Guard>
      <NavButtons onBack={() => go(0)} onNext={() => go(2)} nextDisabled={!d} nextLabel="Continue to preprocessing" />
    </>
  );
}

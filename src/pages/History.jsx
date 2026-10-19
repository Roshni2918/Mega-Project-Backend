import React, { useEffect, useState } from "react";
import { Card, PageTitle, Button, Badge, TableWrap, Th, Td, inputCls } from "../components/ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { loadHistory, removeHistory, clearHistory, getHistoryEntry } from "../services/history";
import { DEMO_MODE } from "../services/api";
import { downloadReportPdf } from "../utils/report";
import { CLASSES } from "../schema";

export default function History({ setView }) {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("all");

  useEffect(() => {
    let alive = true;
    loadHistory(user).then((l) => {
      if (alive) setList(l);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const shown = list.filter(
    (h) => h.fileName.toLowerCase().includes(query.toLowerCase()) && (cls === "all" || String(h.predicted) === cls)
  );

  const remove = async (h) => {
    if (!window.confirm(`Delete "${h.fileName}" from history?`)) return;
    const ok = await removeHistory(user, h.id);
    if (ok) {
      setList((prev) => prev.filter((e) => e.id !== h.id));
      toast.info("Entry deleted.");
    } else {
      toast.error("Could not delete the entry.");
    }
  };
  const clearAll = async () => {
    if (!window.confirm("Delete all history entries?")) return;
    const ok = await clearHistory(user);
    if (ok) {
      setList([]);
      toast.info("History cleared.");
    } else {
      toast.error("Could not clear the history.");
    }
  };
  const download = async (h) => {
    try {
      // in backend mode the list has no snapshot, so fetch the full entry
      const full = h.snapshot ? h : await getHistoryEntry(user, h.id);
      if (!full?.snapshot) {
        toast.error("The report data is not available for this entry.");
        return;
      }
      downloadReportPdf(full.snapshot, user, new Date(h.date));
      toast.success("PDF report downloaded.");
    } catch (e) {
      console.error("Report error:", e);
      toast.error("Could not create the report.");
    }
  };

  return (
    <>
      <PageTitle title="History" text="Your saved analyses. Reports can be downloaded again at any time." />
      <Card
        right={list.length > 0 && <Button variant="danger" small onClick={clearAll}>Clear all</Button>}
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <input className={`${inputCls} sm:!w-64`} placeholder="Search by dataset name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className={`${inputCls} sm:!w-48`} value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="all">All predictions</option>
            {Object.keys(CLASSES).map((k) => <option key={k} value={k}>{CLASSES[k].label}</option>)}
          </select>
        </div>

        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {list.length === 0 ? "No saved analyses yet." : "No entries match your search."}
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr><Th>Date</Th><Th>Dataset</Th><Th>Rows</Th><Th>Model</Th><Th>Prediction</Th><Th>Confidence</Th><Th>Actions</Th></tr>
            </thead>
            <tbody>
              {shown.map((h) => (
                <tr key={h.id}>
                  <Td>{new Date(h.date).toLocaleString()}</Td>
                  <Td>{h.fileName} {h.sample && <Badge kind="gray">Sample</Badge>}</Td>
                  <Td>{h.rows}</Td>
                  <Td>{h.model} <span className="text-slate-500 dark:text-slate-400">({(h.accuracy * 100).toFixed(1)}%)</span></Td>
                  <Td><span className="font-semibold" style={{ color: CLASSES[h.predicted]?.color }}>{h.label}</span></Td>
                  <Td>{(h.confidence * 100).toFixed(0)}%</Td>
                  <Td>
                    <div className="flex gap-2">
                      {h.snapshot || !DEMO_MODE ? (
                        <Button variant="ghost" small onClick={() => download(h)}>PDF</Button>
                      ) : (
                        <span className="self-center text-xs text-slate-500 dark:text-slate-400" title="Sample entries have no report">No report</span>
                      )}
                      <Button variant="danger" small onClick={() => remove(h)}>Delete</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
      <Button variant="ghost" onClick={() => setView("dashboard")}>Back to dashboard</Button>
    </>
  );
}

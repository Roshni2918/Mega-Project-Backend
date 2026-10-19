import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, Stat, Stats, PageTitle, Button, Alert, Badge, Guard, DemoBanner, TableWrap, Th, Td } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { FEATURE_NAMES, FEATURES, TARGET, CLASSES } from "../schema";
import { validateDataset } from "../utils/validate";
import { num } from "../utils/stats";
import { predictBatch, DEMO_MODE } from "../services/api";
import { downloadTemplate } from "../utils/template";

const MAX_ROWS_DEMO = 2000;

export default function Batch({ state, setView, go }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState("");
  const [validation, setValidation] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = (columns, rows, name) => {
    const v = validateDataset(columns, rows, { requireTarget: false, minRows: 1 });
    setValidation(v);
    setResult(null);
    if (!v.ok) {
      toast.error("Dataset has problems. See details below.");
      return;
    }
    let use = rows;
    let note = "";
    if (DEMO_MODE && rows.length > MAX_ROWS_DEMO) {
      use = rows.slice(0, MAX_ROWS_DEMO);
      note = `Demo mode predicts the first ${MAX_ROWS_DEMO} rows only.`;
    }
    const prepared = use.map((r, i) => {
      const o = { _index: i + 1 };
      FEATURE_NAMES.forEach((c) => (o[c] = num(r[c])));
      o._known = columns.includes(TARGET) ? num(r[TARGET]) : null;
      o._valid = FEATURE_NAMES.every((c) => Number.isFinite(o[c]));
      return o;
    });
    const good = prepared.filter((r) => r._valid);
    setBusy(true);
    predictBatch(good, { train: state.prep.train, scaler: state.prep.scaler })
      .then((preds) => {
        const byIndex = new Map(good.map((r, i) => [r._index, preds[i]]));
        const rowsOut = prepared.map((r) => ({ ...r, pred: byIndex.get(r._index) || null }));
        const known = rowsOut.filter((r) => r.pred && r._known);
        const match = known.length ? known.filter((r) => r.pred.predicted === r._known).length / known.length : null;
        setResult({ rows: rowsOut, skipped: prepared.length - good.length, match, note });
        toast.success(`Predicted ${good.length} rows.`);
      })
      .catch((e) => setError(e.message || "Prediction failed."))
      .finally(() => setBusy(false));
  };

  const handleFile = (f) => {
    if (!f) return;
    setError("");
    if (!/\.(csv|txt)$/i.test(f.name)) return setError("Please upload a .csv file.");
    setFile(f.name);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [";", ",", "\t", "|"],
      complete: (res) => {
        const columns = (res.meta.fields || []).map((c) => c.trim());
        const rows = res.data.map((r) => {
          const o = {};
          Object.keys(r).forEach((k) => (o[k.trim()] = r[k]));
          return o;
        });
        if (!columns.length || !rows.length) return setError("The file is empty or could not be read.");
        run(columns, rows, f.name);
      },
      error: () => setError("The file could not be read."),
    });
  };

  const download = () => {
    const out = result.rows.map((r) => {
      const o = {};
      FEATURE_NAMES.forEach((c) => (o[c] = Number.isFinite(r[c]) ? r[c] : ""));
      o.predicted_class = r.pred?.predicted ?? "";
      o.predicted_label = r.pred?.label ?? "Skipped (missing value)";
      o.confidence = r.pred ? r.pred.confidence.toFixed(2) : "";
      return o;
    });
    const url = URL.createObjectURL(new Blob([Papa.unparse(out, { delimiter: ";" })], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch_predictions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Predictions downloaded.");
  };

  const counts = Object.keys(CLASSES).map((k) => ({
    key: k,
    label: CLASSES[k].label,
    count: result ? result.rows.filter((r) => r.pred && String(r.pred.predicted) === k).length : 0,
  }));

  return (
    <>
      <PageTitle title="Batch prediction" text="Upload many molding cycles at once, predict the quality of each one and download the results." />
      <Guard ok={!!state.training} message="Please finish an analysis up to model training first (Analysis steps 1 to 4). The batch prediction uses that data and model." goTo={() => go(state.fileName ? 3 : 0)}>
        <DemoBanner>predictions use a simple in-browser model. They will come from the real {state.training?.best} after backend connection.</DemoBanner>

        <Card title="Upload cycles">
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Same {FEATURES.length} input columns and units as the training dataset. The <code className="rounded bg-indigo-50 dark:bg-slate-700 px-1.5 text-[13px]">{TARGET}</code> column is optional.
            If it is present, we also show how many predictions match it.
          </p>
          <Button variant="ghost" className="mb-4" onClick={() => downloadTemplate({ includeTarget: false, fileName: "batch_template.csv" })}>
            Download template (.csv)
          </Button>
          <div
            className={`flex cursor-pointer flex-col gap-1.5 rounded-2xl border-2 border-dashed px-5 py-9 text-center transition ${
              drag ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "border-slate-400 bg-white dark:bg-slate-800 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".csv,.txt" hidden onChange={(e) => handleFile(e.target.files[0])} />
            <strong>{busy ? "Predicting..." : file ? `Selected: ${file}. Click to choose another file` : "Drag and drop your CSV here, or click to browse"}</strong>
          </div>
        </Card>

        {error && <Alert kind="error">{error}</Alert>}

        {validation && !validation.ok && (
          <Card title="Problems found">
            <ul className="list-disc space-y-1 pl-5 text-red-800 dark:text-red-300">{validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </Card>
        )}

        {result && (
          <>
            {result.note && <Alert kind="info">{result.note}</Alert>}
            <Stats>
              <Stat label="Rows in file" value={result.rows.length} />
              <Stat label="Predicted" value={result.rows.length - result.skipped} />
              <Stat label="Skipped" value={result.skipped} hint={result.skipped ? "missing values" : undefined} />
              <Stat label="Match with known label" value={result.match === null ? "-" : `${(result.match * 100).toFixed(1)}%`} hint={result.match === null ? "no quality column" : undefined} />
            </Stats>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card title="Predicted classes">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={counts}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Rows" radius={[6, 6, 0, 0]}>
                      {counts.map((c) => <Cell key={c.key} fill={CLASSES[c.key].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <div className="lg:col-span-2">
                <Card title="Results" subtitle="First 15 rows. Download the CSV for all rows." right={<Button onClick={download}>Download CSV</Button>}>
                  <TableWrap>
                    <thead>
                      <tr><Th>Row</Th><Th>Predicted</Th><Th>Confidence</Th><Th>Known label</Th></tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 15).map((r) => (
                        <tr key={r._index}>
                          <Td>{r._index}</Td>
                          <Td>
                            {r.pred ? (
                              <span className="font-semibold" style={{ color: CLASSES[r.pred.predicted].color }}>{r.pred.label}</span>
                            ) : (
                              <Badge kind="warn">Skipped</Badge>
                            )}
                          </Td>
                          <Td>{r.pred ? `${(r.pred.confidence * 100).toFixed(0)}%` : "-"}</Td>
                          <Td>{r._known ? CLASSES[r._known]?.label : "-"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </Card>
              </div>
            </div>
          </>
        )}
      </Guard>
      <Button variant="ghost" onClick={() => setView("dashboard")}>Back to dashboard</Button>
    </>
  );
}

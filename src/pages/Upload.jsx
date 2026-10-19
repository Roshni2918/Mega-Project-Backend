import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { Card, PageTitle, Badge, NavButtons, Alert, Button, TableWrap, Th, Td } from "../components/ui.jsx";
import { FEATURES, REQUIRED_COLUMNS, TARGET } from "../schema";
import { useToast } from "../context/ToastContext.jsx";
import { downloadTemplate } from "../utils/template";
import { validateDataset } from "../utils/validate";
import { basicDetails } from "../utils/preprocess";

export default function Upload({ state, update, go, step }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [parseError, setParseError] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setParseError("");
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setParseError("Please upload a .csv file.");
      return;
    }
    setBusy(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [";", ",", "\t", "|"],
      complete: (res) => {
        setBusy(false);
        const columns = (res.meta.fields || []).map((c) => c.trim());
        const rows = res.data.map((r) => {
          const o = {};
          Object.keys(r).forEach((k) => (o[k.trim()] = r[k]));
          return o;
        });
        if (!columns.length || !rows.length) {
          setParseError("The file is empty or could not be read.");
          return;
        }
        const validation = validateDataset(columns, rows);
        if (validation.ok) toast.success("Dataset passed all checks.");
        else toast.error("Dataset has problems. See details below.");
        update({
          fileName: file.name,
          columns,
          rawRows: rows,
          validation,
          details: validation.ok ? basicDetails(rows, columns) : null,
          prep: null, training: null, sample: null, prediction: null, explanation: null, recs: null,
        });
      },
      error: () => {
        setBusy(false);
        setParseError("The file could not be read.");
      },
    });
  };

  const v = state.validation;

  return (
    <>
      <PageTitle
        step={step}
        title="Upload your dataset"
        text="Your file must use the same column names and the same units as our dataset. We check this before anything else."
      />

      <Card title="Required format">
        <ul className="mb-4 list-disc space-y-1 pl-5">
          <li>CSV file with <b>{REQUIRED_COLUMNS.length} columns</b>: {FEATURES.length} input features and the target <code className="rounded bg-indigo-50 dark:bg-slate-700 px-1.5 text-[13px]">{TARGET}</code>.</li>
          <li>Column names must be written <b>exactly</b> as in the template (spelling, capitals, spaces).</li>
          <li>Values must be numbers in the <b>same units</b> as our data (see the table below).</li>
          <li><code className="rounded bg-indigo-50 dark:bg-slate-700 px-1.5 text-[13px]">{TARGET}</code> must be 1 (Waste), 2 (Acceptable), 3 (Target) or 4 (Inefficient).</li>
        </ul>
        <Button variant="ghost" onClick={() => downloadTemplate()}>Download template (.csv)</Button>
      </Card>

      <div
        className={`mb-5 flex cursor-pointer flex-col gap-1.5 rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${
          drag ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "border-slate-400 bg-white dark:bg-slate-800 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,.txt" hidden onChange={(e) => handleFile(e.target.files[0])} />
        <strong>{busy ? "Reading file..." : "Drag and drop your CSV here, or click to browse"}</strong>
        <span className="text-sm text-slate-500 dark:text-slate-400">Comma, semicolon or tab separated files work.</span>
      </div>
      {parseError && <Alert kind="error">{parseError}</Alert>}

      {v && (
        <>
          <Alert kind={v.ok ? "success" : "error"}>
            {v.ok
              ? `Dataset "${state.fileName}" passed all checks (${state.rawRows.length} rows).`
              : `Dataset "${state.fileName}" cannot be used yet. Fix the problems below and upload again.`}
          </Alert>

          {v.errors.length > 0 && (
            <Card title="Problems found">
              <ul className="list-disc space-y-1 pl-5 text-red-800 dark:text-red-300">{v.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </Card>
          )}
          {v.warnings.length > 0 && (
            <Card title="Warnings">
              <ul className="list-disc space-y-1 pl-5 text-amber-800 dark:text-amber-300">{v.warnings.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </Card>
          )}

          <Card title="Column check">
            <TableWrap>
              <thead>
                <tr><Th>Column</Th><Th>Unit</Th><Th>Expected range</Th><Th>Result</Th></tr>
              </thead>
              <tbody>
                {v.columnChecks.map((c) => (
                  <tr key={c.name}>
                    <Td>{c.name}</Td>
                    <Td>{c.unit}</Td>
                    <Td>{c.min} to {c.max}</Td>
                    <Td>
                      <Badge kind={c.status === "ok" ? "ok" : c.status === "warn" ? "warn" : "bad"}>
                        {c.status === "ok" ? "OK" : c.status === "warn" ? "Check" : "Fail"}
                      </Badge>{" "}
                      {c.status !== "ok" && <span className="text-sm text-slate-500 dark:text-slate-400">{c.note}</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </>
      )}

      <NavButtons onNext={() => go(1)} nextDisabled={!v?.ok} nextLabel="Continue to dataset details" />
    </>
  );
}

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable/es";
import { DEMO_MODE } from "../services/api";
import { fmt } from "./stats";
import { FEATURES, CLASSES } from "../schema";
import { classMetrics } from "./metrics";

// The standard PDF font cannot draw the superscript 3 in cm³
const U = (u) => String(u ?? "").replace("³", "3");
const pct = (v) => (v * 100).toFixed(2) + "%";
const stamp = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};
const rgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export function reportFileName(ext, date = new Date()) {
  return `quality_report_${stamp(date)}.${ext}`;
}

// Builds the PDF report. `state` can be the live app state or a saved history snapshot.
export function buildReportPdf(state, user, date = new Date()) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 50;

  const need = (h) => {
    if (y + h > pageH - 50) { doc.addPage(); y = 50; }
  };
  const heading = (text) => {
    need(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 64, 175);
    doc.text(text, margin, y);
    y += 8;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
    doc.setTextColor(15, 23, 42);
  };
  const para = (text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    need(lines.length * 13 + 6);
    doc.text(lines, margin, y + 8);
    y += lines.length * 13 + 8;
  };
  const table = (head, body, opts = {}) => {
    autoTable(doc, {
      startY: y + 4,
      head: [head],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      ...opts,
    });
    y = doc.lastAutoTable.finalY + 18;
  };

  // Simple horizontal bar chart drawn with PDF shapes.
  // items: [{ label, value, color }]; domain: [min, max]; valueText: (v) => string
  const hbars = (title, items, { domain, valueText, labelW = 150 }) => {
    const barH = 12, gap = 6;
    need(items.length * (barH + gap) + 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(title, margin, y + 8);
    y += 18;
    const chartX = margin + labelW;
    const chartW = pageW - margin * 2 - labelW - 55;
    const [lo, hi] = domain;
    const span = hi - lo || 1;
    const xAt = (v) => chartX + ((v - lo) / span) * chartW;
    const zeroX = xAt(Math.min(Math.max(0, lo), hi));
    doc.setDrawColor(203, 213, 225);
    doc.line(zeroX, y - 2, zeroX, y + items.length * (barH + gap) - gap + 2);
    items.forEach((it, i) => {
      const yy = y + i * (barH + gap);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(String(it.label), labelW - 8)[0], margin, yy + 9);
      const xv = xAt(it.value);
      doc.setFillColor(...rgb(it.color));
      doc.rect(Math.min(xv, zeroX), yy, Math.max(Math.abs(xv - zeroX), 1), barH, "F");
      doc.text(valueText(it.value), pageW - margin, yy + 9, { align: "right" });
    });
    y += items.length * (barH + gap) + 8;
  };

  // ----- Title -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("Injection Molding Quality Report", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${date.toLocaleString()}`, margin, y);
  y += 14;
  doc.text(`Prepared by: ${user?.name || "-"}${user?.role ? " (" + user.role + ")" : ""}`, margin, y);
  y += 14;
  doc.text(`Dataset file: ${state.fileName || "-"}`, margin, y);
  y += 22;

  // ----- Summary -----
  const pr = state.prediction;
  const t = state.training;
  const bestModel = t?.models.find((m) => m.name === t.best);
  heading("Summary");
  table(
    ["Item", "Result"],
    [
      ["Predicted quality", pr ? `Class ${pr.predicted}: ${pr.label}` : "-"],
      ["Prediction confidence", pr ? `${(pr.confidence * 100).toFixed(0)}%` : "-"],
      ["Selected model", t?.best || "-"],
      ["Best model accuracy", bestModel ? pct(bestModel.accuracy) : "-"],
    ],
    { columnStyles: { 0: { cellWidth: 160, fontStyle: "bold" } } }
  );

  // ----- Dataset -----
  const d = state.details;
  if (d) {
    heading("1. Dataset details");
    para(`Rows: ${d.rows}   |   Columns: ${d.columns}   |   Input features: ${d.inputFeatures.length}   |   Target: ${d.target}`);
    table(
      ["Class", "Label", "Rows", "Percent"],
      d.classCounts.map((c) => [c.key, c.label, c.count, fmt(c.percent, 1) + "%"])
    );
    hbars(
      "Class distribution (rows)",
      d.classCounts.map((c) => ({ label: `${c.key} = ${c.label}`, value: c.count, color: CLASSES[c.key].color })),
      { domain: [0, Math.max(...d.classCounts.map((c) => c.count), 1)], valueText: (v) => String(v) }
    );
  }

  // ----- Preprocessing -----
  const p = state.prep || state.prepLite;
  if (p) {
    const trainN = p.trainCount ?? p.train.length;
    const testN = p.testCount ?? p.test.length;
    heading("2. Preprocessing");
    para(`Rows before cleaning: ${p.summary.startRows}. Rows after cleaning: ${p.summary.endRows}. Training rows: ${trainN}. Testing rows: ${testN}.`);
    table(
      ["Step", "Status", "Details"],
      p.steps.map((s) => [s.title, s.status === "ok" ? "Passed" : s.status === "fixed" ? "Fixed" : "Check", s.detail]),
      { columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 55 } } }
    );
  }

  // ----- Models -----
  if (t) {
    heading("3. Model comparison");
    table(
      ["Rank", "Model", "Accuracy", "Precision", "Recall", "F1 score"],
      t.models.map((m, i) => [i + 1, m.name + (m.name === t.best ? " (selected)" : ""), pct(m.accuracy), pct(m.precision), pct(m.recall), pct(m.f1)]),
      {
        didParseCell: (data) => {
          if (data.section === "body" && t.models[data.row.index]?.name === t.best) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [220, 252, 231];
          }
        },
      }
    );
    hbars(
      "Accuracy by model (%)",
      t.models.map((m) => ({ label: m.name, value: m.accuracy * 100, color: m.name === t.best ? "#16a34a" : "#2563eb" })),
      { domain: [0, 100], valueText: (v) => v.toFixed(2) + "%" }
    );

    if (t.confusion) {
      const { labels, matrix } = t.confusion;
      const names = labels.map((l) => CLASSES[l]?.label || String(l));
      const cm = classMetrics(matrix, labels);
      need(120);
      para(
        t.confusion.source === "demo"
          ? "Confusion matrix on the test set, computed with the demo model (not the real selected model). Rows = real class, columns = predicted class."
          : `Confusion matrix of ${t.best} on the test set. Rows = real class, columns = predicted class.`
      );
      table(
        ["Real \\ Predicted", ...names],
        matrix.map((row, i) => [names[i], ...row]),
        {
          columnStyles: { 0: { fontStyle: "bold" } },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === data.row.index + 1) {
              data.cell.styles.fillColor = [219, 234, 254];
              data.cell.styles.fontStyle = "bold";
            }
          },
        }
      );
      table(
        ["Class", "Precision", "Recall", "F1 score", "Support"],
        cm.rows.map((r) => [CLASSES[r.label]?.label || r.label, pct(r.precision), pct(r.recall), pct(r.f1), r.support])
      );
    }
  }

  // ----- Prediction -----
  if (pr && state.sample) {
    heading("4. Prediction");
    table(
      ["Class", "Label", "Probability"],
      pr.probabilities.map((x) => [x.key, x.label, (x.probability * 100).toFixed(0) + "%"])
    );
    para("Machine parameters used for this prediction:");
    table(
      ["Parameter", "Value", "Unit"],
      FEATURES.map((f) => [f.name, fmt(state.sample[f.name], 3), U(f.unit)])
    );
  }

  // ----- Explanation -----
  if (state.explanation) {
    heading("5. Explanation (Explainable AI)");
    para("Features that influenced the prediction the most. Positive influence supported the predicted class. Negative influence pointed to a different class.");
    const top = state.explanation.slice(0, 10);
    const m = Math.max(...top.map((e) => Math.abs(e.value * 100)), 1);
    hbars(
      "Feature influence (%)",
      top.map((e) => ({ label: e.feature, value: e.value * 100, color: e.value >= 0 ? "#16a34a" : "#dc2626" })),
      { domain: [-m, m], valueText: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%", labelW: 190 }
    );
    table(
      ["Feature", "Value", "Influence", "Effect"],
      top.map((e) => [
        e.feature,
        `${fmt(e.actual, 3)} ${U(e.unit)}`,
        (e.value * 100).toFixed(1) + "%",
        e.value >= 0 ? "Supports prediction" : "Against prediction",
      ])
    );
  }

  // ----- Recommendations -----
  if (state.recs) {
    heading("6. Process optimization recommendations");
    para(
      state.recs.alreadyBest
        ? "This cycle is already predicted as Target quality. Keep the settings close to the recommended values."
        : `This cycle is predicted as ${pr?.label}. Adjust the parameters below towards the Target values to improve quality.`
    );
    table(
      ["Parameter", "Current", "Recommended", "Change", "Action"],
      state.recs.recs.map((x) => [
        x.feature,
        `${fmt(x.current, 3)} ${U(x.unit)}`,
        `${fmt(x.optimal, 3)} ${U(x.unit)}`,
        `${x.change > 0 ? "+" : ""}${fmt(x.change, 3)} (${x.percent > 0 ? "+" : ""}${fmt(x.percent, 1)}%)`,
        x.action === "keep" ? "Keep" : x.action === "increase" ? "Increase" : "Decrease",
      ])
    );
  }

  // ----- Footer on every page -----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (DEMO_MODE) doc.text("Demo mode: prediction, explanation and recommendations are approximate.", margin, pageH - 28);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 28, { align: "right" });
  }
  return doc;
}

export function downloadReportPdf(state, user, date = new Date()) {
  buildReportPdf(state, user, date).save(reportFileName("pdf", date));
}

const esc = (v) => {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildRecommendationsCsv(state) {
  const rows = [["Parameter", "Unit", "Current", "Recommended", "Change", "Change %", "Action"]];
  (state.recs?.recs || []).forEach((x) =>
    rows.push([x.feature, U(x.unit), fmt(x.current, 3), fmt(x.optimal, 3), fmt(x.change, 3), fmt(x.percent, 1), x.action])
  );
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadRecommendationsCsv(state) {
  const date = new Date();
  const url = URL.createObjectURL(new Blob([buildRecommendationsCsv(state)], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `recommendations_${stamp(date)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

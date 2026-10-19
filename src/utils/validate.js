import { FEATURES, TARGET, REQUIRED_COLUMNS, CLASSES } from "../schema";
import { num, median } from "./stats";

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Checks an uploaded file against the expected format.
 * Rules:
 *  1. All 14 column names must match exactly (13 inputs + "quality").
 *  2. Every value must be numeric.
 *  3. "quality" must only contain 1, 2, 3, 4.
 *  4. Units: the median of each column must sit inside the expected range
 *     (with a 10% margin). This catches wrong units, e.g. °F instead of °C.
 */
export function validateDataset(columns, rows, { requireTarget = true, minRows = 100 } = {}) {
  const errors = [];
  const warnings = [];
  const columnChecks = [];

  // 1. column names
  const needed = requireTarget ? REQUIRED_COLUMNS : REQUIRED_COLUMNS.filter((c) => c !== TARGET);
  const missing = needed.filter((c) => !columns.includes(c));
  const extra = columns.filter((c) => !REQUIRED_COLUMNS.includes(c));
  missing.forEach((m) => {
    const close = extra.find((e) => norm(e) === norm(m));
    errors.push(
      close
        ? `Column "${close}" must be written exactly as "${m}" (spelling, capital letters and spaces matter).`
        : `Required column "${m}" is missing.`
    );
  });
  const trulyExtra = extra.filter((e) => !REQUIRED_COLUMNS.some((m) => norm(m) === norm(e)));
  if (trulyExtra.length) warnings.push(`Extra columns will be ignored: ${trulyExtra.join(", ")}`);

  if (rows.length < minRows) errors.push(`At least ${minRows} row${minRows === 1 ? "" : "s"} needed. Your file has ${rows.length}.`);

  // 2 + 4. values and units for each feature
  FEATURES.forEach((f) => {
    const check = { name: f.name, unit: f.unit, min: f.min, max: f.max, status: "ok", note: "OK" };
    if (!columns.includes(f.name)) {
      check.status = "fail";
      check.note = "Column missing";
      columnChecks.push(check);
      return;
    }
    const raw = rows.map((r) => r[f.name]);
    const values = raw.map(num);
    const nonEmpty = raw.filter((v) => String(v ?? "").trim() !== "");
    const bad = nonEmpty.filter((v) => !Number.isFinite(num(v))).length;
    if (bad > 0) {
      check.status = "fail";
      check.note = `${bad} value(s) are not numbers`;
      errors.push(`"${f.name}" has ${bad} non-numeric value(s).`);
      columnChecks.push(check);
      return;
    }
    const valid = values.filter(Number.isFinite);
    if (!valid.length) {
      check.status = "fail";
      check.note = "No values";
      errors.push(`"${f.name}" has no values.`);
      columnChecks.push(check);
      return;
    }
    const margin = (f.max - f.min) * 0.1;
    const lo = f.min - margin, hi = f.max + margin;
    const med = median(valid);
    const outside = valid.filter((v) => v < lo || v > hi).length / valid.length;
    if (med < lo || med > hi) {
      check.status = "fail";
      check.note = `Median ${med.toFixed(2)} is outside the expected range. Please check the unit.`;
      errors.push(`"${f.name}": values look like a different unit (median ${med.toFixed(2)}, expected ${f.min} to ${f.max} ${f.unit}).`);
    } else if (outside > 0.1) {
      check.status = "warn";
      check.note = `${(outside * 100).toFixed(0)}% of values are outside the usual range`;
      warnings.push(`"${f.name}": ${(outside * 100).toFixed(0)}% of values are outside the usual range.`);
    }
    columnChecks.push(check);
  });

  // 3. target (required for training, optional for batch prediction)
  if (requireTarget || columns.includes(TARGET)) {
    const tcheck = { name: TARGET, unit: "class", min: 1, max: 4, status: "ok", note: "OK" };
    if (columns.includes(TARGET)) {
      const allowed = Object.keys(CLASSES);
      const badVals = rows.filter((r) => !allowed.includes(String(num(r[TARGET]))));
      if (badVals.length) {
        tcheck.status = "fail";
        tcheck.note = `${badVals.length} row(s) have a label other than 1, 2, 3, 4 (or empty)`;
        errors.push(`"${TARGET}" must contain only 1, 2, 3 or 4. ${badVals.length} row(s) are invalid.`);
      }
    } else {
      tcheck.status = "fail";
      tcheck.note = "Column missing";
    }
    columnChecks.push(tcheck);
  }

  return { ok: errors.length === 0, errors, warnings, columnChecks };
}

import { FEATURES, REQUIRED_COLUMNS, FEATURE_NAMES } from "../schema";

export function downloadTemplate({ includeTarget = true, fileName = "dataset_template.csv" } = {}) {
  const cols = includeTarget ? REQUIRED_COLUMNS : FEATURE_NAMES;
  const mid = FEATURES.map((f) => ((f.min + f.max) / 2).toFixed(3));
  const csv = cols.join(";") + "\n" + (includeTarget ? [...mid, "3"] : mid).join(";") + "\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

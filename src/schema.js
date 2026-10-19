// Expected dataset format. Column names, typical units and value ranges come from
// the road-lens injection molding dataset (1451 rows). Check the `unit` text
// against your dataset documentation and edit it here if needed.
// `weight` = sqrt(ANOVA F-score) from the preprocessing notebook (used by the demo explanation).

export const TARGET = "quality";

export const CLASSES = {
  1: { label: "Waste", color: "#dc2626" },
  2: { label: "Acceptable", color: "#d97706" },
  3: { label: "Target", color: "#16a34a" },
  4: { label: "Inefficient", color: "#7c3aed" },
};
export const BEST_CLASS = 3; // "Target" is the quality we want

export const FEATURES = [
  { name: "Melt temperature", unit: "°C", min: 81.747, max: 155.032, weight: Math.sqrt(18.16) },
  { name: "Mold temperature", unit: "°C", min: 78.409, max: 82.159, weight: Math.sqrt(300.2) },
  { name: "time_to_fill", unit: "s", min: 6.084, max: 11.232, weight: Math.sqrt(271.17) },
  { name: "ZDx - Plasticizing time", unit: "s", min: 2.78, max: 6.61, weight: Math.sqrt(217.02) },
  { name: "ZUx - Cycle time", unit: "s", min: 74.78, max: 75.79, weight: Math.sqrt(9785.26) },
  { name: "SKx - Closing force", unit: "kN", min: 876.7, max: 930.6, weight: Math.sqrt(147.25) },
  { name: "SKs - Clamping force peak value", unit: "kN", min: 894.8, max: 946.5, weight: Math.sqrt(102.65) },
  { name: "Ms - Torque peak value current cycle", unit: "Nm", min: 94.2, max: 130.3, weight: Math.sqrt(12.52) },
  { name: "Mm - Torque mean value current cycle", unit: "Nm", min: 76.5, max: 114.9, weight: Math.sqrt(20.95) },
  { name: "APSs - Specific back pressure peak value", unit: "bar", min: 144.8, max: 150.5, weight: Math.sqrt(31.41) },
  { name: "APVs - Specific injection pressure peak value", unit: "bar", min: 780.5, max: 943.0, weight: Math.sqrt(320.84) },
  { name: "CPn - Screw position at the end of hold pressure", unit: "mm", min: 8.33, max: 9.06, weight: Math.sqrt(213.64) },
  { name: "SVo - Shot volume", unit: "cm³", min: 18.51, max: 19.23, weight: Math.sqrt(220.81) },
];

export const FEATURE_NAMES = FEATURES.map((f) => f.name);
export const REQUIRED_COLUMNS = [...FEATURE_NAMES, TARGET];

// Real test-set results from the sample dataset (macro averages), taken from the training notebook.
export const SAMPLE_MODEL_RESULTS = [
  { name: "Random Forest", accuracy: 0.9347, precision: 0.9352, recall: 0.9314, f1: 0.9327 },
  { name: "XGBoost", accuracy: 0.9313, precision: 0.9323, recall: 0.9283, f1: 0.9296 },
  { name: "CatBoost", accuracy: 0.9313, precision: 0.9353, recall: 0.9280, f1: 0.9299 },
  { name: "LightGBM", accuracy: 0.9278, precision: 0.9277, recall: 0.9256, f1: 0.9264 },
  { name: "SVM", accuracy: 0.9072, precision: 0.9086, recall: 0.9061, f1: 0.9069 },
  { name: "Decision Tree", accuracy: 0.8969, precision: 0.9016, recall: 0.8956, f1: 0.8975 },
  { name: "Logistic Regression", accuracy: 0.8385, precision: 0.8524, recall: 0.8388, f1: 0.8397 },
];

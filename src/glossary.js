// Simple explanations shown in the "?" help icons.
export const GLOSSARY = {
  accuracy: "Share of all predictions that were correct.",
  precision: "Of all cycles predicted as a class, how many really belong to that class.",
  recall: "Of all cycles that really belong to a class, how many the model found.",
  f1: "One score that balances precision and recall.",
  support: "Number of real test rows of this class.",
  confusion: "Each row is the real class and each column is the predicted class. Numbers on the diagonal are correct predictions.",
  outliers: "Values far away from the others. They are kept here because they are real process variation.",
  scaling: "Puts all features on a similar scale so models like SVM and Logistic Regression work well.",
  split: "Training rows (80%) are used to learn. Testing rows (20%) check the model on data it has not seen.",
  confidence: "How sure the model is about this prediction.",
  influence: "How much each machine parameter pushed the model towards its decision (SHAP-style explanation).",
  whatif: "Change the parameters with the sliders and see how the predicted quality changes.",
};

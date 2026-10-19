import React, { useEffect } from "react";
import { Card, PageTitle, NavButtons, Guard, Button, Stat, Stats, DemoBanner } from "../components/ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { downloadReportPdf, downloadRecommendationsCsv } from "../utils/report";
import { addHistory, makeEntry } from "../services/history";

export default function Report({ state, update, go, step, startNew, setView }) {
  const { user } = useAuth();
  const toast = useToast();
  const pr = state.prediction;
  const ready = !!state.recs;

  // Save this analysis to History once, when the report page is opened
  useEffect(() => {
    if (!ready || state.savedId) return undefined;
    let alive = true;
    (async () => {
      try {
        const entry = makeEntry(state);
        const saved = await addHistory(user, entry);
        if (!alive) return;
        if (saved) {
          update({ savedId: entry.id });
          toast.success("Analysis saved to History.");
        } else {
          toast.error("Could not save to History.");
        }
      } catch {
        if (alive) toast.error("Could not save to History.");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line
  }, [ready]);

  const items = [
    "Dataset details and class distribution chart",
    "Preprocessing steps and train-test split",
    "Model comparison with accuracy chart",
    "Confusion matrix and results for each class",
    "Prediction with probabilities and the machine parameters used",
    "Explanation: feature influence chart and table",
    "Process optimization recommendations",
  ];

  const pdf = () => {
    try {
      downloadReportPdf(state, user);
      toast.success("PDF report downloaded.");
    } catch {
      toast.error("Could not create the PDF report.");
    }
  };
  const csv = () => {
    downloadRecommendationsCsv(state);
    toast.success("CSV downloaded.");
  };

  return (
    <>
      <PageTitle step={step} title="Export report" text="Download everything from this analysis as one report." />
      <Guard ok={ready} message="Please finish the recommendations step first." goTo={() => go(6)}>
        <DemoBanner>the report will say that prediction, explanation and recommendations are approximate.</DemoBanner>
        {ready && (
          <>
            <Stats>
              <Stat label="Prepared by" value={user?.name || "-"} hint={user?.role} />
              <Stat label="Dataset" value={state.fileName || "-"} />
              <Stat label="Selected model" value={state.training?.best || "-"} />
              <Stat label="Predicted quality" value={pr ? pr.label : "-"} hint={pr ? `${(pr.confidence * 100).toFixed(0)}% confidence` : undefined} />
            </Stats>

            <Card title="What is inside the report">
              <ul className="mb-5 list-disc space-y-1 pl-5">
                {items.map((i) => <li key={i}>{i}</li>)}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button onClick={pdf}>Download PDF report</Button>
                <Button variant="ghost" onClick={csv}>Download recommendations (CSV)</Button>
                <Button variant="ghost" onClick={() => setView("history")}>Open History</Button>
              </div>
            </Card>
          </>
        )}
      </Guard>
      <NavButtons onBack={() => go(7)} onNext={startNew} nextLabel="Start a new analysis" />
    </>
  );
}

import React, { useEffect, useState } from "react";
import { Card, Badge, PageTitle, NavButtons, Guard, DemoBanner, Alert, TableWrap, Th, Td, SkeletonCard } from "../components/ui.jsx";
import { recommend } from "../services/api";
import { fmt } from "../utils/stats";

export default function Optimize({ state, update, go, step }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const r = state.recs;

  useEffect(() => {
    if (!state.explanation || r) return;
    (async () => {
      setBusy(true);
      try {
        const res = await recommend(state.sample, state.prediction.predicted, { train: state.prep.train });
        update({ recs: res });
      } catch (e) {
        setError(e.message || "Could not create recommendations.");
      }
      setBusy(false);
    })();
    // eslint-disable-next-line
  }, []);

  const actionKind = { increase: "info", decrease: "warn", keep: "ok" };
  const actionText = { increase: "Increase", decrease: "Decrease", keep: "Keep" };

  return (
    <>
      <PageTitle
        step={step}
        title="Process optimization recommendations"
        text="Which parameters to adjust, and by how much, to move this process towards the “Target” quality."
      />
      <Guard ok={!!state.explanation} message="Please view the explanation first." goTo={() => go(5)}>
        <DemoBanner>recommended values are the typical values of “Target” cycles in your data.</DemoBanner>
        {busy && (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={6} />
          </>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        {r && (
          <>
            <Alert kind={r.alreadyBest ? "success" : "info"}>
              {r.alreadyBest
                ? "This cycle is already predicted as Target quality. Keep the settings close to the values below."
                : `This cycle is predicted as ${state.prediction.label}. Adjusting the parameters below towards their Target values should improve quality.`}
            </Alert>
            <Card title="Recommended adjustments" subtitle="Most important parameters first">
              <TableWrap>
                <thead>
                  <tr><Th>Parameter</Th><Th>Current</Th><Th>Recommended</Th><Th>Change</Th><Th>Action</Th></tr>
                </thead>
                <tbody>
                  {r.recs.map((x) => (
                    <tr key={x.feature}>
                      <Td>{x.feature}</Td>
                      <Td>{fmt(x.current, 3)} {x.unit}</Td>
                      <Td><b>{fmt(x.optimal, 3)} {x.unit}</b></Td>
                      <Td>{x.change > 0 ? "+" : ""}{fmt(x.change, 3)} {x.unit} ({x.percent > 0 ? "+" : ""}{fmt(x.percent, 1)}%)</Td>
                      <Td><Badge kind={actionKind[x.action]}>{actionText[x.action]}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          </>
        )}
      </Guard>
      <NavButtons onBack={() => go(5)} onNext={() => go(7)} nextDisabled={!r} nextLabel="Try the what-if simulator" />
    </>
  );
}

import React from "react";
import { Card, Button } from "../components/ui.jsx";

export default function NotFound({ setView }) {
  return (
    <Card>
      <div className="py-10 text-center">
        <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">404</div>
        <h2 className="mt-2 text-xl font-semibold">Page not found</h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">The page you are looking for does not exist.</p>
        <Button onClick={() => setView("dashboard")}>Go to dashboard</Button>
      </div>
    </Card>
  );
}

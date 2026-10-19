import React from "react";
import { DEMO_MODE } from "../services/api";

export const TOTAL_STEPS = 9;

export const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200";

// Small "?" icon that explains a term when hovered or focused
export const Help = ({ text }) => (
  <span className="group relative ml-1 inline-flex align-middle">
    <span
      tabIndex={0}
      aria-label={text}
      className="grid h-4 w-4 cursor-help place-items-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold normal-case tracking-normal text-slate-600 dark:text-slate-100"
    >
      ?
    </span>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-lg group-focus-within:block group-hover:block"
    >
      {text}
    </span>
  </span>
);

export const Card = ({ title, subtitle, children, right, help }) => (
  <section className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
    {(title || right) && (
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {title && (
            <h3 className="text-lg font-semibold">
              {title}
              {help && <Help text={help} />}
            </h3>
          )}
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

export const Stat = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm">
    <div className="truncate text-2xl font-bold">{value}</div>
    <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    {hint && <div className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">{hint}</div>}
  </div>
);

export const Stats = ({ children }) => <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;

const badgeKinds = {
  ok: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",
  warn: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
  bad: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",
  info: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",
  gray: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
};
export const Badge = ({ kind = "ok", children }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeKinds[kind]}`}>{children}</span>
);

const alertKinds = {
  success: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
  info: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300",
};
export const Alert = ({ kind = "info", children }) => (
  <div className={`mb-5 rounded-xl border px-4 py-3 ${alertKinds[kind]}`}>{children}</div>
);

const btnKinds = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  ghost: "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700",
  dark: "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
  danger: "border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40",
};
export const Button = ({ variant = "primary", small, className = "", ...props }) => (
  <button
    className={`rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
      small ? "px-3 py-1.5 text-sm" : "px-5 py-2.5"
    } ${btnKinds[variant]} ${className}`}
    {...props}
  />
);

export const TableWrap = ({ children, tall }) => (
  <div className={`overflow-x-auto ${tall ? "max-h-96 overflow-y-auto" : ""}`}>
    <table className="w-full text-sm">{children}</table>
  </div>
);
export const Th = ({ children, help }) => (
  <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
    {children}
    {help && <Help text={help} />}
  </th>
);
export const Td = ({ children, className = "" }) => (
  <td className={`border-b border-slate-100 dark:border-slate-700/60 px-2.5 py-2 ${className}`}>{children}</td>
);

export const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`} />;
export const SkeletonCard = ({ lines = 4 }) => (
  <Card>
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  </Card>
);

export const PageTitle = ({ step, title, text }) => (
  <header className="mb-6">
    {step !== undefined && (
      <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        Step {step + 1} of {TOTAL_STEPS}
      </div>
    )}
    <h1 className="mb-1 mt-1 text-3xl font-bold">{title}</h1>
    {text && <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>}
  </header>
);

export const NavButtons = ({ onBack, onNext, nextLabel = "Continue", nextDisabled }) => (
  <div className="mt-6 flex justify-between">
    {onBack ? <Button variant="ghost" onClick={onBack}>Back</Button> : <span />}
    {onNext && (
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    )}
  </div>
);

export const Guard = ({ ok, message, goTo, children }) =>
  ok ? children : (
    <Card>
      <p className="mb-3">{message}</p>
      <Button onClick={goTo}>Go back</Button>
    </Card>
  );

export const DemoBanner = ({ children }) =>
  DEMO_MODE ? (
    <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
      Demo mode: {children}
    </div>
  ) : null;

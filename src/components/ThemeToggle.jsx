import React from "react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700 ${className}`}
    >
      <span>{dark ? "Dark mode" : "Light mode"}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${dark ? "bg-blue-600" : "bg-slate-600"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all`} style={{ left: dark ? "1.125rem" : "0.125rem" }} />
      </span>
    </button>
  );
}

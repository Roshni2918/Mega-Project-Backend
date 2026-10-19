import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { DUMMY_USERS } from "../services/auth";
import { DEMO_MODE } from "../services/api";
import { Button, inputCls } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name}.`);
    } catch (err) {
      setError(err.message || "Login failed.");
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-slate-900 px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white">IM</div>
          <div className="leading-tight text-white">
            <strong className="block text-lg">Quality Predictor</strong>
            <span className="text-xs text-slate-400">Plastic injection molding</span>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="rounded-2xl bg-white dark:bg-slate-800 p-7 shadow-xl">
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Sign in to continue to your dashboard.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-800 dark:text-red-300">{error}</div>
          )}

          <label className="mb-4 flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              className={inputCls}
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="mb-5 flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            <div className="relative">
              <input
                className={`${inputCls} pr-16`}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Login"}
          </Button>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => onSwitch?.("register")}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create account
            </button>
          </p>
        </form>

        {DEMO_MODE && (
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
            <div className="mb-2 font-semibold text-white">Dummy users for testing</div>
            <ul className="space-y-1.5">
              {DUMMY_USERS.map((u) => (
                <li key={u.email} className="flex items-center justify-between gap-2">
                  <span>
                    {u.email} <span className="text-slate-500 dark:text-slate-400">/ {u.password}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.password); setError(""); }}
                    className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs hover:bg-slate-600"
                  >
                    Fill
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

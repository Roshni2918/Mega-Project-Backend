import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { emailTaken } from "../services/auth";
import { Button, inputCls } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Register({ onSwitch }) {
  const { register } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Your password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    if (emailTaken(email)) return setError("An account with this email already exists. Please login instead.");
    setBusy(true);
    try {
      // The new account is created and you are logged in straight away.
      const u = await register({ name, email, password });
      toast.success(`Account created. Welcome, ${u.name}.`);
    } catch (err) {
      setError(err.message || "Registration failed.");
      setBusy(false);
    }
  };

  const pwdInput = (value, onChange, placeholder, autoComplete) => (
    <div className="relative">
      <input
        className={`${inputCls} pr-16`}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );

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
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Register to save your analyses and reports.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-800 dark:text-red-300">{error}</div>
          )}

          <label className="mb-4 flex flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <input
              className={inputCls}
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

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

          <label className="mb-4 flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            {pwdInput(password, setPassword, "At least 8 characters", "new-password")}
            <span className="text-xs text-slate-500 dark:text-slate-400">At least 8 characters.</span>
          </label>

          <label className="mb-5 flex flex-col gap-1 text-sm">
            <span className="font-medium">Confirm password</span>
            {pwdInput(confirm, setConfirm, "Type the password again", "new-password")}
          </label>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </Button>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onSwitch?.("login")}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

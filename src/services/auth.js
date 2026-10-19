// Login service.
// Demo mode (no backend): checks a small list of dummy users in the browser.
// Backend mode: POST /api/auth/login  body: { email, password }  ->  { token, user: { name, email, role } }
// The real version (hashed passwords + token, with MySQL) will be added with the backend.
import { DEMO_MODE } from "./api";

export const DUMMY_USERS = [
  { name: "Admin User", email: "admin@demo.com", password: "Admin@123", role: "Admin" },
  { name: "Process Engineer", email: "engineer@demo.com", password: "Engineer@123", role: "Process Engineer" },
  { name: "Research Student", email: "student@demo.com", password: "Student@123", role: "Researcher" },
];

// Session length in demo mode. In backend mode the token expiry will decide this.
export const SESSION_MINUTES = Number(import.meta.env.VITE_SESSION_MINUTES) || 120;

const KEY = "imq_user";
const USERS_KEY = "imq_users";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Accounts created with "Create account" in demo mode (kept in this browser only).
export function loadRegisteredUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// True when the email belongs to a dummy user or to an account created in this browser.
export function emailTaken(email) {
  const e = email.trim().toLowerCase();
  return (
    DUMMY_USERS.some((u) => u.email.toLowerCase() === e) ||
    loadRegisteredUsers().some((u) => u.email.toLowerCase() === e)
  );
}

export async function login(email, password) {
  if (!DEMO_MODE) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Invalid email or password.");
    return { ...data.user, token: data.token };
  }
  await sleep(500);
  const e = email.trim().toLowerCase();
  const u =
    DUMMY_USERS.find((x) => x.email.toLowerCase() === e && x.password === password) ||
    loadRegisteredUsers().find((x) => x.email.toLowerCase() === e && x.password === password);
  if (!u) throw new Error("Invalid email or password.");
  return { name: u.name, email: u.email, role: u.role };
}

// Register service.
// Demo mode: saves the account in this browser (passwords here are plain text for testing only).
// Backend mode: POST /api/auth/register  body: { name, email, password }  ->  { token, user: { name, email, role } }
// The real version (hashed passwords + token, with MySQL) will be added with the backend.
export async function register({ name, email, password }) {
  if (!DEMO_MODE) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Registration failed. Please try again.");
    // The register response contains no token, so log in once to get it -
    // the user stays logged in right after creating the account.
    try {
      const user = await login(email, password);
      return { ...data.user, token: user.token };
    } catch {
      return { ...data.user }; // account created; log in manually afterwards
    }
  }
  await sleep(500);
  if (emailTaken(email)) throw new Error("An account with this email already exists.");
  const user = { name: name.trim(), email: email.trim(), password, role: "Member" };
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify([...loadRegisteredUsers(), user]));
  } catch { /* ignore */ }
  return { name: user.name, email: user.email, role: user.role };
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    // Sessions from older versions have no expiry time, so they are treated as expired
    if (s && (!s.expiresAt || Date.now() >= s.expiresAt)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
export function saveSession(user) {
  try { localStorage.setItem(KEY, JSON.stringify(user)); } catch { /* ignore */ }
}
export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

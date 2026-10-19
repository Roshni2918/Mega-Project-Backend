import React, { createContext, useContext, useEffect, useState } from "react";
import { login as loginService, register as registerService, loadSession, saveSession, clearSession, SESSION_MINUTES } from "../services/auth";
import { useToast } from "../context/ToastContext.jsx";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(() => loadSession());

  // Same session handling for login and register
  const startSession = (u) => {
    const session = { ...u, expiresAt: Date.now() + SESSION_MINUTES * 60 * 1000 };
    saveSession(session);
    setUser(session);
    return session;
  };
  const login = async (email, password) => startSession(await loginService(email, password));
  const register = async (data) => startSession(await registerService(data));
  const logout = () => {
    clearSession();
    setUser(null);
  };

  // Show a message left behind by the services (e.g. after a 401 logout)
  useEffect(() => {
    try {
      const notice = localStorage.getItem("imq_notice");
      if (notice) {
        localStorage.removeItem("imq_notice");
        toast.error(notice);
      }
    } catch {
      /* ignore */
    }
  }, [toast]);

  // Auto logout when the session expires
  useEffect(() => {
    if (!user?.expiresAt) return undefined;
    const check = () => {
      if (Date.now() >= user.expiresAt) {
        clearSession();
        setUser(null);
        toast.error("Your session expired. Please log in again.");
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [user, toast]);

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

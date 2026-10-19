import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext({ success() {}, error() {}, info() {} });
export const useToast = () => useContext(ToastCtx);

const styles = {
  success: "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  error: "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
  info: "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300",
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => setItems((list) => list.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind, message) => {
      const id = Math.random().toString(36).slice(2);
      setItems((list) => [...list, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );
  const api = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`flex items-start justify-between gap-3 rounded-xl border-l-4 px-4 py-3 text-sm shadow-lg ${styles[t.kind]}`}>
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} aria-label="Close" className="text-base leading-none opacity-60 hover:opacity-100">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

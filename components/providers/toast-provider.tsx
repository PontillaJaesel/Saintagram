"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const activeToastKeys = useRef<Set<string>>(new Set());
  const toastTimeouts = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timeoutId = toastTimeouts.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeouts.current.delete(id);
    }

    setToasts((items) => {
      const removed = items.find((item) => item.id === id);
      if (removed) {
        activeToastKeys.current.delete(`${removed.kind}:${removed.message}`);
      }
      return items.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(() => {
    return () => {
      toastTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeouts.current.clear();
    };
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const key = `${kind}:${message}`;
      setToasts((items) => {
        if (activeToastKeys.current.has(key)) {
          return items;
        }

        const id = ++nextId.current;
        activeToastKeys.current.add(key);
        const timeoutId = window.setTimeout(() => {
          dismiss(id);
        }, 4500);
        toastTimeouts.current.set(id, timeoutId);

        return [...items, { id, message, kind }];
      });
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-2 sm:items-end"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-base)] border p-4 text-sm font-semibold text-ink shadow-lift ${
              toast.kind === "success"
                ? "border-success-100 bg-success-50"
                : "border-clay-200 bg-clay-50"
            }`}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-clay-600" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              className="-m-2 min-h-10 min-w-10 rounded-full p-2 text-muted hover:bg-sage-50"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}

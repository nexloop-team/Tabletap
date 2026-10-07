"use client";

import { Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface ToastOptions {
  text: string;
  /** One follow-up, e.g. "Undo". The toast closes when it's used. */
  action?: { label: string; onClick: () => void };
  /** How long it stays up; long enough to reach an action. */
  durationMs?: number;
}

type ShowToast = (options: ToastOptions) => void;

// Outside a provider (e.g. onboarding) toasts are simply dropped.
const ToastContext = createContext<ShowToast>(() => {});

/** "Saved", "Restored" and friends: one at a time, bottom of the screen, announced to screen readers. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<ShowToast>((options) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...options, id });
    timer.current = setTimeout(() => setToast((current) => (current?.id === id ? null : current)), options.durationMs ?? (options.action ? 8000 : 3500));
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            <Check aria-hidden className="toast-icon" />
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
              <X aria-hidden />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

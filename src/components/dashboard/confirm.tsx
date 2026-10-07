"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  /** Instead of "Cancel", when the action itself is a cancellation. */
  cancelLabel?: string;
  /** Red confirm button, and focus starts on Cancel so Enter doesn't destroy anything. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Promise-based replacement for window.confirm(); falls back to it outside a provider. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  return confirm ?? (async ({ title, body }) => window.confirm(typeof body === "string" ? `${title}\n\n${body}` : title));
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const confirm = useCallback<Confirm>((options) => {
    resolver.current?.(false);
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (request && !el.open) el.showModal();
    if (!request && el.open) el.close();
  }, [request]);

  const Icon = request?.danger ? AlertTriangle : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby={titleId}
        aria-describedby={request?.body ? bodyId : undefined}
        onClose={() => settle(false)}
        onClick={(event) => {
          if (event.target === dialog.current) settle(false);
        }}
      >
        {request && (
          <>
            <div className="modal-content">
              <span className={`modal-icon ${request.danger ? "danger" : ""}`}>
                <Icon aria-hidden />
              </span>
              <div>
                <h2 id={titleId}>{request.title}</h2>
                {request.body && <div id={bodyId} className="modal-body">{request.body}</div>}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => settle(false)} autoFocus={request.danger}>
                {request.cancelLabel ?? "Cancel"}
              </button>
              <button type="button" className={`btn ${request.danger ? "btn-danger-solid" : "btn-primary"}`} onClick={() => settle(true)} autoFocus={!request.danger}>
                {request.confirmLabel ?? "Continue"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { DialogContent } from "./LandingContext";

/**
 * In-page replacement for window.alert(): styled with the venue's card
 * chrome, localised, and it doesn't block the page's event loop.
 */
export function AppDialog({ content, okLabel, onClose }: { content: DialogContent | null; okLabel: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (content && !dialog.open) dialog.showModal();
    if (!content && dialog.open) dialog.close();
  }, [content]);

  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby={content?.title ? "app-dialog-title" : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {content?.title && <h2 id="app-dialog-title">{content.title}</h2>}
      <p>{content?.message}</p>
      <button type="button" className="btn-primary" onClick={onClose} autoFocus>
        {okLabel}
      </button>
    </dialog>
  );
}

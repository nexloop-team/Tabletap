"use client";

import { Eye, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * On phones and small tablets the side-by-side preview doesn't fit, so this
 * button opens the saved page full screen without leaving the editor.
 */
export function MobilePreview({ src, label, dirty }: { src: string; label: string; dirty: boolean }) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn mobile-preview-btn" onClick={() => setOpen(true)}>
        <Eye aria-hidden /> {label}
      </button>
      {open &&
        // At the page root: a transformed ancestor would otherwise shift a fixed overlay.
        createPortal(
          <div className="app mobile-preview" role="dialog" aria-modal="true" aria-label={label}>
            <div className="mobile-preview-bar">
              <span>{dirty ? "Showing your last save. Save to see new changes." : "This is what guests see."}</span>
              <button ref={closeButton} type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                <X aria-hidden /> Close
              </button>
            </div>
            <iframe src={src} title={label} />
          </div>,
          document.body,
        )}
    </>
  );
}

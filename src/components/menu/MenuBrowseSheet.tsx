"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export interface FilterGroup {
  title: string;
  options: { key: string; label: ReactNode; on: boolean; toggle: () => void }[];
}

/**
 * The sheet behind the ☰ in the section bar: the filters (veg / non-veg on
 * Indian menus, diets and allergens elsewhere) and every category to jump to.
 * Same bottom sheet as a dish: closes on the scrim, ✕ or Escape.
 */
export function MenuBrowseSheet({
  open,
  groups,
  sections,
  current,
  labels,
  onJump,
  onClear,
  onClose,
}: {
  open: boolean;
  groups: FilterGroup[];
  sections: { id: string; name: string; count: number }[];
  current: string | null;
  labels: { title: string; categories: string; clear: string; show: string; close: string };
  onJump: (sectionId: string) => void;
  /** Shown only while a filter is on. */
  onClear: (() => void) | null;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      opener?.focus();
    };
  }, [open, onClose]);

  return (
    <div className={`bottom-sheet${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="bottom-sheet-scrim" onClick={onClose} />
      <div className="bottom-sheet-panel browse-sheet" role="dialog" aria-modal="true" aria-labelledby="browse-sheet-title">
        <div className="bottom-sheet-handle" aria-hidden />
        <div className="browse-sheet-head">
          <h2 id="browse-sheet-title">{labels.title}</h2>
          <button ref={closeButton} type="button" className="browse-sheet-close" aria-label={labels.close} onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>

        <div className="browse-sheet-body">
          {groups.map((group) => (
            <section key={group.title} className="browse-group" aria-label={group.title}>
              <h3>{group.title}</h3>
              <div className="browse-chips">
                {group.options.map((option) => (
                  <button key={option.key} type="button" className="browse-chip" aria-pressed={option.on} onClick={option.toggle}>
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {sections.length > 0 && (
            <section className="browse-group" aria-label={labels.categories}>
              <h3>{labels.categories}</h3>
              <ul className="browse-sections">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button type="button" aria-current={section.id === current ? "true" : undefined} onClick={() => onJump(section.id)}>
                      <span>{section.name}</span>
                      <span className="browse-count">{section.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="browse-sheet-foot">
          {onClear && (
            <button type="button" className="browse-clear" onClick={onClear}>
              {labels.clear}
            </button>
          )}
          <button type="button" className="browse-show" onClick={onClose}>
            {labels.show}
          </button>
        </div>
      </div>
    </div>
  );
}

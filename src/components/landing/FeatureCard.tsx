"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { createContext, useCallback, useContext, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

/**
 * 44px tinted circle: the feature colour behind the glyph in full colour. The
 * wash is stronger on dark cards (--icon-soft, set by the theme) so it still reads.
 */
export function IconCircle({ tint, children }: { tint: string | null; children: ReactNode }) {
  return (
    <span className={`icon-circle${tint ? "" : " neutral"}`} style={tint ? ({ "--tint": tint } as CSSProperties) : undefined}>
      {children}
    </span>
  );
}

interface RowProps {
  label: string;
  icon: ReactNode;
  tint: string | null;
  /** "down" for cards that expand in place, "right" for cards that go somewhere. */
  chevron?: "down" | "right" | false;
}

function RowContent({ label, icon, tint, chevron = "right" }: RowProps) {
  const Chevron = chevron === "down" ? ChevronDown : ChevronRight;
  return (
    <>
      <IconCircle tint={tint}>{icon}</IconCircle>
      <span className="feature-label">{label}</span>
      {chevron && <Chevron className={`chevron chevron-${chevron}`} aria-hidden strokeWidth={2} />}
    </>
  );
}

interface SheetControls {
  isOpen: boolean;
  close: () => void;
}

const SheetContext = createContext<SheetControls>({ isOpen: false, close: () => {} });

/** Lets content inside a sheet collapse it (e.g. a success panel's ✕). */
export function useSheet() {
  return useContext(SheetContext);
}

interface ExpandableCardProps extends RowProps {
  feature: string;
  /** Called synchronously inside the tap, so it can grab focus for the iOS keyboard. */
  onToggle?: (open: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  /** Don't mount the content until first opened (e.g. the Sudoku board). */
  lazy?: boolean;
  children: ReactNode;
}

/**
 * A card whose row toggles an inline sheet. Sheets are independent: several
 * can be open at once. Opening scrolls the card to the top once the sheet
 * has started to grow.
 */
export function ExpandableCard({ feature, label, icon, tint, onToggle, lazy = false, children }: ExpandableCardProps) {
  const [isOpen, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(!lazy);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  const close = useCallback(() => setOpen(false), []);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = !isOpen;
    setOpen(next);
    if (next) setHasOpened(true);
    onToggle?.(next, event);
    if (next) {
      setTimeout(() => wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    }
  }

  return (
    <div className="feature-wrapper" ref={wrapperRef} data-feature={feature}>
      <button type="button" className="feature-card" aria-expanded={isOpen} aria-controls={sheetId} onClick={toggle}>
        <RowContent label={label} icon={icon} tint={tint} chevron="down" />
      </button>
      <section id={sheetId} className={`sheet${isOpen ? " open" : ""}`} aria-label={label} inert={!isOpen}>
        <div className="sheet-clip">
          <SheetContext.Provider value={{ isOpen, close }}>{hasOpened && children}</SheetContext.Provider>
        </div>
      </section>
    </div>
  );
}

/** A card that does something immediately (navigate, open a link) instead of expanding. */
export function ActionCard({ feature, onActivate, ...row }: RowProps & { feature: string; onActivate: () => void }) {
  return (
    <div className="feature-wrapper" data-feature={feature}>
      <button type="button" className="feature-card" onClick={onActivate}>
        <RowContent {...row} />
      </button>
    </div>
  );
}

/** A merchant's custom link: a real anchor, opened in a new tab, no chevron. */
export function LinkCard({ href, onClick, ...row }: RowProps & { href: string; onClick: () => void }) {
  return (
    <div className="feature-wrapper" data-feature="link">
      <a className="feature-card" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        <RowContent {...row} chevron={false} />
      </a>
    </div>
  );
}

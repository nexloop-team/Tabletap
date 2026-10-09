/**
 * The Indian food mark: a square with a dot for veg (green) and egg (amber),
 * or a triangle for non-veg (brown), as FSSAI specifies and diners expect.
 */
export function VegMark({ type, label }: { type: "veg" | "nonveg" | "egg"; label: string }) {
  return (
    <svg className={`veg-mark ${type}`} viewBox="0 0 16 16" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {type === "nonveg" ? <path d="M8 4.2 11.6 11H4.4Z" fill="currentColor" /> : <circle cx="8" cy="8" r="3.4" fill="currentColor" />}
    </svg>
  );
}

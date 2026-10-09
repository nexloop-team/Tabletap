export type EventParams = Record<string, string | number | boolean | null>;
export type Track = (name: string, params?: EventParams) => void;

const VISIT_KEY = "tt_visit";
const VISIT_IDLE_MS = 30 * 60 * 1000;
let fallbackVisit: string | null = null;

/**
 * One id per visit: kept in this tab's sessionStorage and renewed after 30
 * idle minutes, so a refresh, or going to the menu and back, is still the
 * same visit (and counts as one scan). Nothing outlives the tab.
 */
function visitId(): string {
  const fresh = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  try {
    const saved = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? "null") as { id: string; at: number } | null;
    const id = saved && Date.now() - saved.at < VISIT_IDLE_MS ? saved.id : fresh();
    sessionStorage.setItem(VISIT_KEY, JSON.stringify({ id, at: Date.now() }));
    return id;
  } catch {
    fallbackVisit ??= fresh();
    return fallbackVisit;
  }
}

/**
 * First-party analytics: every event carries the venue, the scan source and a
 * visit id (see visitId), and is delivered with sendBeacon so it survives
 * the tap that navigates away. Booleans are sent as 1/0 so they aggregate as
 * numbers in any warehouse.
 */
export function createTracker(base: { venueId: string | null; source: string; page: string }): Track {
  return (name, params = {}) => {
    const payload: EventParams = { session_id: visitId(), platform: "web", page: base.page, source: base.source, ...params };
    if (base.venueId) payload.venue_id = base.venueId;
    for (const key of Object.keys(payload)) {
      if (typeof payload[key] === "boolean") payload[key] = payload[key] ? 1 : 0;
    }
    if (process.env.NODE_ENV !== "production") console.debug(`[analytics] ${name}`, payload);
    try {
      const body = JSON.stringify({ name, params: payload });
      if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* analytics must never break the page */
    }
  };
}

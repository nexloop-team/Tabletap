export type EventParams = Record<string, string | number | boolean | null>;
export type Track = (name: string, params?: EventParams) => void;

const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);

/**
 * First-party analytics: every event carries the venue, the scan source and a
 * per-page-load session id, and is delivered with sendBeacon so it survives
 * the tap that navigates away. Booleans are sent as 1/0 so they aggregate as
 * numbers in any warehouse.
 */
export function createTracker(base: { venueId: string | null; source: string; page: string }): Track {
  return (name, params = {}) => {
    const payload: EventParams = { session_id: sessionId, platform: "web", page: base.page, source: base.source, ...params };
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

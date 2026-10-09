import { analyticsEvent } from "@/lib/api/contracts";
import { getDb } from "@/server/db";
import { handle, parseBody, rateLimit } from "@/server/http";

/** First-party analytics sink for the landing page (sent with sendBeacon). */
export const POST = handle(async (request) => {
  rateLimit(request, "events", 240);
  const event = await parseBody(request, analyticsEvent);
  const venueId = typeof event.params?.venue_id === "string" ? event.params.venue_id.slice(0, 128) : null;
  (await (await getDb()).run("INSERT INTO events (name, params, venue_id) VALUES (?, ?, ?)", event.name, JSON.stringify(event.params ?? {}), venueId));
  return new Response(null, { status: 204 });
});

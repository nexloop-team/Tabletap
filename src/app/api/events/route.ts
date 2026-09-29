import { analyticsEvent } from "@/lib/api/contracts";
import { getDb } from "@/server/db";
import { handle, parseBody, rateLimit } from "@/server/http";

/** First-party analytics sink for the landing page (sent with sendBeacon). */
export const POST = handle(async (request) => {
  rateLimit(request, "events", 240);
  const event = await parseBody(request, analyticsEvent);
  getDb().prepare("INSERT INTO events (name, params) VALUES (?, ?)").run(event.name, JSON.stringify(event.params ?? {}));
  return new Response(null, { status: 204 });
});

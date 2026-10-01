import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/server/db";
import { venueFromRequest } from "@/server/dashboard";
import { handle, ServiceError } from "@/server/http";
import { feedbackPhotoPath } from "@/server/repositories/insights";

/** Guests' feedback photos are private to the venue, so they're served only through the dashboard. */
export const GET = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/feedback/[feedbackId]/photo">) => {
  const { venueId, feedbackId } = await ctx.params;
  const { venue } = await venueFromRequest(request, venueId);
  const relative = feedbackPhotoPath(venue.id, feedbackId);
  const file = relative ? path.resolve(DATA_DIR, relative) : null;
  if (!file || !file.startsWith(path.resolve(DATA_DIR, "uploads")) || !fs.existsSync(file)) throw new ServiceError(404, "Photo not found");
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});

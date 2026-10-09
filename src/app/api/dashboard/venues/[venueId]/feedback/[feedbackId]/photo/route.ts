import { venueFromRequest } from "@/server/dashboard";
import { handle, ServiceError } from "@/server/http";
import { feedbackPhotoPath } from "@/server/repositories/insights";
import { storage, storageKey } from "@/server/storage";

/** Guests' feedback photos are private to the venue, so they're served only through the dashboard. */
export const GET = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/feedback/[feedbackId]/photo">) => {
  const { venueId, feedbackId } = await ctx.params;
  const { venue } = await venueFromRequest(request, venueId);
  const stored = await feedbackPhotoPath(venue.id, feedbackId);
  const key = stored ? storageKey(stored) : null;
  const bytes = key?.startsWith("uploads/") ? await storage().get(key) : null;
  if (!bytes) throw new ServiceError(404, "Photo not found");
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});

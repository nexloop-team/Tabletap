import { venueFromRequest } from "@/server/dashboard";
import { handle, ServiceError } from "@/server/http";
import { getVenueRecord, restorePreviousConfig } from "@/server/repositories/venues";

/** Puts the venue's page back to how it was before the last save. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/restore">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  if (!restorePreviousConfig(venue.id)) throw new ServiceError(409, "There's no earlier version to go back to");
  return Response.json(getVenueRecord(venue.id));
});

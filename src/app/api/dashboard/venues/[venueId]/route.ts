import { deleteVenueRequest, updateVenueRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody } from "@/server/http";
import { removeVenue, updateVenue } from "@/server/services/venue-admin";

type Ctx = RouteContext<"/api/dashboard/venues/[venueId]">;

export const GET = handle(async (request, ctx: Ctx) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId);
  return Response.json(venue, { headers: { "Cache-Control": "no-store" } });
});

/** Saves whole top-level config sections (and/or the short code). */
export const PATCH = handle(async (request, ctx: Ctx) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  return Response.json(updateVenue(venue, await parseBody(request, updateVenueRequest)));
});

export const DELETE = handle(async (request, ctx: Ctx) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: "owner" });
  const { confirmName } = await parseBody(request, deleteVenueRequest);
  await removeVenue(venue, confirmName);
  return Response.json({ ok: true });
});

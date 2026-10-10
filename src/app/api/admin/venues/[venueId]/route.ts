import { adminDeleteVenueRequest, adminVenueRequest } from "@/lib/api/account-contracts";
import { requireApiAdmin } from "@/server/dashboard";
import { handle, parseBody } from "@/server/http";
import { deleteVenueAsAdmin, updateVenueAsAdmin } from "@/server/services/operator";

/** Operator actions: suspend/restore a venue, give or remove free access, extend the trial, cancel renewal. */
export const PATCH = handle(async (request, ctx: RouteContext<"/api/admin/venues/[venueId]">) => {
  const admin = await requireApiAdmin(request);
  await updateVenueAsAdmin(admin, (await ctx.params).venueId, await parseBody(request, adminVenueRequest));
  return Response.json({ ok: true });
});

/** Deletes the venue for its owner; the venue's name in the body confirms it. */
export const DELETE = handle(async (request, ctx: RouteContext<"/api/admin/venues/[venueId]">) => {
  const admin = await requireApiAdmin(request);
  const { confirmName } = await parseBody(request, adminDeleteVenueRequest);
  await deleteVenueAsAdmin(admin, (await ctx.params).venueId, confirmName);
  return Response.json({ ok: true });
});

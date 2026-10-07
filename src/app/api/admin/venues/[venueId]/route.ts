import { adminVenueRequest } from "@/lib/api/account-contracts";
import { requireApiAdmin } from "@/server/dashboard";
import { handle, parseBody } from "@/server/http";
import { updateVenueAsAdmin } from "@/server/services/operator";

/** Operator actions: suspend/restore a venue, give or remove free access, extend the trial. */
export const PATCH = handle(async (request, ctx: RouteContext<"/api/admin/venues/[venueId]">) => {
  const admin = await requireApiAdmin(request);
  updateVenueAsAdmin(admin, (await ctx.params).venueId, await parseBody(request, adminVenueRequest));
  return Response.json({ ok: true });
});

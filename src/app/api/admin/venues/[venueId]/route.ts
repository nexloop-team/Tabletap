import { adminVenueRequest } from "@/lib/api/account-contracts";
import { requireApiAdmin } from "@/server/dashboard";
import { handle, parseBody, ServiceError } from "@/server/http";
import { updateSubscription } from "@/server/repositories/subscriptions";
import { getVenueRecord, setVenueStatus } from "@/server/repositories/venues";

/** Operator actions: suspend/restore a venue, or comp/remove Pro by hand. */
export const PATCH = handle(async (request, ctx: RouteContext<"/api/admin/venues/[venueId]">) => {
  await requireApiAdmin(request);
  const { venueId } = await ctx.params;
  if (!getVenueRecord(venueId)) throw new ServiceError(404, "Venue not found");
  const input = await parseBody(request, adminVenueRequest);
  if (input.status) setVenueStatus(venueId, input.status);
  if (input.plan) {
    updateSubscription(venueId, input.plan === "pro" ? { plan: "pro", status: "active", provider: "manual" } : { plan: "free", status: "canceled" });
  }
  return Response.json({ ok: true });
});

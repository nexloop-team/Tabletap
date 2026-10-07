import { venueFromRequest } from "@/server/dashboard";
import { handle } from "@/server/http";
import { cancelSubscription } from "@/server/services/billing";

export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/billing/cancel">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await cancelSubscription(venue);
  return Response.json({ ok: true });
});

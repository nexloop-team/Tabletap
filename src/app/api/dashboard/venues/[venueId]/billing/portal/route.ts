import { venueFromRequest } from "@/server/dashboard";
import { handle, requestOrigin } from "@/server/http";
import { openBillingPortal } from "@/server/services/billing";

export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/billing/portal">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  return Response.json({ url: await openBillingPortal(venue, requestOrigin(request)) });
});

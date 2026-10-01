import { venueFromRequest } from "@/server/dashboard";
import { handle, requestOrigin } from "@/server/http";
import { startCheckout } from "@/server/services/billing";

export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/billing/checkout">) => {
  const { user, venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  return Response.json({ url: await startCheckout(venue, user, requestOrigin(request)) });
});

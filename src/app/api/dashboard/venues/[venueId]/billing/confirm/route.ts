import { venueFromRequest } from "@/server/dashboard";
import { confirmPaymentRequest } from "@/lib/api/account-contracts";
import { handle, parseBody } from "@/server/http";
import { confirmCheckout } from "@/server/services/billing";

/** Razorpay Checkout's signed success response, posted back from the billing page. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/billing/confirm">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: "owner" });
  await confirmCheckout(venue, await parseBody(request, confirmPaymentRequest));
  return Response.json({ ok: true });
});

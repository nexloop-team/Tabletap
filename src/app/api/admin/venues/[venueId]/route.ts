import { adminVenueRequest } from "@/lib/api/account-contracts";
import { requireApiAdmin } from "@/server/dashboard";
import { handle, parseBody, ServiceError } from "@/server/http";
import { extendTrial, getSubscription, updateSubscription } from "@/server/repositories/subscriptions";
import { getVenueRecord, setVenueStatus } from "@/server/repositories/venues";

/** Operator actions: suspend/restore a venue, give or remove free access, extend the trial. */
export const PATCH = handle(async (request, ctx: RouteContext<"/api/admin/venues/[venueId]">) => {
  await requireApiAdmin(request);
  const { venueId } = await ctx.params;
  if (!getVenueRecord(venueId)) throw new ServiceError(404, "Venue not found");
  const input = await parseBody(request, adminVenueRequest);
  if (input.freeAccess !== undefined) {
    const sub = getSubscription(venueId);
    if (sub?.provider === "razorpay" && sub.paid && sub.status !== "canceled") {
      throw new ServiceError(409, "This venue pays through Razorpay. Cancel it in the Razorpay dashboard first.");
    }
    updateSubscription(
      venueId,
      input.freeAccess
        ? { paid: true, status: "active", provider: "manual", currentPeriodEnd: null, cancelAtPeriodEnd: false }
        : { paid: false, status: "canceled", currentPeriodEnd: null, cancelAtPeriodEnd: false },
    );
  }
  if (input.extendTrialDays) extendTrial(venueId, input.extendTrialDays);
  if (input.status) setVenueStatus(venueId, input.status);
  return Response.json({ ok: true });
});

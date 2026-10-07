import "server-only";
import { accessState, parseDbDate, PRICE_INR, trialDaysLeft, type SubscriptionState, type SubscriptionStatus } from "@/lib/plans";
import { listUsersForAdmin } from "./repositories/users";
import { listVenuesForAdmin } from "./repositories/venues";

/**
 * One bucket per venue, so filters and counts in the operator console always
 * add up. "free" is access an admin gave by hand (and the demo venues).
 */
export type VenueSegment = "paying" | "free" | "trial" | "unpaid" | "suspended";

export const VENUE_LIMIT = 500;
export const USER_LIMIT = 200;

export function adminVenues() {
  return listVenuesForAdmin(VENUE_LIMIT).map((venue) => {
    const sub: SubscriptionState = {
      paid: venue.paid,
      status: (venue.subscriptionStatus ?? "active") as SubscriptionStatus,
      trialEndsAt: venue.trialEndsAt,
      currentPeriodEnd: venue.currentPeriodEnd,
    };
    const access = accessState(sub);
    const paying = access === "paid" && (venue.provider === "razorpay" || venue.provider === "dev");
    const segment: VenueSegment =
      venue.status === "suspended" ? "suspended" : access === "paid" ? (paying ? "paying" : "free") : access === "trial" ? "trial" : "unpaid";
    return { ...venue, access, paying, segment, trialDays: trialDaysLeft(sub), pastDue: access === "paid" && venue.subscriptionStatus === "past_due" };
  });
}

export type AdminVenue = ReturnType<typeof adminVenues>[number];

/** Revenue in rupees, before GST. Dev-mode subscriptions count, so the numbers can be tried locally. */
export function revenueSummary(venues: AdminVenue[], now = Date.now()) {
  const paying = venues.filter((venue) => venue.segment === "paying" || (venue.paying && venue.segment === "suspended"));
  const renewing = paying.filter((venue) => !venue.cancelAtPeriodEnd);
  const monthAgo = now - 30 * 86_400_000;
  const lapsed = venues.filter(
    (venue) =>
      (venue.provider === "razorpay" || venue.provider === "dev") &&
      venue.access !== "paid" &&
      (parseDbDate(venue.subscriptionUpdatedAt) ?? 0) > monthAgo,
  );
  const arr = renewing.length * PRICE_INR;
  return {
    paying: paying.length,
    arr,
    mrr: Math.round(arr / 12),
    wontRenew: paying.length - renewing.length,
    lapsed30d: lapsed.length,
    /** Of the venues paying a month ago (still paying + lapsed since), the share that lapsed. */
    churn30d: paying.length + lapsed.length ? lapsed.length / (paying.length + lapsed.length) : 0,
    pastDue: venues.filter((venue) => venue.pastDue).length,
    trialsEndingThisWeek: venues.filter((venue) => venue.segment === "trial" && venue.trialDays !== null && venue.trialDays <= 7).length,
  };
}

export function adminUsers() {
  return listUsersForAdmin(USER_LIMIT);
}

/** Created within the last `days` days. */
export function isRecent(value: string, days = 7): boolean {
  return (parseDbDate(value) ?? 0) > Date.now() - days * 86_400_000;
}

/** Case-insensitive match on any of the given fields. */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((field) => field?.toLowerCase().includes(q));
}

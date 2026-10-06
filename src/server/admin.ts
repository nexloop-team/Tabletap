import "server-only";
import { effectivePlan, parseDbDate, trialDaysLeft, type SubscriptionState, type SubscriptionStatus } from "@/lib/plans";
import { listUsersForAdmin } from "./repositories/users";
import { listVenuesForAdmin } from "./repositories/venues";

/** One bucket per venue, so filters and counts in the operator console always add up. */
export type VenueSegment = "paying" | "trial" | "free" | "suspended";

export const VENUE_LIMIT = 500;
export const USER_LIMIT = 200;

export function adminVenues() {
  return listVenuesForAdmin(VENUE_LIMIT).map((venue) => {
    const sub: SubscriptionState = {
      plan: venue.plan,
      status: (venue.subscriptionStatus ?? "active") as SubscriptionStatus,
      trialEndsAt: venue.trialEndsAt,
      currentPeriodEnd: null,
    };
    const paying = venue.plan === "pro" && venue.subscriptionStatus !== "canceled";
    const effective = effectivePlan(sub);
    const segment: VenueSegment = venue.status === "suspended" ? "suspended" : paying ? "paying" : effective === "pro" ? "trial" : "free";
    return { ...venue, paying, effective, segment, trialDays: trialDaysLeft(sub), pastDue: venue.subscriptionStatus === "past_due" };
  });
}

export type AdminVenue = ReturnType<typeof adminVenues>[number];

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

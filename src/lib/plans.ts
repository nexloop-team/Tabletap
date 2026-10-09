/**
 * One subscription, billed per venue. While it's paid or the free trial is
 * running, every feature is on; once neither, the guest page goes offline
 * (the owner can still sign in, change things and pay). Saved configuration
 * is never touched, so the page comes back exactly as it was.
 */

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

/** Paid (or given free access by an admin), within the free trial, or neither. */
export type AccessState = "paid" | "trial" | "unpaid";

export const TRIAL_DAYS = 7;

/** Prices in rupees. GST is charged on top and shown alongside. */
export const PRICE_INR = 999;
export const GST_RATE = 0.18;
export const PRICE_WITH_GST_INR = Math.round(PRICE_INR * (1 + GST_RATE) * 100) / 100;
export const BILLING_PERIOD = "year";

/** ₹999 · ₹1,178.82 (paise only when there are any). */
export function formatInr(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
}

export const PLAN_FEATURES = [
  "Hosted menu with photos, allergens and AI import",
  "Digital stamp cards, stamped at the till",
  "Wi-Fi card with optional email capture",
  "Private feedback box and Google review invitations",
  "Guest list with marketing consent and CSV export",
  "Reward, birthday and win-back emails",
  "Refer-a-friend rewards",
  "Layouts, typography and no third-party branding",
  "Unlimited QR codes, scan analytics and weekly summary",
];

export interface SubscriptionState {
  /** A paid subscription (or free access an admin gave) is on file. */
  paid: boolean;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

/** The database's "YYYY-MM-DD HH:MM:SS" format (UTC, no zone) or ISO; both parse as UTC here. */
export function parseDbDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

/** Room for a late renewal webhook before a lapsed period takes the page offline. */
const RENEWAL_GRACE_MS = 3 * 86_400_000;

/**
 * Paid while the subscription is live (a failed renewal keeps it during the
 * provider's retry window) and its period hasn't run out; otherwise the free
 * trial, if any of it is left.
 */
export function accessState(sub: SubscriptionState | null, now = Date.now()): AccessState {
  if (!sub) return "unpaid";
  if (sub.paid && sub.status !== "canceled") {
    const end = parseDbDate(sub.currentPeriodEnd);
    if (end === null || end + RENEWAL_GRACE_MS > now) return "paid";
  }
  const trialEnd = parseDbDate(sub.trialEndsAt);
  return trialEnd !== null && trialEnd > now ? "trial" : "unpaid";
}

export function hasAccess(sub: SubscriptionState | null, now = Date.now()): boolean {
  return accessState(sub, now) !== "unpaid";
}

/** Whole days left in the free trial, or null when not on one. */
export function trialDaysLeft(sub: SubscriptionState | null, now = Date.now()): number | null {
  if (accessState(sub, now) !== "trial") return null;
  return Math.ceil((parseDbDate(sub!.trialEndsAt)! - now) / 86_400_000);
}

/** The short status shown next to a venue: "Active", "Trial · 3 days left", "Unpaid". */
export function accessBadge(sub: SubscriptionState | null, now = Date.now()): { label: string; className: string } {
  const state = accessState(sub, now);
  if (state === "paid") return sub?.status === "past_due" ? { label: "Payment retrying", className: "badge-danger" } : { label: "Active", className: "badge-ok" };
  if (state === "trial") {
    const days = trialDaysLeft(sub, now)!;
    return { label: `Trial · ${days} day${days === 1 ? "" : "s"} left`, className: "badge-pro" };
  }
  return { label: "Unpaid", className: "badge-danger" };
}

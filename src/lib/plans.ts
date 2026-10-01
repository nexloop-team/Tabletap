/**
 * Plans and what each unlocks. The landing page is filtered through these
 * entitlements when it is served, so a lapsed subscription switches features
 * off without touching the merchant's saved configuration.
 */

export type PlanId = "free" | "pro";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface Entitlements {
  /** Stamp cards and rewards-only memberships. */
  loyalty: boolean;
  /** Guest capture: Wi-Fi email gate, marketing consent, birthdays, feedback join. */
  crm: boolean;
  /** Classic / editorial / modern typography presets. */
  stylePresets: boolean;
  /** Hide the "Powered by" footer on the guest page. */
  removeBranding: boolean;
  /** Download the guest list as CSV. */
  guestExport: boolean;
}

export const ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: { loyalty: false, crm: false, stylePresets: false, removeBranding: false, guestExport: false },
  pro: { loyalty: true, crm: true, stylePresets: true, removeBranding: true, guestExport: true },
};

export const TRIAL_DAYS = 14;

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: string;
  blurb: string;
  features: string[];
}

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Free",
    price: "Free",
    blurb: "Everything a table needs.",
    features: ["Hosted menu with allergens", "Wi-Fi card", "Feedback box with Google review routing", "Custom links and socials", "Unlimited QR codes", "Scan analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    price: process.env.NEXT_PUBLIC_PRO_PRICE_LABEL || "£19 / month per venue",
    blurb: "Turn first visits into regulars.",
    features: ["Everything in Free", "Digital loyalty stamp cards", "Guest list with marketing consent", "Wi-Fi email capture and birthdays", "Typography presets", "Remove our branding", "CSV export"],
  },
];

export interface SubscriptionState {
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

/** SQLite's datetime('now') format (UTC, no zone) or ISO; both parse as UTC here. */
export function parseDbDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

/** Pro while paid (a failed renewal keeps it during the retry window) or within the free trial. */
export function effectivePlan(sub: SubscriptionState | null, now = Date.now()): PlanId {
  if (!sub) return "free";
  if (sub.plan === "pro" && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due")) return "pro";
  const trialEnd = parseDbDate(sub.trialEndsAt);
  return trialEnd !== null && trialEnd > now ? "pro" : "free";
}

/** Whole days left in the free trial, or null when not on one. */
export function trialDaysLeft(sub: SubscriptionState | null, now = Date.now()): number | null {
  if (!sub || (sub.plan === "pro" && sub.status !== "canceled")) return null;
  const trialEnd = parseDbDate(sub.trialEndsAt);
  if (trialEnd === null || trialEnd <= now) return null;
  return Math.ceil((trialEnd - now) / 86_400_000);
}

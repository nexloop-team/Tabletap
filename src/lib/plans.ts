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
  /** Guest page and menu layout presets, header styles and button shapes. */
  layouts: boolean;
  /** Hide the "Powered by" footer on the guest page. */
  removeBranding: boolean;
  /** Download the guest list as CSV. */
  guestExport: boolean;
  /** AI menu import and "What's this dish?" drafts. */
  ai: boolean;
  /** Reward-ready, birthday and win-back emails to guests. */
  automations: boolean;
  /** Refer-a-friend stamps. */
  referrals: boolean;
}

export const ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: { loyalty: false, crm: false, stylePresets: false, layouts: false, removeBranding: false, guestExport: false, ai: false, automations: false, referrals: false },
  pro: { loyalty: true, crm: true, stylePresets: true, layouts: true, removeBranding: true, guestExport: true, ai: true, automations: true, referrals: true },
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
    features: ["Hosted menu with allergens", "Wi-Fi card", "Private feedback box and Google review invitations", "Custom links and socials", "Unlimited QR codes", "Scan analytics and weekly summary email"],
  },
  {
    id: "pro",
    name: "Pro",
    price: process.env.NEXT_PUBLIC_PRO_PRICE_LABEL || "£19 / month per venue",
    blurb: "Turn first visits into regulars.",
    features: [
      "Everything in Free",
      "Digital stamp cards, stamped at the till",
      "Refer-a-friend rewards",
      "Automatic reward, birthday and win-back emails",
      "AI menu import and dish explanations",
      "Guest list with marketing consent",
      "Wi-Fi email capture and birthdays",
      "Layouts, typography presets and no branding",
      "CSV export",
    ],
  },
];

/** "£19 / month per venue" → ["£19", "/ month per venue"]; the free plan reads "£0 forever". */
export function planPriceParts(plan: PlanInfo): [amount: string, per: string] {
  if (plan.id === "free") return ["£0", "forever"];
  const space = plan.price.indexOf(" ");
  return space < 0 ? [plan.price, ""] : [plan.price.slice(0, space), plan.price.slice(space + 1)];
}

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

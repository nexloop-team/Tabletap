import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { effectivePlan, ENTITLEMENTS, type Entitlements, type PlanId, type SubscriptionState, type SubscriptionStatus } from "@/lib/plans";
import { getDb } from "../db";

export interface Subscription extends SubscriptionState {
  venueId: string;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
}

interface SubscriptionRow {
  venue_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    venueId: row.venue_id,
    plan: row.plan === "pro" ? "pro" : "free",
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
  };
}

export function getSubscription(venueId: string): Subscription | null {
  const row = getDb().prepare("SELECT * FROM subscriptions WHERE venue_id = ?").get(venueId) as SubscriptionRow | undefined;
  return row ? toSubscription(row) : null;
}

export function findSubscriptionByProviderId(providerSubscriptionId: string): Subscription | null {
  const row = getDb().prepare("SELECT * FROM subscriptions WHERE provider_subscription_id = ?").get(providerSubscriptionId) as SubscriptionRow | undefined;
  return row ? toSubscription(row) : null;
}

export function entitlementsFor(venueId: string): { plan: PlanId; can: Entitlements } {
  const plan = effectivePlan(getSubscription(venueId));
  return { plan, can: ENTITLEMENTS[plan] };
}

/** New venues start on Free with a Pro trial running. */
export function startTrial(db: DatabaseSync, venueId: string, trialDays: number) {
  db.prepare("INSERT INTO subscriptions (venue_id, plan, status, trial_ends_at) VALUES (?, 'free', 'active', ?)").run(
    venueId,
    new Date(Date.now() + trialDays * 86_400_000).toISOString(),
  );
}

export interface SubscriptionUpdate {
  plan?: PlanId;
  status?: SubscriptionStatus;
  currentPeriodEnd?: string | null;
  provider?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
}

const COLUMNS: Record<keyof SubscriptionUpdate, string> = {
  plan: "plan",
  status: "status",
  currentPeriodEnd: "current_period_end",
  provider: "provider",
  providerCustomerId: "provider_customer_id",
  providerSubscriptionId: "provider_subscription_id",
};

export function updateSubscription(venueId: string, update: SubscriptionUpdate) {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO subscriptions (venue_id) VALUES (?)").run(venueId);
  const keys = (Object.keys(update) as (keyof SubscriptionUpdate)[]).filter((key) => update[key] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((key) => `${COLUMNS[key]} = ?`).join(", ");
  db.prepare(`UPDATE subscriptions SET ${sets}, updated_at = datetime('now') WHERE venue_id = ?`).run(
    ...keys.map((key) => update[key] ?? null),
    venueId,
  );
}

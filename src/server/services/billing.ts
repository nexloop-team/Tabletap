import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SubscriptionStatus } from "@/lib/plans";
import { ServiceError } from "../http";
import type { User } from "../repositories/users";
import { findSubscriptionByProviderId, getSubscription, updateSubscription } from "../repositories/subscriptions";
import type { VenueRecord } from "../repositories/venues";

/**
 * Stripe Billing over its REST API (no SDK): Checkout to subscribe, the
 * Customer Portal to change card or cancel, and a signed webhook that keeps
 * the `subscriptions` table in step. One subscription per venue.
 *
 * Without STRIPE_SECRET_KEY, and outside production, billing runs in dev
 * mode: "Upgrade" switches the venue to Pro directly so every gated feature
 * can be tried locally.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export function billingMode(): "stripe" | "dev" | "disabled" {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID) return "stripe";
  if (process.env.NODE_ENV !== "production" || process.env.BILLING_DEV_MODE === "1") return "dev";
  return "disabled";
}

async function stripe<T>(path: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    console.error(`[billing] Stripe ${path} ${response.status}`, body.error?.message);
    throw new ServiceError(502, "The payment provider didn't respond as expected. Please try again.");
  }
  return body;
}

/** Returns the URL to send the merchant to. */
export async function startCheckout(venue: VenueRecord, user: User, origin: string): Promise<string> {
  const mode = billingMode();
  const billingPage = `${origin}/dashboard/${venue.id}/billing`;
  if (mode === "disabled") throw new ServiceError(503, "Billing isn't set up yet");
  if (mode === "dev") {
    updateSubscription(venue.id, { plan: "pro", status: "active", provider: "dev", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    return `${billingPage}?upgraded=1`;
  }
  const existing = getSubscription(venue.id);
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
    "line_items[0][quantity]": "1",
    success_url: `${billingPage}?upgraded=1`,
    cancel_url: billingPage,
    client_reference_id: venue.id,
    "metadata[venue_id]": venue.id,
    "subscription_data[metadata][venue_id]": venue.id,
    "subscription_data[description]": venue.config.name,
    allow_promotion_codes: "true",
  };
  if (existing?.providerCustomerId) params.customer = existing.providerCustomerId;
  else params.customer_email = user.email;
  const session = await stripe<{ url: string }>("/checkout/sessions", params);
  return session.url;
}

export async function openBillingPortal(venue: VenueRecord, origin: string): Promise<string> {
  const billingPage = `${origin}/dashboard/${venue.id}/billing`;
  const sub = getSubscription(venue.id);
  if (billingMode() === "dev" || sub?.provider === "dev") {
    // Dev stand-in for the portal: cancelling drops straight back to Free.
    updateSubscription(venue.id, { plan: "free", status: "canceled", currentPeriodEnd: null });
    return `${billingPage}?canceled=1`;
  }
  if (!sub?.providerCustomerId) throw new ServiceError(400, "There's no billing account for this venue yet");
  const session = await stripe<{ url: string }>("/billing_portal/sessions", { customer: sub.providerCustomerId, return_url: billingPage });
  return session.url;
}

/**
 * Verifies the `Stripe-Signature` header: HMAC-SHA256 of `${t}.${body}` with
 * the endpoint secret, within five minutes, compared in constant time.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=") as [string, string]);
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** null for "incomplete": the first payment is still in flight, and checkout completion already recorded it. */
function mapStatus(status: string): SubscriptionStatus | null {
  if (status === "active" || status === "trialing" || status === "past_due") return status;
  if (status === "incomplete") return null;
  return "canceled";
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
}

function applySubscription(sub: StripeSubscription) {
  const venueId = sub.metadata?.venue_id ?? findSubscriptionByProviderId(sub.id)?.venueId;
  if (!venueId) {
    console.warn(`[billing] subscription ${sub.id} has no venue`);
    return;
  }
  const status = mapStatus(sub.status);
  if (!status) return;
  // Newer API versions moved the period end onto each item.
  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  updateSubscription(venueId, {
    plan: status === "canceled" ? "free" : "pro",
    status,
    provider: "stripe",
    providerCustomerId: sub.customer,
    providerSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });
}

export function handleStripeEvent(event: { type: string; data: { object: Record<string, unknown> } }) {
  const object = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const venueId = (object.client_reference_id as string | null) ?? (object.metadata as Record<string, string> | undefined)?.venue_id;
      if (!venueId || object.mode !== "subscription") return;
      updateSubscription(venueId, {
        plan: "pro",
        status: "active",
        provider: "stripe",
        providerCustomerId: object.customer as string,
        providerSubscriptionId: object.subscription as string,
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      applySubscription(object as unknown as StripeSubscription);
      return;
  }
}

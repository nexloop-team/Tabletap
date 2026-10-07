import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { BILLING_PERIOD, formatInr, PRICE_INR, type SubscriptionStatus } from "@/lib/plans";
import { BRAND } from "@/config/brand";
import type { CheckoutStart, ConfirmPaymentRequest } from "@/lib/api/account-contracts";
import { ServiceError } from "../http";
import type { User } from "../repositories/users";
import { findSubscriptionByProviderId, getSubscription, updateSubscription } from "../repositories/subscriptions";
import type { VenueRecord } from "../repositories/venues";

/**
 * Razorpay Subscriptions over its REST API (no SDK). One yearly plan, one
 * subscription per venue:
 *
 * - "Subscribe" creates a subscription and opens Razorpay Checkout on the
 *   billing page; the signed payment response switches the venue on at once.
 * - A signed webhook keeps the `subscriptions` table in step with renewals,
 *   failed charges and cancellations.
 * - "Cancel" stops renewal at the end of the paid year.
 *
 * Without Razorpay keys, and outside production, billing runs in dev mode:
 * "Subscribe" switches the venue on for a year without payment.
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";
const YEAR_MS = 365 * 86_400_000;
/** Razorpay needs a number of billing cycles; ten years is "until cancelled" for us. */
const TOTAL_CYCLES = 10;

export function billingMode(): "razorpay" | "dev" | "disabled" {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_PLAN_ID) return "razorpay";
  if (process.env.NODE_ENV !== "production" || process.env.BILLING_DEV_MODE === "1") return "dev";
  return "disabled";
}

async function razorpay<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json()) as T & { error?: { description?: string } };
  if (!response.ok) {
    console.error(`[billing] Razorpay ${method} ${path} ${response.status}`, json.error?.description);
    throw new ServiceError(502, "The payment provider didn't respond as expected. Please try again.");
  }
  return json;
}

interface RazorpaySubscription {
  id: string;
  status: string;
  customer_id?: string | null;
  current_end?: number | null;
  notes?: Record<string, string> | unknown[];
  short_url?: string;
}

export async function startCheckout(venue: VenueRecord, user: User, origin: string): Promise<CheckoutStart> {
  const mode = billingMode();
  const billingPage = `${origin}/dashboard/${venue.id}/billing`;
  if (mode === "disabled") throw new ServiceError(503, "Payments aren't set up yet");
  if (mode === "dev") {
    updateSubscription(venue.id, { paid: true, status: "active", provider: "dev", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(Date.now() + YEAR_MS).toISOString() });
    return { kind: "redirect", url: `${billingPage}?subscribed=1` };
  }
  const sub = await razorpay<RazorpaySubscription>("POST", "/subscriptions", {
    plan_id: process.env.RAZORPAY_PLAN_ID,
    total_count: TOTAL_CYCLES,
    quantity: 1,
    customer_notify: 1,
    notes: { venue_id: venue.id, venue_name: venue.config.name.slice(0, 200), owner_email: user.email },
  });
  return {
    kind: "razorpay",
    keyId: process.env.RAZORPAY_KEY_ID!,
    subscriptionId: sub.id,
    name: BRAND.name,
    description: `${venue.config.name}: ${formatInr(PRICE_INR)} + GST a ${BILLING_PERIOD}`,
    prefill: { name: user.name, email: user.email },
    fallbackUrl: sub.short_url ?? null,
  };
}

/**
 * Razorpay Checkout's success response is signed with the key secret over
 * `${payment_id}|${subscription_id}`. A valid one means the first payment
 * went through, so the venue goes live without waiting for the webhook.
 */
export function verifyCheckoutSignature(paymentId: string, subscriptionId: string, signature: string, secret: string): boolean {
  return safeEqualHex(signature, createHmac("sha256", secret).update(`${paymentId}|${subscriptionId}`).digest());
}

export async function confirmCheckout(venue: VenueRecord, input: ConfirmPaymentRequest) {
  if (billingMode() !== "razorpay") throw new ServiceError(400, "Payments aren't set up yet");
  if (!verifyCheckoutSignature(input.paymentId, input.subscriptionId, input.signature, process.env.RAZORPAY_KEY_SECRET!)) {
    throw new ServiceError(400, "We couldn't confirm that payment. If you were charged, it will show up here within a few minutes.");
  }
  const sub = await razorpay<RazorpaySubscription>("GET", `/subscriptions/${encodeURIComponent(input.subscriptionId)}`);
  if (venueIdFromNotes(sub.notes) !== venue.id) throw new ServiceError(400, "That payment belongs to a different venue");
  updateSubscription(venue.id, {
    paid: true,
    status: "active",
    provider: "razorpay",
    providerCustomerId: sub.customer_id ?? null,
    providerSubscriptionId: sub.id,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(sub.current_end ? sub.current_end * 1000 : Date.now() + YEAR_MS).toISOString(),
  });
}

/** Stops renewal; the venue stays live until the end of the year it paid for. */
export async function cancelSubscription(venue: VenueRecord) {
  const sub = getSubscription(venue.id);
  if (!sub?.paid) throw new ServiceError(400, "There's no subscription to cancel");
  if (sub.provider === "dev" || billingMode() === "dev") {
    // Dev stand-in: ends straight away so the unpaid state can be tried locally.
    updateSubscription(venue.id, { paid: false, status: "canceled", cancelAtPeriodEnd: false, currentPeriodEnd: null });
    return;
  }
  if (sub.provider !== "razorpay" || !sub.providerSubscriptionId) throw new ServiceError(400, "This subscription is managed by support. Contact us to change it.");
  await razorpay("POST", `/subscriptions/${encodeURIComponent(sub.providerSubscriptionId)}/cancel`, { cancel_at_cycle_end: 1 });
  updateSubscription(venue.id, { cancelAtPeriodEnd: true });
}

/** Before a venue is deleted: stop Razorpay charging for it. Best effort; a failure is logged for follow-up by hand. */
export async function stopBilling(venueId: string) {
  const sub = getSubscription(venueId);
  if (billingMode() !== "razorpay" || sub?.provider !== "razorpay" || !sub.paid || !sub.providerSubscriptionId) return;
  try {
    await razorpay("POST", `/subscriptions/${encodeURIComponent(sub.providerSubscriptionId)}/cancel`, { cancel_at_cycle_end: 0 });
  } catch (error) {
    console.error(`[billing] couldn't cancel ${sub.providerSubscriptionId} for deleted venue ${venueId}; cancel it in the Razorpay dashboard`, error);
  }
}

function safeEqualHex(given: string, expected: Buffer): boolean {
  const buffer = Buffer.from(given, "hex");
  return buffer.length === expected.length && timingSafeEqual(buffer, expected);
}

/** `X-Razorpay-Signature`: hex HMAC-SHA256 of the raw request body with the webhook secret. */
export function verifyWebhookSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  return safeEqualHex(header, createHmac("sha256", secret).update(payload).digest());
}

/**
 * Razorpay → ours. "pending" is a failed renewal that Razorpay is still
 * retrying, so the page stays up; "halted" means the retries ran out.
 * null: not live yet (created / authenticated), nothing to record.
 */
export function mapStatus(status: string): { paid: boolean; status: SubscriptionStatus } | null {
  switch (status) {
    case "active":
      return { paid: true, status: "active" };
    case "pending":
      return { paid: true, status: "past_due" };
    case "created":
    case "authenticated":
      return null;
    default:
      // halted, cancelled, completed, expired, paused
      return { paid: false, status: "canceled" };
  }
}

function venueIdFromNotes(notes: RazorpaySubscription["notes"]): string | undefined {
  return notes && !Array.isArray(notes) ? notes.venue_id : undefined;
}

interface RazorpayEvent {
  event: string;
  payload?: { subscription?: { entity?: RazorpaySubscription } };
}

export function handleRazorpayEvent(event: RazorpayEvent) {
  const sub = event.payload?.subscription?.entity;
  if (!event.event.startsWith("subscription.") || !sub) return;
  const venueId = venueIdFromNotes(sub.notes) ?? findSubscriptionByProviderId(sub.id)?.venueId;
  if (!venueId) {
    console.warn(`[billing] subscription ${sub.id} has no venue`);
    return;
  }
  const mapped = mapStatus(sub.status);
  if (!mapped) return;
  const current = getSubscription(venueId);
  // An older subscription for the same venue (say, one replaced after a lapse) mustn't switch the newer one off.
  if (current?.providerSubscriptionId && current.providerSubscriptionId !== sub.id && current.paid && !mapped.paid) return;
  updateSubscription(venueId, {
    ...mapped,
    provider: "razorpay",
    providerCustomerId: sub.customer_id ?? null,
    providerSubscriptionId: sub.id,
    ...(mapped.paid ? {} : { cancelAtPeriodEnd: false }),
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : (current?.currentPeriodEnd ?? null),
  });
}

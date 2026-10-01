import { handleStripeEvent, verifyStripeSignature } from "@/server/services/billing";

/** Stripe → us. Signed with STRIPE_WEBHOOK_SECRET; anything unsigned is refused. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return new Response("Bad signature", { status: 400 });
  }
  try {
    handleStripeEvent(JSON.parse(payload));
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    console.error("[billing] webhook failed", error);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

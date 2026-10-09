import { handleRazorpayEvent, verifyWebhookSignature } from "@/server/services/billing";

/** Razorpay → us. Signed with RAZORPAY_WEBHOOK_SECRET; anything unsigned is refused. */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const payload = await request.text();
  if (!verifyWebhookSignature(payload, request.headers.get("x-razorpay-signature"), secret)) {
    return new Response("Bad signature", { status: 400 });
  }
  try {
    await handleRazorpayEvent(JSON.parse(payload));
  } catch (error) {
    // A 5xx makes Razorpay retry, which is what we want for a transient failure.
    console.error("[billing] webhook failed", error);
    return new Response("Handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

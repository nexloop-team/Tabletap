import { getDb } from "@/server/db";
import { confirmConsent } from "@/server/services/consent";

/** Target of the double-opt-in link emailed after a guest ticks the consent box. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const confirmed = token.length > 0 && confirmConsent(getDb(), token);
  return Response.redirect(new URL(`/consent?status=${confirmed ? "confirmed" : "invalid"}`, request.url), 303);
}

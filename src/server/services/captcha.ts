import "server-only";
import { ServiceError } from "../http";

/**
 * Cloudflare Turnstile. Off unless TURNSTILE_SECRET_KEY is set (with
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY for the widget), so local development and
 * tests never need a network round trip.
 */
export function captchaEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyCaptcha(token: string | undefined, request: Request): Promise<void> {
  if (!captchaEnabled()) return;
  if (!token) throw new ServiceError(400, "Please complete the check that you're not a robot");
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (ip) body.set("remoteip", ip);
  let ok = false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    ok = ((await response.json()) as { success?: boolean }).success === true;
  } catch (error) {
    console.error("[captcha] verification unreachable", error);
    throw new ServiceError(503, "We couldn't check the captcha just now. Please try again.");
  }
  if (!ok) throw new ServiceError(400, "The robot check failed. Please try again.");
}

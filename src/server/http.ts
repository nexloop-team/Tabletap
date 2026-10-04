import "server-only";
import type { z } from "zod";

/** Thrown by services; routes turn it into a JSON error with this status. */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ServiceError(400, "Request body must be JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ServiceError(400, result.error.issues[0]?.message ?? "Invalid request");
  return result.data;
}

/**
 * Origin for absolute links in emails and the same-origin check. APP_URL wins
 * when set: request headers are client-controlled, so trusting them would let
 * anyone send a password-reset email whose link points at their own site.
 * Without APP_URL (local development) the proxy headers are honoured.
 */
export function requestOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return forwardedHost ? `${proto}://${forwardedHost}` : url.origin;
}

function clientKey(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

const buckets = new Map<string, number[]>();

/**
 * Fixed-window-ish limiter kept in process memory: enough to stop a script
 * hammering a write endpoint from one address. Behind several instances this
 * needs a shared store (Redis) instead.
 */
export function rateLimit(request: Request, route: string, limit: number, windowMs = 60_000) {
  rateLimitKey(`${route}:${clientKey(request)}`, limit, windowMs);
}

/** The same limiter on any key, e.g. per account email for login attempts. */
export function rateLimitKey(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new ServiceError(429, "Too many requests, please try again shortly");
  hits.push(now);
  buckets.set(key, hits);
}

/**
 * CSRF guard for cookie-authenticated writes. SameSite=Lax already keeps the
 * session cookie off cross-site POSTs; this also refuses any request a
 * browser marks as coming from another origin.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin !== requestOrigin(request) && origin !== new URL(request.url).origin) throw new ServiceError(403, "Cross-origin request refused");
    return;
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ServiceError(403, "Cross-origin request refused");
}

/** Wraps a handler so ServiceErrors become JSON responses and anything else a 500. */
export function handle<C = unknown>(fn: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (error) {
      if (error instanceof ServiceError) return jsonError(error.status, error.message);
      console.error(error);
      return jsonError(500, "Internal error");
    }
  };
}

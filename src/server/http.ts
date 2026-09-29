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

/** Origin for absolute links in emails; honours the proxy header when present. */
export function requestOrigin(request: Request): string {
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
  const key = `${route}:${clientKey(request)}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new ServiceError(429, "Too many requests, please try again shortly");
  hits.push(now);
  buckets.set(key, hits);
}

/** Wraps a handler so ServiceErrors become JSON responses and anything else a 500. */
export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request);
    } catch (error) {
      if (error instanceof ServiceError) return jsonError(error.status, error.message);
      console.error(error);
      return jsonError(500, "Internal error");
    }
  };
}

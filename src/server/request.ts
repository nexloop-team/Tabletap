import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { findPausedVenue, findVenue } from "./repositories/venues";

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

/** The venue code from a QR link: `i` (short form) or `id`. */
export function venueParam(params: SearchParams): string {
  return firstParam(params.i) || firstParam(params.id);
}

/** The scan source (`s`), e.g. which table's QR code. */
export function sourceParam(params: SearchParams): string {
  return firstParam(params.s).slice(0, 64) || "unknown";
}

/** Rebuilds the query string so links between the venue's pages keep `i` and `s`. */
export function queryString(params: SearchParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

/** This deployment's public origin for links shown in the dashboard (APP_URL wins when set). */
export async function serverOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** A paused venue for the "Back soon" page; see findPausedVenue. */
export const loadPausedVenue = cache(async (idOrCode: string) => (idOrCode ? await findPausedVenue(idOrCode) : null));

/** One lookup per request, shared by generateMetadata and the page. */
export const loadVenue = cache(async (idOrCode: string) => (idOrCode ? await findVenue(idOrCode) : null));

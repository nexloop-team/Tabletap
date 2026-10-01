import { venueFromRequest } from "@/server/dashboard";
import { handle, requestOrigin } from "@/server/http";
import { guestPageUrl, publicOrigin, qrPng, qrSvg } from "@/server/services/qr";

/** `?s=<source>&format=svg|png&size=<px>&color=<hex>&download=1` — a QR code for the venue's guest page. */
export const GET = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/qr">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId);
  const params = new URL(request.url).searchParams;
  const source = (params.get("s") ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64) || null;
  const rawColor = params.get("color") ?? "";
  const color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : "#000000";
  const url = guestPageUrl(publicOrigin(requestOrigin(request)), venue.shortCode, source);
  const png = params.get("format") === "png";
  const filename = `${venue.shortCode}${source ? `-${source}` : ""}-qr.${png ? "png" : "svg"}`;
  const headers: Record<string, string> = { "Cache-Control": "private, max-age=300" };
  if (params.get("download")) headers["Content-Disposition"] = `attachment; filename="${filename}"`;

  if (png) {
    const size = Math.min(Math.max(Number(params.get("size")) || 1024, 128), 4096);
    return new Response(new Uint8Array(await qrPng(url, size, color)), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new Response(await qrSvg(url, color), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
});

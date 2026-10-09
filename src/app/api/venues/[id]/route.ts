import { jsonError } from "@/server/http";
import { findVenue } from "@/server/repositories/venues";

/** Public venue profile for the landing page. `id` may be the id or the QR short code. */
export async function GET(_request: Request, ctx: RouteContext<"/api/venues/[id]">) {
  const { id } = await ctx.params;
  const venue = await findVenue(decodeURIComponent(id).trim());
  if (!venue) return jsonError(404, "Venue not found");
  return Response.json(venue, { headers: { "Cache-Control": "no-store" } });
}

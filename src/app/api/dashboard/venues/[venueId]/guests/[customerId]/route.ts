import { transaction } from "@/server/db";
import { venueFromRequest } from "@/server/dashboard";
import { handle, ServiceError } from "@/server/http";
import { deleteGuest } from "@/server/repositories/customers";

/** Erases one guest, e.g. when they ask the venue to delete their data. */
export const DELETE = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/guests/[customerId]">) => {
  const { venueId, customerId } = await ctx.params;
  const { venue } = await venueFromRequest(request, venueId, { write: true });
  if (!(await transaction((db) => deleteGuest(db, venue.id, customerId)))) throw new ServiceError(404, "Guest not found");
  return Response.json({ ok: true });
});

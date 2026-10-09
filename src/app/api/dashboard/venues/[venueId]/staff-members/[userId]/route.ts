import { venueFromRequest } from "@/server/dashboard";
import { handle, ServiceError } from "@/server/http";
import { removeStaffMember } from "@/server/repositories/venues";

/** Removes a staff login; till devices that login opened stop working too. */
export const DELETE = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/staff-members/[userId]">) => {
  const params = await ctx.params;
  const { venue } = await venueFromRequest(request, params.venueId, { write: true });
  if (!await removeStaffMember(venue.id, params.userId)) throw new ServiceError(404, "That staff member isn't on this venue");
  return Response.json({ ok: true });
});

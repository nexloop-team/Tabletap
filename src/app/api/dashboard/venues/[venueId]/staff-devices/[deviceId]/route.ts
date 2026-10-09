import { venueFromRequest } from "@/server/dashboard";
import { handle } from "@/server/http";
import { revokeStaffDevice } from "@/server/services/staff";

/** Unpairs a till device; its cookie stops working immediately. */
export const DELETE = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/staff-devices/[deviceId]">) => {
  const { venueId, deviceId } = await ctx.params;
  const { venue } = await venueFromRequest(request, venueId, { write: true });
  await revokeStaffDevice(venue.id, deviceId);
  return Response.json({ ok: true });
});

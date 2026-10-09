import { notificationPrefsRequest } from "@/lib/api/account-contracts";
import { requireApiUser } from "@/server/auth/session";
import { assertSameOrigin, handle, parseBody } from "@/server/http";
import { setWeeklyDigest } from "@/server/repositories/notifications";
import { requireVenueAccess } from "@/server/services/venue-admin";

/** Per venue: does this owner get the Monday digest? */
export const PATCH = handle(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { venueId, weeklyDigest } = await parseBody(request, notificationPrefsRequest);
  await requireVenueAccess(user, venueId);
  await setWeeklyDigest(user.id, venueId, weeklyDigest);
  return Response.json({ ok: true });
});

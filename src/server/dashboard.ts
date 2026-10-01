import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { currentUser, isAdmin, requireApiUser, requireUser } from "./auth/session";
import { assertSameOrigin, ServiceError } from "./http";
import { entitlementsFor, getSubscription } from "./repositories/subscriptions";
import { getVenueRecord, venueRole } from "./repositories/venues";
import { requireVenueAccess } from "./services/venue-admin";

/** Route handlers under /api/dashboard/venues/[venueId]: signed in, owner (or operator), and same-origin for writes. */
export async function venueFromRequest(request: Request, venueId: string, options: { write?: boolean } = {}) {
  if (options.write) assertSameOrigin(request);
  const user = await requireApiUser();
  return { user, venue: requireVenueAccess(user, venueId) };
}

/** Server pages under /dashboard/[venueId]: the venue with its plan, or a 404 for anyone else. */
export const loadDashboardVenue = cache(async (venueId: string) => {
  const user = await requireUser();
  const venue = getVenueRecord(venueId);
  if (!venue || (!venueRole(user.id, venueId) && !isAdmin(user))) notFound();
  const { plan, can } = entitlementsFor(venue.id);
  return { user, venue, plan, can, subscription: getSubscription(venue.id) };
});

/** Admin API routes. */
export async function requireApiAdmin(request: Request) {
  assertSameOrigin(request);
  const user = await requireApiUser();
  if (!isAdmin(user)) throw new ServiceError(404, "Not found");
  return user;
}

/** Admin pages. */
export async function requireAdminPage() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) notFound();
  return user;
}

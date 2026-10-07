import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { currentUser, isAdmin, requireApiUser, requireUser } from "./auth/session";
import { assertSameOrigin, ServiceError } from "./http";
import { accessState } from "@/lib/plans";
import { getSubscription } from "./repositories/subscriptions";
import { getVenueRecord, isManagerRole, venueRole } from "./repositories/venues";
import { requireVenueAccess } from "./services/venue-admin";

/** Route handlers under /api/dashboard/venues/[venueId]: signed in, owner (or operator), and same-origin for writes. */
export async function venueFromRequest(request: Request, venueId: string, options: { write?: boolean } = {}) {
  if (options.write) assertSameOrigin(request);
  const user = await requireApiUser();
  const venue = requireVenueAccess(user, venueId);
  // Platform admins can look at any venue for support, but only its own team changes it.
  if (options.write && !isManagerRole(venueRole(user.id, venueId))) throw new ServiceError(403, "This is a read-only support view. Ask the owner to make the change.");
  return { user, venue };
}

/** Server pages under /dashboard/[venueId]: the venue with its subscription, or a 404 for anyone else. */
export const loadDashboardVenue = cache(async (venueId: string) => {
  const user = await requireUser();
  const venue = getVenueRecord(venueId);
  if (!venue) notFound();
  const role = venueRole(user.id, venueId);
  // Staff logins only reach the till; their list of venues says so.
  if (role === "staff" && !isAdmin(user)) redirect("/dashboard");
  if (!isManagerRole(role) && !isAdmin(user)) notFound();
  const subscription = getSubscription(venue.id);
  return { user, venue, subscription, access: accessState(subscription) };
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

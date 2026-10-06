import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/blocks";
import { VenueAvatar } from "@/components/dashboard/Shell";
import { firstParam } from "@/server/request";
import { requireUser } from "@/server/auth/session";
import { entitlementsFor } from "@/server/repositories/subscriptions";
import { listVenuesForUser } from "@/server/repositories/venues";

/** Lands new merchants in onboarding, single-venue merchants in their venue, and lists the rest. */
export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const verified = firstParam((await searchParams).verified);
  const venues = listVenuesForUser(user.id);
  if (venues.length === 0) redirect(`/onboarding${verified ? `?verified=${encodeURIComponent(verified)}` : ""}`);
  if (venues.length === 1) redirect(`/dashboard/${venues[0].id}${verified ? `?verified=${verified}` : ""}`);

  return (
    <div className="page page-medium">
      {verified === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks!</div>}
      {verified === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}
      <PageHeader
        title="Your venues"
        description="Each venue has its own guest page, QR codes and plan."
        actions={
          <Link className="btn btn-primary" href="/onboarding">
            <Plus aria-hidden /> Add a venue
          </Link>
        }
      />
      <div className="venue-list">
        {venues.map((venue) => {
          const pro = entitlementsFor(venue.id).plan === "pro";
          return (
            <Link key={venue.id} href={`/dashboard/${venue.id}`} className="card venue-tile">
              <VenueAvatar venue={{ name: venue.config.name, logoUrl: venue.config.branding.logoUrl ?? null }} />
              <span className="venue-tile-text">
                <strong>{venue.config.name}</strong>
                <span className="mono muted">/{venue.shortCode}</span>
              </span>
              <span className="inline">
                {venue.status === "suspended" ? <span className="badge badge-danger">Suspended</span> : <span className={`badge ${pro ? "badge-pro" : ""}`}>{pro ? "Pro" : "Free"}</span>}
                <ChevronRight className="venue-tile-chevron" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

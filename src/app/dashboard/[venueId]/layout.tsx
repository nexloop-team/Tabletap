import { PowerOff, Shield } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountBar } from "@/components/dashboard/AccountBar";
import { HashFocus } from "@/components/dashboard/HashFocus";
import { trialDaysLeft } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";
import { isManagerRole, venueRole } from "@/server/repositories/venues";

export async function generateMetadata({ params }: LayoutProps<"/dashboard/[venueId]">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  return { title: venue.config.name };
}

export default async function VenueLayout({ children, params }: LayoutProps<"/dashboard/[venueId]"> & { children: ReactNode }) {
  const { venueId } = await params;
  const { user, venue, subscription, access } = await loadDashboardVenue(venueId);
  const trialDays = trialDaysLeft(subscription);
  // Only operators reach a venue they aren't a member of (loadDashboardVenue 404s everyone else).
  const operatorView = !isManagerRole(venueRole(user.id, venue.id));

  return (
    <div className="page">
      {operatorView && (
        <div className="notice notice-admin">
          <span className="inline">
            <Shield aria-hidden />
            <span>
              You&apos;re viewing <strong>{venue.config.name}</strong> as a platform admin. This is a read-only support view: saving is switched off.
            </span>
          </span>
          <Link className="btn btn-sm" href="/admin/venues">
            Back to admin
          </Link>
        </div>
      )}
      {venue.status === "suspended" && (
        <div className="notice notice-error">This venue is suspended, so its guest page is offline. Contact support to restore it.</div>
      )}
      {access === "unpaid" && venue.status !== "suspended" && (
        <div className="notice notice-error notice-action">
          <span className="inline">
            <PowerOff aria-hidden />
            <span>
              <strong>Your guest page is offline.</strong> {subscription?.paid || subscription?.status === "canceled" ? "Your subscription has ended." : "Your free trial has ended."} Subscribe to bring it back exactly as it was.
            </span>
          </span>
          {!operatorView && (
            <Link className="btn btn-primary btn-sm" href={`/dashboard/${venue.id}/billing`}>
              Subscribe
            </Link>
          )}
        </div>
      )}
      {!operatorView && <AccountBar unverifiedEmail={user.emailVerified ? null : user.email} trialDays={trialDays} billingHref={`/dashboard/${venue.id}/billing`} />}
      <HashFocus />
      {children}
    </div>
  );
}

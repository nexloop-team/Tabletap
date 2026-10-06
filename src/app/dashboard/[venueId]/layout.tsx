import { Clock, Shield } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ResendVerification } from "@/components/dashboard/Shell";
import { trialDaysLeft } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";
import { venueRole } from "@/server/repositories/venues";

export async function generateMetadata({ params }: LayoutProps<"/dashboard/[venueId]">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  return { title: venue.config.name };
}

export default async function VenueLayout({ children, params }: LayoutProps<"/dashboard/[venueId]"> & { children: ReactNode }) {
  const { venueId } = await params;
  const { user, venue, subscription } = await loadDashboardVenue(venueId);
  const trialDays = trialDaysLeft(subscription);
  // Only operators reach a venue they aren't a member of (loadDashboardVenue 404s everyone else).
  const operatorView = !venueRole(user.id, venue.id);

  return (
    <div className="page">
      {operatorView && (
        <div className="notice notice-admin">
          <span className="inline">
            <Shield aria-hidden />
            <span>
              You&apos;re viewing <strong>{venue.config.name}</strong> as a platform admin. Changes you save go live for this venue.
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
      {!user.emailVerified && !operatorView && (
        <div className="notice notice-warn">
          <span>
            Confirm your email (<strong>{user.email}</strong>) so we can reach you about your account.
          </span>
          <ResendVerification />
        </div>
      )}
      {trialDays !== null && !operatorView && (
        <div className="trial-banner">
          <Clock aria-hidden />
          <span>
            <strong>
              Pro trial · {trialDays} day{trialDays === 1 ? "" : "s"} left.
            </strong>{" "}
            Keep loyalty, Wi-Fi capture and guest emails after it ends.
          </span>
          <Link className="btn btn-primary btn-sm" href={`/dashboard/${venue.id}/billing`}>
            Choose a plan
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}

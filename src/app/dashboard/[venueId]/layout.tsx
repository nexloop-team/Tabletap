import Link from "next/link";
import type { ReactNode } from "react";
import { ResendVerification, SideNav } from "@/components/dashboard/Shell";
import { trialDaysLeft } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";

export async function generateMetadata({ params }: LayoutProps<"/dashboard/[venueId]">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  return { title: venue.config.name };
}

export default async function VenueLayout({ children, params }: LayoutProps<"/dashboard/[venueId]"> & { children: ReactNode }) {
  const { venueId } = await params;
  const { user, venue, plan, subscription } = await loadDashboardVenue(venueId);
  const trialDays = trialDaysLeft(subscription);

  return (
    <div className="dash">
      <SideNav venueId={venue.id} isPro={plan === "pro"} />
      <main className="dash-main">
        {venue.status === "suspended" && (
          <div className="notice notice-error" style={{ marginBottom: 16 }}>
            This venue is suspended, so its guest page is offline. Contact support to restore it.
          </div>
        )}
        {!user.emailVerified && (
          <div className="notice notice-warn" style={{ marginBottom: 16 }}>
            <span>
              Confirm your email (<strong>{user.email}</strong>) so we can reach you about your account.
            </span>
            <ResendVerification />
          </div>
        )}
        {trialDays !== null && trialDays <= 5 && (
          <div className="notice notice-info" style={{ marginBottom: 16 }}>
            <span>
              Your Pro trial ends in {trialDays} day{trialDays === 1 ? "" : "s"}. Loyalty and guest capture switch off when it does.
            </span>
            <Link className="btn btn-primary btn-sm" href={`/dashboard/${venue.id}/billing`}>
              Keep Pro
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

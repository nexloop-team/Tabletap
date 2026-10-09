import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { uiFont } from "@/app/fonts";
import { AppShell } from "@/components/dashboard/Shell";
import { BRAND } from "@/config/brand";
import { isAdmin, requireUser } from "@/server/auth/session";
import { accessBadge } from "@/lib/plans";
import { unreadFeedback } from "@/server/repositories/feedback";
import { getSubscription } from "@/server/repositories/subscriptions";
import { listVenuesForUser } from "@/server/repositories/venues";
import "@/styles/app.css";

export const metadata: Metadata = { title: { default: "Dashboard", template: `%s · ${BRAND.name}` }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const venues = listVenuesForUser(user.id).map((venue) => {
    return {
      id: venue.id,
      name: venue.config.name,
      planLabel: accessBadge(getSubscription(venue.id)).label,
      unreadFeedback: unreadFeedback(venue.id, user.id).count,
      logoUrl: venue.config.branding.logoUrl ?? null,
    };
  });
  return (
    <div className={`app ${uiFont.variable}`}>
      <AppShell mode="venue" venues={venues} user={{ name: user.name, email: user.email, isAdmin: isAdmin(user) }} lastVenueId={(await cookies()).get("tt_venue")?.value ?? null}>
        {children}
      </AppShell>
    </div>
  );
}

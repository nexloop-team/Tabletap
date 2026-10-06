import type { Metadata } from "next";
import type { ReactNode } from "react";
import { uiFont } from "@/app/fonts";
import { AppShell } from "@/components/dashboard/Shell";
import { BRAND } from "@/config/brand";
import { isAdmin, requireUser } from "@/server/auth/session";
import { trialDaysLeft } from "@/lib/plans";
import { entitlementsFor, getSubscription } from "@/server/repositories/subscriptions";
import { listVenuesForUser } from "@/server/repositories/venues";
import "@/styles/app.css";

export const metadata: Metadata = { title: { default: "Dashboard", template: `%s · ${BRAND.name}` }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const venues = listVenuesForUser(user.id).map((venue) => {
    const isPro = entitlementsFor(venue.id).plan === "pro";
    const trial = trialDaysLeft(getSubscription(venue.id)) !== null;
    return {
      id: venue.id,
      name: venue.config.name,
      isPro,
      planLabel: trial ? "Pro trial" : isPro ? "Pro" : "Free",
      logoUrl: venue.config.branding.logoUrl ?? null,
    };
  });
  return (
    <div className={`app ${uiFont.variable}`}>
      <AppShell mode="venue" venues={venues} user={{ name: user.name, email: user.email, isAdmin: isAdmin(user) }}>
        {children}
      </AppShell>
    </div>
  );
}

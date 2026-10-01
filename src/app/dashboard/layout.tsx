import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TopbarLinks, VenueSwitcher } from "@/components/dashboard/Shell";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { isAdmin, requireUser } from "@/server/auth/session";
import { listVenuesForUser } from "@/server/repositories/venues";
import "@/styles/app.css";

export const metadata: Metadata = { title: { default: "Dashboard", template: `%s · ${BRAND.name}` }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const venues = listVenuesForUser(user.id).map((venue) => ({ id: venue.id, name: venue.config.name }));
  return (
    <div className="app">
      <header className="topbar">
        <Link className="wordmark" href="/dashboard">
          <BrandMark />
          {BRAND.name}
        </Link>
        <VenueSwitcher venues={venues} />
        <span className="topbar-spacer" />
        <TopbarLinks isAdmin={isAdmin(user)} />
      </header>
      {children}
    </div>
  );
}

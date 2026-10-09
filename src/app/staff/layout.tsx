import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { uiFont } from "@/app/fonts";
import { BRAND } from "@/config/brand";
import { OnlineStatus } from "@/components/staff/OnlineStatus";
import { getVenueRecord } from "@/server/repositories/venues";
import { currentStaffDevice } from "@/server/services/staff";
import "@/styles/app.css";

export const metadata: Metadata = { title: { default: "Staff", template: `%s · ${BRAND.name} staff` }, robots: { index: false, follow: false } };

/**
 * Till screens for paired staff devices: big buttons, nothing else. Always
 * dark, so the screen doesn't glare behind a counter and the green actions pop.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const device = await currentStaffDevice();
  const venue = device ? await getVenueRecord(device.venueId) : null;
  return (
    <div className={`app till ${uiFont.variable}`}>
      <header className="till-bar">
        <Link className="till-brand" href="/staff">
          <BrandMark size={32} />
          <span>
            {venue ? <strong>{venue.config.name}</strong> : <strong className="till-wordmark">{BRAND.name}</strong>}
            {device ? <span className="till-device">Till · {device.label}</span> : null}
          </span>
        </Link>
        {device && <OnlineStatus />}
      </header>
      <main className="staff-main">{children}</main>
    </div>
  );
}

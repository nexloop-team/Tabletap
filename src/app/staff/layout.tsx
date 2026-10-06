import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { uiFont } from "@/app/fonts";
import { BRAND } from "@/config/brand";
import "@/styles/app.css";

export const metadata: Metadata = { title: { default: "Staff", template: `%s · ${BRAND.name} staff` }, robots: { index: false, follow: false } };

/** Till screens for paired staff devices: big buttons, nothing else. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`app ${uiFont.variable}`}>
      <header className="topbar">
        <Link className="wordmark" href="/staff">
          <BrandMark />
          {BRAND.name}
        </Link>
        <span className="badge">Staff</span>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  );
}

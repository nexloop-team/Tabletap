import type { Metadata } from "next";
import type { ReactNode } from "react";
import { uiFont } from "@/app/fonts";
import { AppShell } from "@/components/dashboard/Shell";
import { BRAND } from "@/config/brand";
import { requireAdminPage } from "@/server/dashboard";
import "@/styles/app.css";

export const metadata: Metadata = { title: { default: "Admin", template: `%s · Admin · ${BRAND.name}` }, robots: { index: false, follow: false } };

/** Operator console shell. Gated by ADMIN_EMAILS; each page checks again, since layouts don't re-run on client navigation. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();
  return (
    <div className={`app ${uiFont.variable}`}>
      <AppShell mode="admin" venues={[]} user={{ name: user.name, email: user.email, isAdmin: true }}>
        {children}
      </AppShell>
    </div>
  );
}

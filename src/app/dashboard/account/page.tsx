import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/blocks";
import { AccountForms, DigestSwitches } from "@/components/dashboard/SettingsForms";
import { requireUser } from "@/server/auth/session";
import { weeklyDigestEnabled } from "@/server/repositories/notifications";
import { listVenuesForUser } from "@/server/repositories/venues";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const venues = listVenuesForUser(user.id).map((venue) => ({ id: venue.id, name: venue.config.name, enabled: weeklyDigestEnabled(user.id, venue.id) }));
  return (
    <div className="page page-narrow">
      <PageHeader title="Account" description={`Signed in as ${user.email}`} />
      {!user.emailVerified && venues.length > 0 && <div className="notice notice-warn">Confirm your email address to start receiving the weekly summary.</div>}
      <DigestSwitches venues={venues} />
      <AccountForms name={user.name} email={user.email} />
    </div>
  );
}

import type { Metadata } from "next";
import { AutomationsForm } from "@/components/dashboard/AutomationsForm";
import { LoyaltyEditor } from "@/components/dashboard/LoyaltyEditor";
import { StaffDevices } from "@/components/dashboard/StaffDevices";
import { StaffMembers } from "@/components/dashboard/StaffMembers";
import { loadDashboardVenue } from "@/server/dashboard";
import { referralStats } from "@/server/repositories/retention";
import { getVenueSettings, listStaffMembers } from "@/server/repositories/venues";
import { listStaffDevices } from "@/server/services/staff";

export const metadata: Metadata = { title: "Loyalty & capture" };

export default async function LoyaltyPage({ params }: PageProps<"/dashboard/[venueId]/loyalty">) {
  const { venue, can } = await loadDashboardVenue((await params).venueId);
  const program = venue.config.loyaltyProgram;
  const crm = venue.config.crm;
  const settings = getVenueSettings(venue.id);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Loyalty & capture</h1>
          <p>Turn first visits into regulars.</p>
        </div>
      </div>
      <LoyaltyEditor
        venueId={venue.id}
        isPro={can.loyalty}
        venueType={venue.config.venueType}
        initial={{ loyaltyProgram: program ?? null, crm }}
        referralStats={referralStats(venue.id)}
      />
      <StaffDevices
        venueId={venue.id}
        devices={listStaffDevices(venue.id)}
        cooldownMinutes={settings.stampPolicy.cooldownMinutes}
        enabled={can.loyalty && !!program && program.stampsEnabled !== false}
      />
      <StaffMembers venueId={venue.id} members={listStaffMembers(venue.id)} />
      <AutomationsForm
        venueId={venue.id}
        initial={settings.automations}
        isPro={can.automations}
        collectsConsent={crm.enabled && crm.consentAsk}
        collectsBirthdays={crm.enabled && crm.birthdayAsk}
      />
    </>
  );
}

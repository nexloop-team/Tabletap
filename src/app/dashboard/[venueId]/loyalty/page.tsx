import type { Metadata } from "next";
import { LoyaltyEditor } from "@/components/dashboard/LoyaltyEditor";
import { loadDashboardVenue } from "@/server/dashboard";

export const metadata: Metadata = { title: "Loyalty & capture" };

export default async function LoyaltyPage({ params }: PageProps<"/dashboard/[venueId]/loyalty">) {
  const { venue, can } = await loadDashboardVenue((await params).venueId);
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
        initial={{ loyaltyProgram: venue.config.loyaltyProgram ?? null, crm: venue.config.crm }}
      />
    </>
  );
}

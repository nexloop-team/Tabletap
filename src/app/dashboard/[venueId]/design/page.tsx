import type { Metadata } from "next";
import { DesignEditor } from "@/components/dashboard/DesignEditor";
import { loadDashboardVenue } from "@/server/dashboard";

export const metadata: Metadata = { title: "Guest page" };

export default async function DesignPage({ params }: PageProps<"/dashboard/[venueId]/design">) {
  const { venue, can } = await loadDashboardVenue((await params).venueId);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guest page</h1>
          <p>What guests see when they scan your QR code.</p>
        </div>
      </div>
      <DesignEditor venueId={venue.id} shortCode={venue.shortCode} config={venue.config} canUseStyles={can.stylePresets} />
    </>
  );
}

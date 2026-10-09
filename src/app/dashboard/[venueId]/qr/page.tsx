import type { Metadata } from "next";
import { printVenue } from "@/components/dashboard/PrintSheets";
import { QrDesigner } from "@/components/dashboard/QrDesigner";
import { STYLE_FONT_HREF, computeTheme } from "@/lib/theme";
import { loadDashboardVenue } from "@/server/dashboard";
import { serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

export const metadata: Metadata = { title: "QR codes" };

export default async function QrPage({ params }: PageProps<"/dashboard/[venueId]/qr">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const style = computeTheme(venue.config.branding).style;
  return (
    <>
      {style && <link rel="stylesheet" href={STYLE_FONT_HREF[style]} precedence="default" />}
      <div className="page-head no-print">
        <div>
          <h1>QR codes</h1>
          <p>Every code opens your guest page. Edit the page any time; printed codes never need replacing.</p>
        </div>
      </div>
      <QrDesigner venueId={venue.id} guestUrl={guestPageUrl(await serverOrigin(), venue.shortCode)} printVenue={printVenue(venue.id, venue.config)} />
    </>
  );
}

import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/blocks";
import { DesignEditor } from "@/components/dashboard/DesignEditor";
import { loadDashboardVenue } from "@/server/dashboard";
import { serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

export const metadata: Metadata = { title: "Guest page" };

export default async function DesignPage({ params }: PageProps<"/dashboard/[venueId]/design">) {
  const { venue, can } = await loadDashboardVenue((await params).venueId);
  const url = guestPageUrl(await serverOrigin(), venue.shortCode);
  return (
    <>
      <PageHeader
        title="Guest page"
        description="What guests see when they scan."
        actions={
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden /> View live page
          </a>
        }
      />
      <DesignEditor venueId={venue.id} shortCode={venue.shortCode} config={venue.config} canUseStyles={can.stylePresets} />
    </>
  );
}

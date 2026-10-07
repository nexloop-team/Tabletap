import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { MenuEditor } from "@/components/dashboard/MenuEditor";
import { loadDashboardVenue } from "@/server/dashboard";
import { aiConfigured, aiImportLimits } from "@/server/services/ai";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage({ params }: PageProps<"/dashboard/[venueId]/menu">) {
  const { venue, can } = await loadDashboardVenue((await params).venueId);
  const ai = !aiConfigured() ? "off" : can.ai ? "on" : "upgrade";
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Menu</h1>
          <p>Prices, allergens and dietary tags. Mark items sold out in a tap.</p>
        </div>
        <a className="btn" href={`/menu?i=${encodeURIComponent(venue.shortCode)}&s=preview`} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden /> View menu
        </a>
      </div>
      <MenuEditor venueId={venue.id} menus={venue.config.menus} currencyCode={venue.config.currencyCode} ai={ai} importLimits={aiImportLimits()} canUseLayouts={can.layouts} previewUrl={`/menu?i=${encodeURIComponent(venue.shortCode)}&s=preview`} />
    </>
  );
}

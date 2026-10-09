import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { MenuEditor } from "@/components/dashboard/MenuEditor";
import { isIndianMenu } from "@/lib/venue/region";
import { loadDashboardVenue } from "@/server/dashboard";
import { aiConfigured, aiImportLimits } from "@/server/services/ai";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage({ params }: PageProps<"/dashboard/[venueId]/menu">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const ai = aiConfigured() ? "on" : "off";
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Menu</h1>
          <p>{isIndianMenu(venue.config.currencyCode) ? "Dishes, prices and veg marks. Mark a dish sold out in a tap." : "Dishes, prices, allergens and dietary tags. Mark a dish sold out in a tap."}</p>
        </div>
        <a className="btn" href={`/menu?i=${encodeURIComponent(venue.shortCode)}&s=preview`} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden /> View menu
        </a>
      </div>
      <MenuEditor venueId={venue.id} menus={venue.config.menus} currencyCode={venue.config.currencyCode} ai={ai} importLimits={aiImportLimits()} previewUrl={`/menu?i=${encodeURIComponent(venue.shortCode)}&s=preview`} />
    </>
  );
}

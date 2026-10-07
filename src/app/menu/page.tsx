import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingError } from "@/components/landing/LandingError";
import { menuExternalUrl, sanitiseExternalUrl } from "@/lib/venue/features";
import { MenuView } from "@/components/menu/MenuView";
import { EmbedStyle } from "@/components/EmbedStyle";
import { ThemeStyle } from "@/components/ThemeStyle";
import { BRAND } from "@/config/brand";
import { firstParam, loadVenue, queryString, requestLocale, sourceParam, venueParam } from "@/server/request";
import "@/styles/landing.css";
import "@/styles/pages.css";

export async function generateMetadata({ searchParams }: PageProps<"/menu">): Promise<Metadata> {
  const venue = loadVenue(venueParam(await searchParams));
  return { title: venue ? `${venue.name} menu` : BRAND.name, robots: { index: false, follow: false } };
}

/** `/menu?i=<venue code>` — the hosted menu behind the landing page's menu card. */
export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  const params = await searchParams;
  const code = venueParam(params);
  const source = sourceParam(params);
  const locale = await requestLocale();

  if (!code) return <LandingError locale={locale} message="id_missing" source={source} />;
  const venue = loadVenue(code);
  if (!venue) return <LandingError locale={locale} message="could_not_load" source={source} failedCode={code} />;

  // Only hosted menus with something on them; an external-link menu has its own site.
  const menus = venue.menus.filter((menu) => !menu.externalUrl && menu.sections.some((section) => section.items.length > 0));
  // Someone landed here (an old link, a typed URL) for a venue whose menu lives elsewhere: send them there.
  const external = sanitiseExternalUrl(menuExternalUrl(venue));
  if (menus.length === 0 && external) redirect(external);

  return (
    <>
      <ThemeStyle branding={venue.branding} />
      <EmbedStyle embed={firstParam(params.embed)} />
      <MenuView venueId={venue.id} venueName={venue.name} branding={venue.branding} currencyCode={venue.currencyCode} menus={menus} locale={locale} source={source} backHref={`/s${queryString(params)}`} />
    </>
  );
}

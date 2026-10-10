import { LOCALE } from "@/lib/i18n";
import { guestSafeVenue } from "@/lib/venue/features";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FEEDBACK_VARIANT_COOKIE, LandingApp, type FeedbackVariant } from "@/components/landing/LandingApp";
import { LandingError } from "@/components/landing/LandingError";
import { PausedPage } from "@/components/landing/PausedPage";
import { EmbedStyle } from "@/components/EmbedStyle";
import { ThemeStyle } from "@/components/ThemeStyle";
import { BRAND } from "@/config/brand";
import { firstParam, loadPausedVenue, loadVenue, sourceParam, venueParam } from "@/server/request";
import "@/styles/landing.css";
// The member card (stamp grid, staff code) shows inline on this page.
import "@/styles/pages.css";

export async function generateMetadata({ searchParams }: PageProps<"/s">): Promise<Metadata> {
  const venue = await loadVenue(venueParam(await searchParams));
  return {
    title: venue ? venue.name : BRAND.name,
    // Venue pages are reached by QR code; they have nothing to offer a search index.
    robots: { index: false, follow: false },
  };
}

function parseVariant(value: string | undefined): FeedbackVariant | null {
  if (value === "box" || value === "cta_box") return "box";
  if (value === "anon" || value === "cta_anon") return "anon";
  return null;
}

function drawVariant(): FeedbackVariant {
  return Math.random() < 0.5 ? "box" : "anon";
}

/** `/s?i=<venue code>&s=<scan source>` — the page a table QR code opens. */
export default async function LandingPage({ searchParams }: PageProps<"/s">) {
  const params = await searchParams;
  const code = venueParam(params);
  const source = sourceParam(params);
  const locale = LOCALE;

  if (!code) return <LandingError locale={locale} message="id_missing" source={source} />;
  const venue = await loadVenue(code);
  if (!venue) {
    const paused = await loadPausedVenue(code);
    if (paused) return <PausedPage locale={locale} name={paused.name} branding={paused.branding} retryHref={`/s?i=${encodeURIComponent(code)}`} />;
    return <LandingError locale={locale} message="could_not_load" source={source} failedCode={code} />;
  }

  // `?cta=` forces a bucket for QA without touching the visitor's stored one.
  // The owner's own dashboard preview always shows the default label, outside the test.
  const forced = parseVariant(firstParam(params.cta)) ?? (source === "preview" ? "box" : null);
  const stored = parseVariant((await cookies()).get(FEEDBACK_VARIANT_COOKIE)?.value);
  const variant = forced ?? stored ?? drawVariant();

  return (
    <>
      <ThemeStyle branding={venue.branding} />
      <EmbedStyle embed={firstParam(params.embed)} />
      <LandingApp venue={guestSafeVenue(venue)} locale={locale} source={source} feedbackVariant={variant} persistVariant={!forced && !stored} />
    </>
  );
}

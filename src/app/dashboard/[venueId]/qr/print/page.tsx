import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/dashboard/QrDesigner";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { initials } from "@/lib/format";
import { safeImageUrl } from "@/lib/venue/features";
import { sourceSlug } from "@/lib/qr-source";
import { loadDashboardVenue } from "@/server/dashboard";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Print table cards" };

const MAX_CARDS = 100;
/** A6 cards, four to an A4 sheet. */
const PER_PAGE = 4;

/** "Menu, Wi-Fi and your stamp card": what the code opens, from what this venue offers. */
function headline(parts: string[]): string {
  if (parts.length === 0) return "Everything for your table";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "1-12" or "1, 2, Patio" → labelled cards, capped so a typo can't render thousands. */
function parseTables(input: string): string[] {
  const labels: string[] = [];
  for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d{1,4})\s*-\s*(\d{1,4})$/.exec(part);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      for (let n = from; n <= to && labels.length < MAX_CARDS; n++) labels.push(`Table ${n}`);
    } else if (/^\d{1,4}$/.test(part)) {
      labels.push(`Table ${part}`);
    } else {
      labels.push(part.slice(0, 40));
    }
    if (labels.length >= MAX_CARDS) break;
  }
  return labels.slice(0, MAX_CARDS);
}

export default async function PrintPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/qr/print">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const labels = parseTables(firstParam(query.tables) || "1-10");
  const color = /^#[0-9a-fA-F]{6}$/.test(firstParam(query.color)) ? firstParam(query.color) : "#000000";

  const config = venue.config;
  const logo = safeImageUrl(config.branding.logoUrl);
  const title = headline([
    ...(config.menus.length > 0 ? ["Menu"] : []),
    ...(config.wifi?.ssid ? ["Wi-Fi"] : []),
    ...(config.loyaltyProgram ? [config.loyaltyProgram.stampsEnabled === false ? "member rewards" : "your stamp card"] : []),
  ]);
  const pages: string[][] = [];
  for (let i = 0; i < labels.length; i += PER_PAGE) pages.push(labels.slice(i, i + PER_PAGE));

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>Table cards</h1>
          <p>
            {labels.length} card{labels.length === 1 ? "" : "s"} on {pages.length} A4 sheet{pages.length === 1 ? "" : "s"}. Print at 100%, cut along the dashed lines, and slot into stands.
          </p>
        </div>
        <div className="inline">
          <Link className="btn" href={`/dashboard/${venue.id}/qr`}>
            Back
          </Link>
          <PrintButton />
        </div>
      </div>
      <div className="print-sheets">
        {pages.map((page, pageIndex) => (
          <section key={pageIndex} className="print-page" aria-label={`Sheet ${pageIndex + 1}`}>
            {page.map((label, index) => (
              <div key={`${label}-${index}`} className="tent">
                <div className="tent-venue">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
                    <img className="tent-logo" src={logo} alt="" />
                  ) : (
                    <span className="tent-logo" aria-hidden>
                      {initials(config.name)}
                    </span>
                  )}
                  <span>{config.name}</span>
                </div>
                <h2>{title}</h2>
                <div className="tent-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
                  <img src={`/api/dashboard/venues/${venue.id}/qr?${new URLSearchParams({ s: sourceSlug(label), color })}`} alt={`QR code for ${label}`} />
                </div>
                <p>
                  Point your phone camera here.
                  <br />
                  No app needed.
                </p>
                <div className="tent-foot">
                  <span className="table-label">{label}</span>
                  <span className="tent-brand">
                    <BrandMark size={14} />
                    {BRAND.name}
                  </span>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

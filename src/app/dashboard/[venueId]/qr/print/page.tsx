import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Wifi } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/dashboard/QrDesigner";
import { initials } from "@/lib/format";
import { computeTheme, STYLE_FONT_HREF } from "@/lib/theme";
import { safeImageUrl } from "@/lib/venue/features";
import { sourceSlug } from "@/lib/qr-source";
import { loadDashboardVenue } from "@/server/dashboard";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Print table cards" };

const MAX_CARDS = 100;

/** What fits on one A4 sheet, per format. */
const FORMATS = {
  a6: { label: "A6 cards", perPage: 4, hint: "Four to a sheet. Cut along the dashed lines and slot into stands." },
  tent: { label: "Tent cards", perPage: 2, hint: "Two to a sheet. Cut along the dashed line, fold in the middle and stand on the table." },
  sticker: { label: "Round stickers", perPage: 6, hint: "Six to a sheet. Print on round sticker paper, or cut them out." },
  wifi: { label: "Wi-Fi signs", perPage: 12, hint: "Small signs for the counter and walls that point guests to the code on their table." },
} as const;
type Format = keyof typeof FORMATS;

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
  const tablesParam = firstParam(query.tables) || "1-10";
  const labels = parseTables(tablesParam);
  const color = /^#[0-9a-fA-F]{6}$/.test(firstParam(query.color)) ? firstParam(query.color) : "#000000";
  const format: Format = (Object.keys(FORMATS) as Format[]).find((f) => f === firstParam(query.f)) ?? "a6";

  const config = venue.config;
  const logo = safeImageUrl(config.branding.logoUrl);
  const theme = computeTheme(config.branding);
  const offers = [
    ...(config.menus.length > 0 ? ["Menu"] : []),
    ...(config.wifi?.ssid ? ["Wi-Fi"] : []),
    ...(config.loyaltyProgram ? [config.loyaltyProgram.stampsEnabled === false ? "member rewards" : "your stamp card"] : []),
  ];
  const title = headline(offers);
  const ring = (offers.length ? offers : ["Menu"]).map((o) => o.replace("your ", "").replace("stamp card", "rewards").replace("member rewards", "rewards").toUpperCase()).join(" · ");
  // The venue's own colours for the A6 cards and stickers.
  const venueStyle = { ...theme.vars, background: "var(--page-bg)", color: "var(--text-primary)" } as CSSProperties;
  // The venue name round the top of a sticker shrinks to fit the arc.
  const ringName = config.name.toUpperCase().slice(0, 28);
  const ringFont = Math.min(15, Math.floor(210 / (ringName.length * 0.85)));
  const items = format === "wifi" ? Array.from({ length: FORMATS.wifi.perPage }, (_, i) => `Wi-Fi ${i + 1}`) : labels;
  const perPage = FORMATS[format].perPage;
  const pages: string[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const qr = (label: string) => `/api/dashboard/venues/${venue.id}/qr?${new URLSearchParams({ s: sourceSlug(label), color })}`;
  const href = (f: Format) => `/dashboard/${venue.id}/qr/print?${new URLSearchParams({ tables: tablesParam, color, f })}`;

  const Logo = ({ className }: { className: string }) =>
    logo ? (
      // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
      <img className={className} src={logo} alt="" />
    ) : (
      <span className={className} aria-hidden>
        {initials(config.name)}
      </span>
    );

  const tentPanel = (label: string) => (
    <div className="tent-panel">
      <div className="tent-qr">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
        <img src={qr(label)} alt={`QR code for ${label}`} />
      </div>
      <div className="tent-text">
        <span className="tent-venue">
          <Logo className="tent-logo" />
          {config.name}
        </span>
        <h2>{title}</h2>
        <p>Point your phone camera here. No app needed.</p>
        <span className="table-chip">{label}</span>
      </div>
    </div>
  );

  return (
    <>
      {theme.style && <link rel="stylesheet" href={STYLE_FONT_HREF[theme.style]} precedence="default" />}
      <div className="page-head no-print">
        <div>
          <h1>Table cards</h1>
          <p>
            {format === "wifi" ? "One sheet of signs." : `${labels.length} code${labels.length === 1 ? "" : "s"} on ${pages.length} A4 sheet${pages.length === 1 ? "" : "s"}.`} {FORMATS[format].hint} Print at 100%.
          </p>
        </div>
        <div className="inline">
          <Link className="btn" href={`/dashboard/${venue.id}/qr`}>
            Back
          </Link>
          <PrintButton />
        </div>
      </div>
      <nav className="segmented print-formats no-print" aria-label="Card format">
        {(Object.keys(FORMATS) as Format[]).map((f) => (
          <Link key={f} href={href(f)} aria-current={f === format ? "true" : undefined}>
            {FORMATS[f].label}
          </Link>
        ))}
      </nav>
      <div className="print-sheets" data-style={theme.style ?? undefined}>
        {pages.map((page, pageIndex) => (
          <section key={pageIndex} className="print-page" data-format={format} aria-label={`Sheet ${pageIndex + 1}`}>
            {page.map((label, index) => {
              if (format === "tent")
                return (
                  <div key={`${label}-${index}`} className="tent-card">
                    <div className="tent-flipped">{tentPanel(label)}</div>
                    <span className="tent-fold">Fold</span>
                    {tentPanel(label)}
                  </div>
                );
              if (format === "sticker")
                return (
                  <div key={`${label}-${index}`} className="sticker-cell">
                    <div className="sticker" style={venueStyle}>
                      <svg className="sticker-ring" viewBox="0 0 200 200" aria-hidden>
                        <defs>
                          <path id={`top-${pageIndex}-${index}`} d="M 26 100 A 74 74 0 0 1 174 100" />
                          <path id={`bottom-${pageIndex}-${index}`} d="M 22 100 A 78 78 0 0 0 178 100" />
                        </defs>
                        <text className="sticker-name" style={{ fontSize: ringFont, letterSpacing: ringFont * 0.22 }}>
                          <textPath href={`#top-${pageIndex}-${index}`} startOffset="50%" textAnchor="middle">
                            {ringName}
                          </textPath>
                        </text>
                        <text className="sticker-offers">
                          <textPath href={`#bottom-${pageIndex}-${index}`} startOffset="50%" textAnchor="middle">
                            {ring}
                          </textPath>
                        </text>
                      </svg>
                      <span className="sticker-qr">
                        {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
                        <img src={qr(label)} alt={`QR code for ${label}`} />
                      </span>
                    </div>
                    <span className="sticker-label">{label}</span>
                  </div>
                );
              if (format === "wifi")
                return (
                  <div key={`${label}-${index}`} className="wifi-sign" style={venueStyle}>
                    <Wifi aria-hidden />
                    <span>
                      <strong>Wi-Fi? Scan the code</strong>
                      on your table. Password in one tap.
                    </span>
                  </div>
                );
              return (
                <div key={`${label}-${index}`} className="a6-card" style={venueStyle}>
                  <Logo className="a6-logo" />
                  <span className="a6-name">{config.name}</span>
                  {config.branding.tagline && <span className="a6-tagline">{config.branding.tagline}</span>}
                  <span className="a6-rule" aria-hidden />
                  <h2>Scan for the {title.replace(" and ", " & ").replace(/^Menu/, "menu").replace("your stamp card", "stamp card").replace("Wi-Fi", "Wi‑Fi")}</h2>
                  <span className="a6-qr">
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
                    <img src={qr(label)} alt={`QR code for ${label}`} />
                  </span>
                  <span className="a6-foot">
                    <span className="table-chip">{label}</span>
                    <span>No app needed</span>
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}

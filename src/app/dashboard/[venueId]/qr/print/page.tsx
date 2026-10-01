import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/dashboard/QrDesigner";
import { sourceSlug } from "@/lib/qr-source";
import { loadDashboardVenue } from "@/server/dashboard";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Print table cards" };

const MAX_CARDS = 100;

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

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>Table cards</h1>
          <p>
            {labels.length} card{labels.length === 1 ? "" : "s"}. Print, cut along the dashed lines, and fold or slot into stands.
          </p>
        </div>
        <div className="inline">
          <Link className="btn" href={`/dashboard/${venue.id}/qr`}>
            Back
          </Link>
          <PrintButton />
        </div>
      </div>
      <div className="print-sheet">
        {labels.map((label, index) => (
          <div key={`${label}-${index}`} className="tent">
            <h3>{venue.config.name}</h3>
            <p>Scan for the menu, Wi-Fi &amp; rewards</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
            <img src={`/api/dashboard/venues/${venue.id}/qr?${new URLSearchParams({ s: sourceSlug(label), color })}`} alt={`QR code for ${label}`} />
            <span className="table-label">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

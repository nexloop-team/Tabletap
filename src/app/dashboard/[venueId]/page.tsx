import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { DailyBars, PageHeader, Stat } from "@/components/dashboard/blocks";
import { CopyButton } from "@/components/dashboard/ui";
import { loadDashboardVenue } from "@/server/dashboard";
import { venueStats } from "@/server/repositories/insights";
import { firstParam, serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

/** The overview looks at one week, compared with the week before. */
const WINDOW_DAYS = 7;

function formatSentiment(value: number | null): string {
  if (value === null) return "No mood yet";
  if (value >= 0.25) return "Mostly positive";
  if (value <= -0.25) return "Mostly negative";
  return "Mixed mood";
}

/** "+18% on last week", or null when there's nothing to compare against. */
function weekOnWeek(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}% on last week`;
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

export default async function VenueOverview({ params, searchParams }: PageProps<"/dashboard/[venueId]">) {
  const { venueId } = await params;
  const query = await searchParams;
  const { venue, plan } = await loadDashboardVenue(venueId);
  const stats = venueStats(venue.id, WINDOW_DAYS);
  const fortnight = venueStats(venue.id, WINDOW_DAYS * 2);
  const url = guestPageUrl(await serverOrigin(), venue.shortCode);
  const config = venue.config;
  const base = `/dashboard/${venue.id}`;

  const scansDelta = weekOnWeek(stats.scans, fortnight.scans - stats.scans);
  const menuDelta = weekOnWeek(stats.menuViews, fortnight.menuViews - stats.menuViews);

  const hostedItems = config.menus.reduce((sum, menu) => sum + menu.sections.reduce((n, section) => n + section.items.length, 0), 0);
  const checklist = [
    { done: !!config.branding.logoUrl, label: "Add your logo", cta: "Upload", href: `${base}/design` },
    { done: hostedItems > 0 || config.menus.some((menu) => !!menu.externalUrl), label: "Add your menu", cta: "Add", href: `${base}/menu` },
    { done: !!config.wifi?.ssid, label: "Share your Wi-Fi", cta: "Add", href: `${base}/design` },
    { done: !!config.socialLinks.google && !!config.branding.showGoogleReviewButton, label: "Link your Google reviews", cta: "Link", href: `${base}/design` },
    ...(plan === "pro"
      ? [{ done: !!config.loyaltyProgram && (config.loyaltyProgram.stampsEnabled === false || !!config.loyaltyProgram.rewardName), label: "Set up a loyalty card", cta: "Set up", href: `${base}/loyalty` }]
      : []),
    { done: stats.scans > 0 || fortnight.scans > 0, label: "Print your QR codes and get a first scan", cta: "Print", href: `${base}/qr` },
  ];
  const done = checklist.filter((item) => item.done).length;
  const maxSource = Math.max(1, ...stats.sources.map((s) => s.scans));

  return (
    <>
      {firstParam(query.welcome) && <div className="notice notice-ok">Your page is live. Open it on your phone, then work through the checklist below.</div>}
      {firstParam(query.verified) === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks!</div>}
      {firstParam(query.verified) === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}

      <PageHeader
        title="Overview"
        description={`Last ${WINDOW_DAYS} days · ${config.name}`}
        actions={
          <>
            <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> View page
            </a>
            <div className="share-pill">
              <span className="share-pill-url">{url.replace(/^https?:\/\//, "")}</span>
              <CopyButton text={url} label="Copy link" />
            </div>
          </>
        }
      />

      <div className="stats">
        <Stat label="Scans" value={stats.scans} sub={scansDelta ?? plural(stats.visitors, "unique visit", "unique visits")} tone={scansDelta?.startsWith("+") ? "up" : undefined} />
        <Stat label="Menu views" value={stats.menuViews} sub={menuDelta ?? plural(stats.wifiOpens, "Wi-Fi open", "Wi-Fi opens")} tone={menuDelta?.startsWith("+") ? "up" : undefined} />
        <Stat label="Feedback" value={stats.feedbackCount} sub={formatSentiment(stats.averageSentiment)} href={`${base}/feedback`} />
        <Stat label="Review taps" value={stats.reviewTaps} sub="Sent to Google" />
        <Stat label="Stamps given" value={stats.stampsGiven} sub={plural(stats.rewardsRedeemed, "reward redeemed", "rewards redeemed")} />
        <Stat label="Guests" value={stats.totalGuests} sub={`+${stats.newGuests} new`} tone={stats.newGuests > 0 ? "up" : undefined} href={`${base}/guests`} />
      </div>

      <div className="overview-grid">
        <section className="card overview-chart">
          <h2 className="card-title">Scans per day</h2>
          <DailyBars data={stats.daily.map((d) => ({ day: d.day, value: d.scans }))} label="Scans per day" unit={["scan", "scans"]} />
        </section>

        <section className="card overview-sources">
          <h2 className="card-title">Where scans came from</h2>
          {stats.sources.length > 0 ? (
            <ul className="source-list">
              {stats.sources.map((source) => (
                <li key={source.source}>
                  <span className="source-row">
                    <span>{source.source === "unknown" ? "Main QR code" : source.source}</span>
                    <span className="muted num">{source.scans.toLocaleString("en-GB")}</span>
                  </span>
                  <span className="meter">
                    <span style={{ width: `${(source.scans / maxSource) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Nothing yet. Print a <Link href={`${base}/qr`}>QR code per table</Link> to see which ones get scanned.
            </p>
          )}
        </section>
      </div>

      <section className="card setup-card">
        <div className="setup-head">
          <h2 className="card-title">Get set up</h2>
          <span className="muted num">{done === checklist.length ? "All done. Nice work!" : `${done} of ${checklist.length} done`}</span>
        </div>
        <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={done}>
          <div style={{ width: `${(done / checklist.length) * 100}%` }} />
        </div>
        <ul className="checklist">
          {checklist.map((item) => (
            <li key={item.label} className={item.done ? "done" : ""}>
              <span className="tick" aria-hidden>
                {item.done && <Check />}
              </span>
              <span className="checklist-label">
                {item.label}
                {item.done && <span className="visually-hidden"> (done)</span>}
              </span>
              {!item.done && <Link href={item.href}>{item.cta}</Link>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

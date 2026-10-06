import { BookOpen, Check, Download, ExternalLink, Link2, MessageSquareText, ScanLine, Stamp, Star, Users } from "lucide-react";
import Link from "next/link";
import { DailyBars, PageHeader, Stat } from "@/components/dashboard/blocks";
import { CopyButton } from "@/components/dashboard/ui";
import { loadDashboardVenue } from "@/server/dashboard";
import { venueStats } from "@/server/repositories/insights";
import { firstParam, serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

function formatSentiment(value: number | null): string {
  if (value === null) return "–";
  if (value >= 0.25) return "Positive";
  if (value <= -0.25) return "Negative";
  return "Mixed";
}

export default async function VenueOverview({ params, searchParams }: PageProps<"/dashboard/[venueId]">) {
  const { venueId } = await params;
  const query = await searchParams;
  const { venue, plan } = await loadDashboardVenue(venueId);
  const stats = venueStats(venue.id, 30);
  const url = guestPageUrl(await serverOrigin(), venue.shortCode);
  const config = venue.config;
  const base = `/dashboard/${venue.id}`;

  const hostedItems = config.menus.reduce((sum, menu) => sum + menu.sections.reduce((n, section) => n + section.items.length, 0), 0);
  const checklist = [
    { done: !!config.branding.logoUrl, label: "Add your logo", href: `${base}/design` },
    { done: hostedItems > 0 || config.menus.some((menu) => !!menu.externalUrl), label: "Add your menu", href: `${base}/menu` },
    { done: !!config.wifi?.ssid, label: "Share your Wi-Fi", href: `${base}/design` },
    { done: !!config.socialLinks.google && !!config.branding.showGoogleReviewButton, label: "Link your Google reviews", href: `${base}/design` },
    ...(plan === "pro" ? [{ done: !!config.loyaltyProgram && (config.loyaltyProgram.stampsEnabled === false || !!config.loyaltyProgram.rewardName), label: "Set up a loyalty card", href: `${base}/loyalty` }] : []),
    { done: stats.scans > 0, label: "Print your QR codes and get a first scan", href: `${base}/qr` },
  ];
  const remaining = checklist.filter((item) => !item.done).length;
  const maxSource = Math.max(1, ...stats.sources.map((s) => s.scans));

  return (
    <>
      {firstParam(query.welcome) && (
        <div className="notice notice-ok">
          Your page is live. Open it on your phone, then work through the checklist below.
        </div>
      )}
      {firstParam(query.verified) === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks!</div>}
      {firstParam(query.verified) === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}

      <PageHeader
        title={config.name}
        description={
          <>
            Performance over the last 30 days ·{" "}
            <span className={`badge ${plan === "pro" ? "badge-pro" : ""}`}>{plan === "pro" ? "Pro" : "Free"} plan</span>
          </>
        }
        actions={
          <>
            <a className="btn" href={url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> View page
            </a>
            <Link className="btn btn-primary" href={`${base}/qr`}>
              <Download aria-hidden /> QR codes
            </Link>
          </>
        }
      />

      <div className="share-link">
        <Link2 aria-hidden />
        <code>{url}</code>
        <CopyButton text={url} label="Copy link" />
      </div>

      <div className="stats">
        <Stat label="Scans" value={stats.scans} icon={ScanLine} sub={`${stats.visitors.toLocaleString("en-GB")} unique visits`} />
        <Stat label="Menu views" value={stats.menuViews} icon={BookOpen} sub={`${stats.wifiOpens.toLocaleString("en-GB")} Wi-Fi opens`} />
        <Stat label="Feedback" value={stats.feedbackCount} icon={MessageSquareText} sub={`Mood: ${formatSentiment(stats.averageSentiment)}`} href={`${base}/feedback`} />
        <Stat label="Review taps" value={stats.reviewTaps} icon={Star} sub="Sent to Google" />
        <Stat label="Stamps given" value={stats.stampsGiven} icon={Stamp} sub={`${stats.rewardsRedeemed} reward${stats.rewardsRedeemed === 1 ? "" : "s"} redeemed`} />
        <Stat label="Guests" value={stats.totalGuests} icon={Users} sub={`+${stats.newGuests} this month · ${stats.members} members`} href={`${base}/guests`} />
      </div>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Scans per day</h2>
              <p>Your own dashboard previews aren&apos;t counted. Hover a day for its total.</p>
            </div>
          </div>
          <DailyBars data={stats.daily.map((d) => ({ day: d.day, value: d.scans }))} label="Scans per day" unit={["scan", "scans"]} />
          {stats.sources.length > 0 && (
            <>
              <h3 className="subhead">Where scans came from</h3>
              <ul className="source-list">
                {stats.sources.map((source) => (
                  <li key={source.source}>
                    <span>{source.source === "unknown" ? "Main QR code" : source.source}</span>
                    <span className="muted num">{source.scans.toLocaleString("en-GB")}</span>
                    <span className="meter">
                      <div style={{ width: `${(source.scans / maxSource) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Get set up</h2>
              <p>{remaining === 0 ? "All done. Nice work!" : `${remaining} thing${remaining === 1 ? "" : "s"} left`}</p>
            </div>
            <span className="muted num">
              {checklist.length - remaining}/{checklist.length}
            </span>
          </div>
          <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={checklist.length - remaining}>
            <div style={{ width: `${((checklist.length - remaining) / checklist.length) * 100}%` }} />
          </div>
          <ul className="checklist">
            {checklist.map((item) => (
              <li key={item.label} className={item.done ? "done" : ""}>
                <Link href={item.href}>
                  <span className="tick">{item.done && <Check aria-hidden />}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

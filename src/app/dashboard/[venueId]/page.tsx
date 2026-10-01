import { Check, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
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
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.scans));
  const maxSource = Math.max(1, ...stats.sources.map((s) => s.scans));

  return (
    <>
      {firstParam(query.welcome) && (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          Your page is live. Open it on your phone, then work through the checklist below.
        </div>
      )}
      {firstParam(query.verified) === "1" && <div className="notice notice-ok" style={{ marginBottom: 16 }}>Your email is confirmed. Thanks!</div>}
      {firstParam(query.verified) === "0" && <div className="notice notice-error" style={{ marginBottom: 16 }}>That confirmation link has expired or was already used.</div>}

      <div className="page-head">
        <div>
          <h1>{config.name}</h1>
          <p>Last 30 days</p>
        </div>
        <div className="inline">
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden /> View page
          </a>
          <Link className="btn btn-primary" href={`${base}/qr`}>
            <Download aria-hidden /> QR codes
          </Link>
        </div>
      </div>

      <div className="share-link" style={{ marginBottom: 16 }}>
        <code>{url}</code>
        <CopyButton text={url} label="Copy link" />
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="label">Scans</div>
          <div className="value">{stats.scans}</div>
          <div className="sub">{stats.visitors} unique visits</div>
        </div>
        <div className="card stat">
          <div className="label">Menu views</div>
          <div className="value">{stats.menuViews}</div>
          <div className="sub">{stats.wifiOpens} Wi-Fi opens</div>
        </div>
        <div className="card stat">
          <div className="label">Feedback</div>
          <div className="value">{stats.feedbackCount}</div>
          <div className="sub">Mood: {formatSentiment(stats.averageSentiment)}</div>
        </div>
        <div className="card stat">
          <div className="label">Review taps</div>
          <div className="value">{stats.reviewTaps}</div>
          <div className="sub">to Google</div>
        </div>
        <div className="card stat">
          <div className="label">Guests</div>
          <div className="value">{stats.totalGuests}</div>
          <div className="sub">+{stats.newGuests} this month · {stats.members} members</div>
        </div>
      </div>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Scans per day</h2>
              <p>Your own dashboard previews aren&apos;t counted.</p>
            </div>
          </div>
          <div className="bars" role="img" aria-label={`Scans over the last ${stats.days} days, peak ${maxDaily}`}>
            {stats.daily.map((day) => (
              <div key={day.day} style={{ height: `${(day.scans / maxDaily) * 100}%` }} title={`${day.day}: ${day.scans}`} />
            ))}
          </div>
          <div className="bars-axis">
            <span>{stats.daily[0]?.day}</span>
            <span>Today</span>
          </div>
          {stats.sources.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: "20px 0 10px" }}>Where scans came from</h3>
              <ul className="source-list">
                {stats.sources.map((source) => (
                  <li key={source.source}>
                    <span>{source.source === "unknown" ? "Main QR code" : source.source}</span>
                    <span className="muted">{source.scans}</span>
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

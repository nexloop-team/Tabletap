import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, CircleHelp, ExternalLink, Inbox, PartyPopper, Printer, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DailyBars, PageHeader, Stat } from "@/components/dashboard/blocks";
import { CopyButton } from "@/components/dashboard/ui";
import { parseDbDate } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";
import { unreadFeedback } from "@/server/repositories/feedback";
import { venueStats } from "@/server/repositories/insights";
import { firstParam, serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

const PERIODS = [7, 30, 90] as const;
const DAY = 86_400_000;
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** A change against the previous period, as a small up/down chip. */
function Delta({ current, previous, days }: { current: number; previous: number; days: number }) {
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  const Icon = change >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={`delta ${change >= 0 ? "up" : "down"}`}>
        <Icon aria-hidden />
        {Math.abs(change)}%
      </span>{" "}
      vs previous {days}
    </>
  );
}

function CountDelta({ current, previous, days }: { current: number; previous: number; days: number }) {
  const change = current - previous;
  if (current === 0 && previous === 0) return null;
  return (
    <>
      <span className={`delta ${change >= 0 ? "up" : "down"}`}>
        {change >= 0 ? <ArrowUpRight aria-hidden /> : <ArrowDownRight aria-hidden />}
        {Math.abs(change)}
      </span>{" "}
      vs previous {days}
    </>
  );
}

/** Is the venue in its first week, and "Since Tuesday" for its stat tiles. */
function venueAge(createdAt: string, now = Date.now()) {
  const created = parseDbDate(createdAt) ?? now;
  return { firstWeek: now - created < 7 * DAY, sinceDay: `Since ${new Date(created).toLocaleDateString("en-GB", { weekday: "long" })}` };
}

/** "One says Saturday service felt slow." — the start of the newest unread note. */
function snippet(text: string | null): string | null {
  if (!text) return null;
  const first = text.trim().split(/(?<=[.!?])\s/)[0];
  return first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first;
}

export default async function VenueOverview({ params, searchParams }: PageProps<"/dashboard/[venueId]">) {
  const { venueId } = await params;
  const query = await searchParams;
  const { venue, user } = await loadDashboardVenue(venueId);
  const days = PERIODS.find((p) => String(p) === firstParam(query.days)) ?? 30;
  const stats = venueStats(venue.id, days);
  const both = venueStats(venue.id, days * 2);
  const url = guestPageUrl(await serverOrigin(), venue.shortCode);
  const config = venue.config;
  const base = `/dashboard/${venue.id}`;
  const unread = unreadFeedback(venue.id, user.id);

  const { firstWeek, sinceDay } = venueAge(venue.createdAt);
  const googleLinked = !!config.socialLinks.google && !!config.branding.showGoogleReviewButton;
  const club = config.loyaltyProgram?.stampsEnabled === false;

  const hostedItems = config.menus.reduce((sum, menu) => sum + menu.sections.reduce((n, section) => n + section.items.length, 0), 0);
  const checklist: { done: boolean; label: string; cta: string; href: string; why: string; icon?: ReactNode; help?: string }[] = [
    { done: !!config.branding.logoUrl, label: "Add your logo", cta: "Upload", href: `${base}/design#logo`, why: "It sits on your page, your QR cards and every email guests get." },
    { done: hostedItems > 0 || config.menus.some((menu) => !!menu.externalUrl), label: "Add your menu", cta: "Add your menu", href: `${base}/menu`, why: "Type it in, or take a photo of your printed menu and we'll read it." },
    { done: !!config.wifi?.ssid, label: "Share your Wi-Fi", cta: "Add Wi-Fi", href: `${base}/design#wifi`, why: "Guests copy the password in one tap, so nobody has to ask at the counter." },
    { done: googleLinked, label: "Link your Google reviews", cta: "Add the link", href: `${base}/design#google`, why: "Guests who loved their visit can't find your review page yet. It takes a minute.", help: `${base}/design#google` },
    {
      done: !!config.loyaltyProgram && (config.loyaltyProgram.stampsEnabled === false || !!config.loyaltyProgram.rewardName),
      label: club ? "Set up your members club" : "Set up a stamp card",
      cta: "Set up",
      href: `${base}/loyalty`,
      why: "Regulars collect stamps on their phone and staff add them at the till.",
    },
    { done: stats.scans > 0 || both.scans > 0, label: "Print your QR codes and get a first scan", cta: "Print QR codes", href: `${base}/qr`, why: "One per table, so you can see which tables scan most.", icon: <Printer aria-hidden /> },
  ];
  const done = checklist.filter((item) => item.done).length;
  const next = checklist.find((item) => !item.done) ?? null;
  // A new venue gets the whole checklist; an established one a short "what to do next".
  const settingUp = done <= 3 || (firstWeek && done < checklist.length);

  const sources = [...stats.sources].sort((a, b) => b.scans - a.scans);
  const topSources = sources.slice(0, 5);
  const others = sources.slice(5);
  const otherScans = others.reduce((sum, s) => sum + s.scans, 0);
  const maxSource = Math.max(1, ...topSources.map((s) => s.scans), otherScans);

  const byWeekday = new Array<number>(7).fill(0);
  for (const d of stats.daily) byWeekday[new Date(`${d.day}T00:00:00Z`).getUTCDay()] += d.scans;
  const busiest = stats.scans >= 10 ? WEEKDAYS[byWeekday.indexOf(Math.max(...byWeekday))] : null;

  const previous = {
    scans: both.scans - stats.scans,
    menuViews: both.menuViews - stats.menuViews,
    feedback: both.feedbackCount - stats.feedbackCount,
    stamps: both.stampsGiven - stats.stampsGiven,
    reviews: both.reviewTaps - stats.reviewTaps,
  };

  return (
    <>
      {firstParam(query.welcome) && <div className="notice notice-ok">Your page is live. Open it on your phone, then work through the checklist below.</div>}
      {firstParam(query.verified) === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks!</div>}
      {firstParam(query.verified) === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}
      {firstWeek && !firstParam(query.welcome) && (
        <div className="live-card">
          <PartyPopper aria-hidden />
          <span>
            <strong>Your page is live</strong>
            <span>Guests can open it now. Put a QR code on each table so they find it.</span>
          </span>
        </div>
      )}

      <PageHeader
        title="Overview"
        description={firstWeek ? `${config.name} · your first week` : `${config.name} · last ${days} days`}
        actions={
          <>
            <div className="share-pill">
              <span className="share-pill-url">{url.replace(/^https?:\/\//, "")}</span>
              <CopyButton text={url} label="Copy" />
            </div>
            <a className="btn" href={url} target="_blank" rel="noreferrer">
              View page <ExternalLink aria-hidden />
            </a>
            <nav className="segmented period-switch" aria-label="Period">
              {PERIODS.map((p) => (
                <Link key={p} href={p === 30 ? base : `${base}?days=${p}`} aria-current={p === days ? "true" : undefined}>
                  {p} days
                </Link>
              ))}
            </nav>
          </>
        }
      />

      {settingUp ? (
        <section className="card setup-card">
          <div className="setup-head">
            <h2 className="card-title">Get set up</h2>
            <span className="muted num">{`${done} of ${checklist.length} done`}</span>
          </div>
          <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={done}>
            <div style={{ width: `${(done / checklist.length) * 100}%` }} />
          </div>
          {next && (
            <div className="setup-next">
              <span className="setup-next-dot" aria-hidden />
              <div>
                <span className="setup-next-label">Next</span>
                <strong>{next.label}</strong>
                <p>{next.why}</p>
                <Link className="btn btn-primary" href={next.href}>
                  {next.icon} {next.cta}
                </Link>
              </div>
            </div>
          )}
          <ul className="checklist">
            {checklist
              .filter((item) => item !== next)
              .sort((a, b) => Number(a.done) - Number(b.done))
              .map((item) => (
                <li key={item.label} className={item.done ? "done" : ""}>
                  <span className="tick" aria-hidden>
                    {item.done && <Check />}
                  </span>
                  <span className="checklist-label">{item.label}</span>
                  {item.done ? (
                    <span className="muted">Done</span>
                  ) : (
                    <Link href={item.href} aria-label={item.label}>
                      <ArrowRight aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ) : (
        <section className="card next-card">
          <div className="card-head">
            <h2>What to do next</h2>
            <span className="next-setup">
              Setup {done} of {checklist.length} done
              <span className="progress small" aria-hidden>
                <span style={{ width: `${(done / checklist.length) * 100}%` }} />
              </span>
            </span>
          </div>
          <div className="next-grid">
            {unread.count > 0 && (
              <div className="next-tile">
                <span className="next-icon warm" aria-hidden>
                  <Inbox />
                </span>
                <div>
                  <strong>
                    {unread.count} new feedback message{unread.count === 1 ? "" : "s"}
                  </strong>
                  {snippet(unread.latest) && <p>{unread.count === 1 ? `“${snippet(unread.latest)}”` : `One says: “${snippet(unread.latest)}”`} Worth a look.</p>}
                  <Link className="btn btn-primary btn-sm" href={`${base}/feedback`}>
                    Read feedback
                  </Link>
                </div>
              </div>
            )}
            {next && (
              <div className="next-tile">
                <span className="next-icon" aria-hidden>
                  <Star />
                </span>
                <div>
                  <strong>{next.label}</strong>
                  <p>{next.why}</p>
                  <span className="inline">
                    <Link className="btn btn-sm" href={next.href}>
                      {next.cta}
                    </Link>
                    {next.help && (
                      <Link className="link-quiet inline" href={next.help}>
                        <CircleHelp aria-hidden /> How do I find it?
                      </Link>
                    )}
                  </span>
                </div>
              </div>
            )}
            {unread.count === 0 && !next && (
              <div className="next-tile">
                <span className="next-icon" aria-hidden>
                  <Check />
                </span>
                <div>
                  <strong>You’re all set</strong>
                  <p>No new feedback, and every setup step is done. Check back after the weekend.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="stats">
        <Stat label="Scans" value={stats.scans} sub={firstWeek ? sinceDay : <Delta current={stats.scans} previous={previous.scans} days={days} />} />
        <Stat label="Menu views" value={stats.menuViews} sub={firstWeek ? sinceDay : <Delta current={stats.menuViews} previous={previous.menuViews} days={days} />} />
        <Stat
          label="Feedback"
          value={stats.feedbackCount}
          sub={unread.count > 0 ? `${unread.count} unread` : firstWeek ? sinceDay : <CountDelta current={stats.feedbackCount} previous={previous.feedback} days={days} />}
          href={`${base}/feedback`}
        />
        <Stat
          label="Review taps"
          value={googleLinked ? stats.reviewTaps : "—"}
          sub={googleLinked ? <CountDelta current={stats.reviewTaps} previous={previous.reviews} days={days} /> : <Link href={`${base}/design#google`}>{firstWeek ? "Link Google first" : "Link Google to count these"}</Link>}
        />
        <Stat
          label={club ? "Members" : "Stamps given"}
          value={club ? stats.totalGuests : stats.stampsGiven}
          sub={firstWeek ? sinceDay : club ? undefined : <CountDelta current={stats.stampsGiven} previous={previous.stamps} days={days} />}
        />
        <Stat label="Guests" value={stats.totalGuests} sub={firstWeek ? sinceDay : <CountDelta current={stats.newGuests} previous={both.newGuests - stats.newGuests} days={days} />} href={`${base}/guests`} />
      </div>

      <div className="overview-grid">
        <section className="card overview-chart">
          <div className="card-head">
            <div>
              <h2>Scans per day</h2>
              {stats.scans > 0 && (
                <p>
                  {stats.scans.toLocaleString("en-GB")} scans{busiest ? ` · busiest on ${busiest}` : ""}
                </p>
              )}
            </div>
            {stats.scans > 0 && <span className="chart-legend">Today</span>}
          </div>
          {stats.scans > 0 ? (
            <DailyBars data={stats.daily.map((d) => ({ day: d.day, value: d.scans }))} label="Scans per day" unit={["scan", "scans"]} today />
          ) : (
            <div className="chart-empty">
              <div className="chart-ghost" aria-hidden>
                {[30, 50, 40, 65, 80, 12, 8].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <p>Your chart fills in as guests scan your table codes. Check back after the weekend.</p>
            </div>
          )}
        </section>

        <section className="card overview-sources">
          <div className="card-head">
            <div>
              <h2>Where scans came from</h2>
              <p>One QR code per table</p>
            </div>
          </div>
          {sources.length > 0 ? (
            <ul className="source-list">
              {topSources.map((source) => (
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
              {others.length > 0 && (
                <li>
                  <span className="source-row">
                    <span>Other tables ({others.length})</span>
                    <span className="muted num">{otherScans.toLocaleString("en-GB")}</span>
                  </span>
                  <span className="meter muted-meter">
                    <span style={{ width: `${(otherScans / maxSource) * 100}%` }} />
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <p className="muted">
              Nothing yet. Print a <Link href={`${base}/qr`}>QR code per table</Link> to see which ones get scanned.
            </p>
          )}
          <Link className="link-quiet inline sources-manage" href={`${base}/qr`}>
            Manage QR codes <ArrowRight aria-hidden />
          </Link>
        </section>
      </div>
    </>
  );
}

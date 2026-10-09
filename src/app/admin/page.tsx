import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AdminExtendTrial, AdminVenueActions } from "@/components/dashboard/AdminActions";
import { SegmentBadge } from "@/components/dashboard/admin-blocks";
import { DailyBars, PageHeader } from "@/components/dashboard/blocks";
import { dailyCounts, formatAgo, formatDate } from "@/lib/format";
import { formatInr, parseDbDate, PRICE_INR } from "@/lib/plans";
import { adminUsers, adminVenues, isRecent, revenueSummary, type AdminVenue } from "@/server/admin";
import { requireAdminPage } from "@/server/dashboard";
import { serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

export const metadata: Metadata = { title: "Overview" };

const DAY = 86_400_000;

/** Read once per render, outside the component body. */
function currentTime(): number {
  return Date.now();
}

/** ₹1.5L, ₹80k, ₹999: short enough for a chart axis. */
function shortInr(value: number): string {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(value >= 1_000_000 ? 0 : 1).replace(/\.0$/, "")}L`;
  if (value >= 1_000) return `₹${Math.round(value / 1_000)}k`;
  return `₹${Math.round(value)}`;
}

/** Round an axis maximum up to 1, 2, 2.5 or 5 times a power of ten, so the gridlines get tidy labels. */
function niceCeiling(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((n) => value / power <= n) ?? 10;
  return step * power;
}

function StatTile({ label, value, sub, tone, href }: { label: string; value: string | number; sub: string; tone: string; href?: string }) {
  const body = (
    <>
      <span className="label">
        <span className={`stat-dot ${tone}`} aria-hidden />
        {label}
      </span>
      <span className="value">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</span>
      <span className="sub">{sub}</span>
    </>
  );
  return href ? (
    <Link className="card stat stat-link" href={href}>
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}

type Attention = { venue: AdminVenue; tag: string; tone: string; note: string; action: "view" | "extend" | "review" };

function attentionList(venues: AdminVenue[], now: number): Attention[] {
  const failing = venues.filter((v) => v.pastDue).map((venue) => ({ venue, tag: "Payment failing", tone: "warm", note: "Razorpay is retrying the renewal. Page still live.", action: "view" as const }));
  const ending = venues
    .filter((v) => v.segment === "trial" && v.trialDays !== null && v.trialDays <= 3)
    .map((venue) => ({
      venue,
      tag: "Trial ends",
      tone: "warm",
      note: `${venue.trialDays === 1 ? "Ends tonight" : `Ends in ${venue.trialDays} days`}. ${venue.scans7d} scan${venue.scans7d === 1 ? "" : "s"} this week${venue.scans7d >= 20 ? ", so worth a nudge" : ""}.`,
      action: "extend" as const,
    }));
  const offline = venues
    .filter((v) => v.segment === "unpaid" && v.ownerEmail && (parseDbDate(v.trialEndsAt) ?? 0) > now - 14 * DAY)
    .map((venue) => {
      const quiet = venue.lastScanAt ? Math.floor((now - (parseDbDate(venue.lastScanAt) ?? now)) / DAY) : null;
      return {
        venue,
        tag: "Went offline",
        tone: "danger",
        note: `Trial ended ${formatAgo(venue.trialEndsAt ?? venue.createdAt).toLowerCase()}.${quiet !== null && quiet > 0 ? ` No scans for ${quiet} day${quiet === 1 ? "" : "s"}.` : ""}`,
        action: "extend" as const,
      };
    });
  const suspended = venues.filter((v) => v.segment === "suspended").map((venue) => ({ venue, tag: "Suspended", tone: "muted", note: "Guest page offline until restored.", action: "review" as const }));
  return [...failing, ...ending, ...offline, ...suspended].slice(0, 6);
}

/** Operator home: platform health and money at a glance, and the venues that need a human. */
export default async function AdminOverview() {
  await requireAdminPage();
  const users = adminUsers();
  const venues = adminVenues();
  const money = revenueSummary(venues);
  const origin = await serverOrigin();
  const now = currentTime();

  const count = (segment: string) => venues.filter((venue) => venue.segment === segment).length;
  const unpaid = venues.filter((v) => v.segment === "unpaid");
  const wentOffline = unpaid.filter((v) => (parseDbDate(v.trialEndsAt) ?? 0) > now - 7 * DAY).length;
  const guests = venues.reduce((sum, venue) => sum + venue.guests, 0);
  const signups = dailyCounts(
    users.map((user) => user.createdAt),
    30,
  );
  const signupTotal = signups.reduce((sum, day) => sum + day.count, 0);
  const signupsWeek = users.filter((u) => isRecent(u.createdAt)).length;
  const attention = attentionList(venues, now);
  const history = money.history;
  const maxArr = niceCeiling(Math.max(PRICE_INR, ...history.map((h) => h.value)));
  const axis = [1, 0.75, 0.5, 0.25, 0].map((f) => maxArr * f);

  return (
    <div className="page admin-overview">
      <PageHeader
        eyebrow="Platform admin"
        title="Platform overview"
        description={`${new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · amounts before GST`}
      />

      <div className="stats">
        <StatTile label="Venues" value={venues.length} sub={`+${venues.filter((v) => isRecent(v.createdAt, 30)).length} this month`} tone="admin" href="/admin/venues" />
        <StatTile label="Accounts" value={users.length} sub={`+${users.filter((u) => isRecent(u.createdAt, 30)).length} this month`} tone="admin" href="/admin/accounts" />
        <StatTile label="Paying" value={money.paying} sub={venues.length ? `${Math.round((money.paying / venues.length) * 100)}% of venues` : "No venues yet"} tone="ok" href="/admin/venues?segment=paying" />
        <StatTile label="On trial" value={count("trial")} sub={`${money.trialsEndingThisWeek} end this week`} tone="warm" href="/admin/venues?segment=trial" />
        <StatTile label="Unpaid, page offline" value={unpaid.length} sub={`${wentOffline} went offline this week`} tone="danger" href="/admin/venues?segment=unpaid" />
        <StatTile label="Guests captured" value={guests} sub="Across all venues" tone="muted" />
      </div>

      <section className="card revenue-card">
        <div className="revenue-numbers">
          <span className="label">Yearly recurring revenue</span>
          <span className="revenue-big">{formatInr(money.arr)}</span>
          <span className="revenue-new">
            {money.newPaying30d > 0 && (
              <span className="delta up">
                <ArrowUpRight aria-hidden />
                {formatInr(money.newPaying30d * PRICE_INR)}
              </span>
            )}{" "}
            {money.newPaying30d} new paying venue{money.newPaying30d === 1 ? "" : "s"} this month
          </span>
          <dl className="revenue-grid">
            <div>
              <dt>Per month</dt>
              <dd>{formatInr(money.mrr)}</dd>
            </div>
            <div>
              <dt>Trial to paid, 90 days</dt>
              <dd>{money.trialToPaid90d === null ? "—" : `${Math.round(money.trialToPaid90d * 100)}%`}</dd>
            </div>
            <div>
              <dt>Churn, 30 days</dt>
              <dd>{`${(money.churn30d * 100).toFixed(1).replace(/\.0$/, "")}%`}</dd>
            </div>
            <div>
              <dt>Won’t renew</dt>
              <dd>
                {money.wontRenew} <small>{formatInr(money.wontRenewInr)}</small>
              </dd>
            </div>
            <div>
              <dt>
                <AlertTriangle aria-hidden /> Payment failing
              </dt>
              <dd>
                {money.pastDue} <small>{formatInr(money.atRiskInr)} at risk</small>
              </dd>
            </div>
          </dl>
        </div>
        <figure className="arr-chart" aria-label="Yearly recurring revenue at the end of each of the last 12 months">
          <figcaption>
            <strong>Yearly recurring revenue, last 12 months</strong>
            <span>End of each month · estimated from paying venues</span>
          </figcaption>
          <div className="arr-plot">
            <div className="arr-axis" aria-hidden>
              {axis.map((value) => (
                <span key={value}>{shortInr(value)}</span>
              ))}
            </div>
            <div className="arr-bars">
              {history.map((point, i) => (
                <div key={`${point.month}-${i}`} className={`arr-col${i === history.length - 1 ? " current" : ""}`} title={`${point.month}: ${formatInr(point.value)}`}>
                  {i === history.length - 1 && <span className="arr-value">{shortInr(point.value)}</span>}
                  <span className="arr-bar" style={{ height: `${(point.value / maxArr) * 100}%` }} />
                  <span className="arr-month">{point.month}</span>
                </div>
              ))}
            </div>
          </div>
        </figure>
      </section>

      <div className="overview-grid">
        <section className="card card-flush">
          <div className="card-head">
            <h2>Needs attention</h2>
            <span className="muted">
              {attention.length} venue{attention.length === 1 ? "" : "s"}
            </span>
          </div>
          {attention.length === 0 ? (
            <div className="empty empty-compact">
              <span className="empty-icon ok">
                <CheckCircle2 aria-hidden />
              </span>
              <strong>All clear</strong>
              <p>No venue needs action right now.</p>
            </div>
          ) : (
            <ul className="attention-rows">
              {attention.map(({ venue, tag, tone, note, action }) => (
                <li key={`${venue.id}-${tag}`}>
                  <span className={`attention-tag ${tone}`}>
                    <span aria-hidden />
                    {tag}
                  </span>
                  <span className="attention-text">
                    <strong>{venue.name}</strong>
                    <span>{note}</span>
                  </span>
                  {action === "extend" ? (
                    <AdminExtendTrial venueId={venue.id} name={venue.name} offline={venue.segment === "unpaid"} />
                  ) : (
                    <Link className="btn btn-sm" href={action === "review" ? `/admin/venues?segment=suspended&q=${encodeURIComponent(venue.shortCode)}` : `/dashboard/${venue.id}`}>
                      {action === "review" ? "Review" : "View"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>New accounts</h2>
              <p>
                {signupTotal.toLocaleString("en-IN")} in the last 30 days · {signupsWeek} this week
              </p>
            </div>
          </div>
          <DailyBars data={signups.map((d) => ({ day: d.day, value: d.count }))} label="New accounts per day" unit={["sign-up", "sign-ups"]} />
        </section>
      </div>

      <section className="card card-flush">
        <div className="card-head">
          <h2>Latest venues</h2>
          <nav className="filter-tabs" aria-label="Open the venue list filtered">
            <Link href="/admin/venues" aria-current="true">
              All
            </Link>
            <Link href="/admin/venues?segment=paying">Paying</Link>
            <Link href="/admin/venues?segment=trial">Trial</Link>
            <Link href="/admin/venues?segment=unpaid">Unpaid</Link>
            <Link href="/admin/venues?segment=free">Free access</Link>
            <Link href="/admin/venues?segment=suspended">Suspended</Link>
          </nav>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Venue</th>
                <th scope="col">Owner</th>
                <th scope="col">Subscription</th>
                <th scope="col" className="num">
                  Guests
                </th>
                <th scope="col" className="num">
                  Scans, 7 days
                </th>
                <th scope="col">Last scan</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {venues.slice(0, 6).map((venue) => (
                <tr key={venue.id}>
                  <td>
                    <Link className="cell-venue" href={`/dashboard/${venue.id}`}>
                      <span>
                        <strong>{venue.name}</strong>
                        <span className="mono muted">{venue.shortCode}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="truncate">{venue.ownerEmail ?? <span className="muted">Tabletap team</span>}</td>
                  <td>
                    <SegmentBadge venue={venue} />
                  </td>
                  <td className="num">{venue.guests.toLocaleString("en-IN")}</td>
                  <td className="num">{venue.scans7d.toLocaleString("en-IN")}</td>
                  <td className="nowrap">{venue.lastScanAt ? formatAgo(venue.lastScanAt) : <span className="muted">Never</span>}</td>
                  <td className="nowrap">
                    <span title={formatDate(venue.createdAt)}>{formatAgo(venue.createdAt)}</span>
                  </td>
                  <td className="cell-actions">
                    <AdminVenueActions venueId={venue.id} name={venue.name} guestUrl={guestPageUrl(origin, venue.shortCode)} status={venue.status} segment={venue.segment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          Showing {Math.min(6, venues.length)} of {venues.length.toLocaleString("en-IN")} ·{" "}
          <Link href="/admin/venues">
            All venues <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

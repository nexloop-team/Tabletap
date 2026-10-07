import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Ban, Building2, CheckCircle2, Clock, IndianRupee, PowerOff, Users, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { SegmentBadge } from "@/components/dashboard/admin-blocks";
import { DailyBars, PageHeader, Stat } from "@/components/dashboard/blocks";
import { VenueAvatar } from "@/components/dashboard/Shell";
import { dailyCounts, formatAgo } from "@/lib/format";
import { formatInr } from "@/lib/plans";
import { adminUsers, adminVenues, isRecent, revenueSummary } from "@/server/admin";
import { requireAdminPage } from "@/server/dashboard";

export const metadata: Metadata = { title: "Overview" };

/** Operator home: platform health at a glance, and the venues that need a human. */
export default async function AdminOverview() {
  await requireAdminPage();
  const users = adminUsers();
  const venues = adminVenues();

  const count = (segment: string) => venues.filter((venue) => venue.segment === segment).length;
  const trialing = count("trial");
  const unpaid = count("unpaid");
  const money = revenueSummary(venues);
  const unverified = users.filter((user) => !user.emailVerified).length;
  const guests = venues.reduce((sum, venue) => sum + venue.guests, 0);
  const active = venues.length - count("suspended");
  const signups = dailyCounts(
    users.map((user) => user.createdAt),
    30,
  );
  const signupTotal = signups.reduce((sum, day) => sum + day.count, 0);

  const attention = [
    ...venues.filter((venue) => venue.pastDue).map((venue) => ({ venue, icon: AlertTriangle, reason: "Renewal payment failing" })),
    ...venues
      .filter((venue) => venue.segment === "trial" && venue.trialDays !== null && venue.trialDays <= 3)
      .map((venue) => ({ venue, icon: Clock, reason: `Trial ends in ${venue.trialDays} day${venue.trialDays === 1 ? "" : "s"}` })),
    ...venues.filter((venue) => venue.segment === "suspended").map((venue) => ({ venue, icon: Ban, reason: "Suspended: guest page offline" })),
    ...venues
      .filter((venue) => venue.segment === "unpaid" && isRecent(venue.subscriptionUpdatedAt ?? venue.trialEndsAt ?? venue.createdAt, 14))
      .map((venue) => ({ venue, icon: PowerOff, reason: "Unpaid: guest page offline" })),
  ].slice(0, 8);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Platform admin"
        title="Overview"
        description="Every venue and account on the platform, as of right now."
        actions={
          <Link className="btn" href="/admin/venues">
            <Building2 aria-hidden /> Manage venues
          </Link>
        }
      />

      <div className="stats">
        <Stat label="Venues" value={venues.length} icon={Building2} sub={`${venues.filter((v) => isRecent(v.createdAt)).length} new this week · ${active} live`} href="/admin/venues" />
        <Stat label="Accounts" value={users.length} icon={Users} sub={`${users.filter((u) => isRecent(u.createdAt)).length} new this week · ${unverified} unverified`} href="/admin/accounts" />
        <Stat
          label="Paying"
          value={money.paying}
          icon={IndianRupee}
          sub={venues.length ? `${Math.round((money.paying / venues.length) * 100)}% of venues` : "No venues yet"}
          href="/admin/venues?segment=paying"
        />
        <Stat label="On trial" value={trialing} icon={Clock} sub={`${money.trialsEndingThisWeek} end within a week`} href="/admin/venues?segment=trial" />
        <Stat label="Unpaid" value={unpaid} icon={PowerOff} sub="Guest page offline" href="/admin/venues?segment=unpaid" />
        <Stat label="Guests captured" value={guests} icon={UserRoundPlus} sub="Across all venues" />
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2>Revenue</h2>
            <p>Before GST, from venues paying through Razorpay</p>
          </div>
        </div>
        <dl className="money-grid">
          <div>
            <dt>Yearly recurring</dt>
            <dd>{formatInr(money.arr)}</dd>
            <span>{money.paying - money.wontRenew} renewing</span>
          </div>
          <div>
            <dt>Per month</dt>
            <dd>{formatInr(money.mrr)}</dd>
            <span>Yearly ÷ 12</span>
          </div>
          <div>
            <dt>Churn · 30 days</dt>
            <dd>{Math.round(money.churn30d * 100)}%</dd>
            <span>
              {money.lapsed30d} cancelled or lapsed
            </span>
          </div>
          <div>
            <dt>Won&apos;t renew</dt>
            <dd>{money.wontRenew}</dd>
            <span>Cancelled, still paid up</span>
          </div>
          <div>
            <dt>Payment failing</dt>
            <dd>{money.pastDue}</dd>
            <span>Razorpay is retrying</span>
          </div>
        </dl>
      </section>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>New accounts</h2>
              <p>
                {signupTotal.toLocaleString("en-GB")} sign-up{signupTotal === 1 ? "" : "s"} in the last 30 days
              </p>
            </div>
          </div>
          <DailyBars data={signups.map((d) => ({ day: d.day, value: d.count }))} label="New accounts per day" unit={["sign-up", "sign-ups"]} />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Needs attention</h2>
              <p>Failing payments, ending trials, offline pages and suspensions</p>
            </div>
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
            <ul className="attention-list">
              {attention.map(({ venue, icon: Icon, reason }) => (
                <li key={`${venue.id}-${reason}`}>
                  <Link href={`/dashboard/${venue.id}`}>
                    <Icon className="attention-icon" aria-hidden />
                    <span className="attention-text">
                      <strong>{venue.name}</strong>
                      <span>{reason}</span>
                    </span>
                    <ArrowRight className="attention-go" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card card-flush">
        <div className="card-head">
          <div>
            <h2>Latest venues</h2>
            <p>The six most recent sign-ups</p>
          </div>
          <Link className="btn btn-sm" href="/admin/venues">
            View all <ArrowRight aria-hidden />
          </Link>
        </div>
        {venues.length === 0 ? (
          <div className="empty empty-compact">
            <span className="empty-icon">
              <Building2 aria-hidden />
            </span>
            <strong>No venues yet</strong>
          </div>
        ) : (
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
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {venues.slice(0, 6).map((venue) => (
                  <tr key={venue.id}>
                    <td>
                      <Link className="cell-venue" href={`/dashboard/${venue.id}`}>
                        <VenueAvatar venue={{ name: venue.name, logoUrl: null }} />
                        <span>
                          <strong>{venue.name}</strong>
                          <span className="mono muted">/{venue.shortCode}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="truncate">{venue.ownerEmail ?? <span className="muted">Demo venue</span>}</td>
                    <td>
                      <SegmentBadge venue={venue} />
                    </td>
                    <td className="num">{venue.guests.toLocaleString("en-GB")}</td>
                    <td className="muted nowrap">{formatAgo(venue.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

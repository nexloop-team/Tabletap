import type { Metadata } from "next";
import Link from "next/link";
import { AdminVenueActions } from "@/components/dashboard/AdminActions";
import { TopbarLinks } from "@/components/dashboard/Shell";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { effectivePlan, type SubscriptionStatus } from "@/lib/plans";
import { requireAdminPage } from "@/server/dashboard";
import { listUsersForAdmin } from "@/server/repositories/users";
import { listVenuesForAdmin } from "@/server/repositories/venues";
import "@/styles/app.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** Operator view: every account and venue, with suspend and comp controls. Gated by ADMIN_EMAILS. */
export default async function AdminPage() {
  await requireAdminPage();
  const users = listUsersForAdmin();
  const venues = listVenuesForAdmin().map((venue) => ({
    ...venue,
    effective: effectivePlan({
      plan: venue.plan,
      status: (venue.subscriptionStatus ?? "active") as SubscriptionStatus,
      trialEndsAt: venue.trialEndsAt,
      currentPeriodEnd: null,
    }),
  }));
  const paying = venues.filter((venue) => venue.plan === "pro" && venue.subscriptionStatus !== "canceled").length;
  const trialing = venues.filter((venue) => venue.effective === "pro" && venue.plan !== "pro").length;

  return (
    <div className="app">
      <header className="topbar">
        <Link className="wordmark" href="/dashboard">
          <BrandMark />
          {BRAND.name}
        </Link>
        <span className="badge badge-danger">Admin</span>
        <span className="topbar-spacer" />
        <TopbarLinks isAdmin />
      </header>
      <main className="dash-main" style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div className="stats" style={{ marginBottom: 16 }}>
          <div className="card stat">
            <div className="label">Accounts</div>
            <div className="value">{users.length}</div>
          </div>
          <div className="card stat">
            <div className="label">Venues</div>
            <div className="value">{venues.length}</div>
          </div>
          <div className="card stat">
            <div className="label">Paying Pro</div>
            <div className="value">{paying}</div>
          </div>
          <div className="card stat">
            <div className="label">On trial</div>
            <div className="value">{trialing}</div>
          </div>
        </div>

        <section className="card">
          <div className="card-head">
            <h2>Venues</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Guests</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.id}>
                    <td>
                      <Link href={`/dashboard/${venue.id}`}>
                        <strong>{venue.name}</strong>
                      </Link>
                      <span className="muted mono" style={{ display: "block" }}>
                        {venue.shortCode}
                      </span>
                      {venue.status === "suspended" && <span className="badge badge-danger">Suspended</span>}
                    </td>
                    <td>{venue.ownerEmail ?? <span className="muted">demo</span>}</td>
                    <td>
                      <span className={`badge ${venue.effective === "pro" ? "badge-pro" : ""}`}>{venue.effective === "pro" ? "Pro" : "Free"}</span>{" "}
                      <span className="muted">{venue.plan === "pro" ? venue.subscriptionStatus : venue.effective === "pro" ? "trial" : ""}</span>
                    </td>
                    <td>{venue.guests}</td>
                    <td className="muted">{venue.createdAt.slice(0, 10)}</td>
                    <td>
                      <AdminVenueActions venueId={venue.id} status={venue.status} plan={venue.plan === "pro" && venue.subscriptionStatus !== "canceled" ? "pro" : "free"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Accounts</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Venues</th>
                  <th>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>
                      {user.email} {!user.emailVerified && <span className="badge badge-warn">unverified</span>}
                    </td>
                    <td>{user.venueCount}</td>
                    <td className="muted">{user.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

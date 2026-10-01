import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { firstParam } from "@/server/request";
import { requireUser } from "@/server/auth/session";
import { listVenuesForUser } from "@/server/repositories/venues";

/** Lands new merchants in onboarding, single-venue merchants in their venue, and lists the rest. */
export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const verified = firstParam((await searchParams).verified);
  const venues = listVenuesForUser(user.id);
  if (venues.length === 0) redirect("/onboarding");
  if (venues.length === 1) redirect(`/dashboard/${venues[0].id}${verified ? `?verified=${verified}` : ""}`);

  return (
    <main className="dash-main" style={{ maxWidth: 1080, margin: "0 auto" }}>
      {verified === "1" && <div className="notice notice-ok" style={{ marginBottom: 16 }}>Your email is confirmed. Thanks!</div>}
      {verified === "0" && <div className="notice notice-error" style={{ marginBottom: 16 }}>That confirmation link has expired or was already used.</div>}
      <div className="page-head">
        <div>
          <h1>Your venues</h1>
          <p>Each venue has its own page, QR codes and plan.</p>
        </div>
        <Link className="btn btn-primary" href="/onboarding">
          <Plus aria-hidden /> Add a venue
        </Link>
      </div>
      <div className="venue-list">
        {venues.map((venue) => (
          <Link key={venue.id} href={`/dashboard/${venue.id}`} className="card venue-tile">
            <span
              className="venue-dot"
              style={{
                backgroundColor: venue.config.branding.backgroundColorHex ?? "#fff",
                backgroundImage: venue.config.branding.logoUrl ? `url("${venue.config.branding.logoUrl}")` : undefined,
              }}
            />
            <span>
              <strong>{venue.config.name}</strong>
              <span className="hint" style={{ display: "block" }}>
                /{venue.shortCode}
                {venue.status === "suspended" ? " · suspended" : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

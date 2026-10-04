import { Camera, Search } from "lucide-react";
import Link from "next/link";
import { ScanCardButton } from "@/components/staff/ScanCardButton";
import { firstParam } from "@/server/request";
import { getVenueRecord } from "@/server/repositories/venues";
import { currentStaffDevice, searchMembers } from "@/server/services/staff";

/** Home screen of a paired till device: how to stamp, plus a member search fallback. */
export default async function StaffHome({ searchParams }: PageProps<"/staff">) {
  const params = await searchParams;
  const paired = firstParam(params.paired);
  const device = await currentStaffDevice();

  if (!device) {
    return (
      <section className="card">
        {paired === "0" && <div className="notice notice-error" style={{ marginBottom: 16 }}>That pairing link has expired or was already used. Ask the owner for a new one.</div>}
        <h1 style={{ fontSize: 22 }}>This isn&apos;t a staff device yet</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          The venue owner can pair it from their dashboard: <strong>Loyalty &amp; capture → Staff devices → Add a staff device</strong>, then open the link on this phone or tablet.
        </p>
      </section>
    );
  }

  const venue = getVenueRecord(device.venueId);
  const q = firstParam(params.q).slice(0, 80);
  const matches = q ? searchMembers(device, q) : [];

  return (
    <>
      {paired === "1" && <div className="notice notice-ok" style={{ marginBottom: 16 }}>This device is ready for stamping. Keep it at the till.</div>}
      <section className="card">
        <div className="hint">
          {venue?.config.name} · {device.label}
        </div>
        <h1 style={{ fontSize: 22, margin: "4px 0 10px" }}>Stamp a card</h1>
        <ol className="staff-steps">
          <li>Ask the guest to open their card and tap <strong>Show to staff</strong>.</li>
          <li>
            <Camera size={16} aria-hidden /> Tap <strong>Scan a card</strong> and point the camera at their code.
          </li>
          <li>Add the stamp, or hand over their reward.</li>
        </ol>
        <div style={{ marginTop: 16 }}>
          <ScanCardButton />
        </div>
      </section>

      <section className="card">
        <h2 className="staff-h2">No card to hand?</h2>
        <form className="inline" action="/staff">
          <input className="input" style={{ flex: 1, minWidth: 160 }} name="q" defaultValue={q} placeholder="Guest's name or email" aria-label="Find a member" />
          <button className="btn" type="submit">
            <Search aria-hidden /> Find
          </button>
        </form>
        {q && (
          <ul className="staff-results">
            {matches.length === 0 ? (
              <li className="muted">No members match “{q}”.</li>
            ) : (
              matches.map((match) => (
                <li key={match.cardId}>
                  <Link href={`/staff/stamp?c=${match.cardId}`}>
                    <strong>{match.name || "Guest"}</strong>
                    <span className="muted">{match.email}</span>
                    <span className="badge">{match.stamps} stamps</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </>
  );
}

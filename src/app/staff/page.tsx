import { Search } from "lucide-react";
import Link from "next/link";
import { ScanCardButton } from "@/components/staff/ScanCardButton";
import { initials } from "@/lib/format";
import { firstParam } from "@/server/request";
import { currentStaffDevice, searchMembers } from "@/server/services/staff";

/** Home screen of a paired till device: scan a card, or find a member by name or email. */
export default async function StaffHome({ searchParams }: PageProps<"/staff">) {
  const params = await searchParams;
  const paired = firstParam(params.paired);
  const device = await currentStaffDevice();

  if (!device) {
    return (
      <section className="till-message">
        {paired === "0" && <div className="notice notice-error">That pairing link has expired or was already used. Ask the owner for a new one.</div>}
        <h1>This isn&apos;t a staff device yet</h1>
        <p>
          The venue owner can pair it from their dashboard: <strong>Loyalty &amp; capture → Staff devices → Add a staff device</strong>, then open the link on this phone or tablet.
        </p>
      </section>
    );
  }

  const q = firstParam(params.q).slice(0, 80);
  const matches = q ? searchMembers(device, q) : [];

  return (
    <>
      {paired === "1" && <div className="notice notice-ok">This device is ready for stamping. Keep it at the till.</div>}
      <ScanCardButton variant="hero" />
      <p className="till-hint">Ask the guest to open their card and tap “Show to staff”.</p>

      <div className="till-divider">
        <span>or find a member</span>
      </div>
      <form className="till-search" action="/staff" role="search">
        <Search aria-hidden />
        <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Find a member by name or email" autoComplete="off" />
      </form>

      {q && (
        <section aria-label="Members found">
          <h2 className="till-label">Members</h2>
          <ul className="till-list">
            {matches.length === 0 ? (
              <li className="till-empty">No members match “{q}”.</li>
            ) : (
              matches.map((match) => (
                <li key={match.cardId}>
                  <Link href={`/staff/stamp?c=${match.cardId}`}>
                    <span className="till-avatar" aria-hidden>
                      {initials(match.name || match.email)}
                    </span>
                    <span className="till-list-text">
                      <strong>{match.name || "Guest"}</strong>
                      <span>{match.email}</span>
                    </span>
                    <span className="till-list-meta">
                      {match.stamps} stamp{match.stamps === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </>
  );
}

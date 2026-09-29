import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { DEMO_VENUES } from "@/server/seed";
import "@/styles/pages.css";

const DEMO_NOTES: Record<string, string> = {
  demo: "Stamp card with reward tiers, hosted menu, plain Wi-Fi, Sudoku",
  "demo-crm": "Dark pub theme, Wi-Fi email gate, marketing consent (18+), birthday ask",
  "demo-rewards": "Rewards-only membership, external ordering link, custom link cards",
};

export default function Home() {
  return (
    <main className="page-wrapper simple-page">
      <div className="home-brand">
        <BrandMark />
        <span>{BRAND.name}</span>
      </div>
      <h1 className="home-title">One QR code for everything your guests need at the table.</h1>
      <p className="home-lede">Menu, Wi-Fi, a loyalty card that lives in their wallet, and honest feedback that turns happy guests into Google reviews.</p>

      <h2 className="home-sub">Try a demo venue</h2>
      <ul className="demo-list">
        {DEMO_VENUES.map((venue) => (
          <li key={venue.id}>
            <a href={`/s?i=${venue.shortCode}&s=home`}>
              <strong>{venue.name}</strong>
              <span>{DEMO_NOTES[venue.shortCode] ?? venue.branding.tagline}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

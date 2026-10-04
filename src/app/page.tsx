import { Check, Gift, MessageSquareText, Palette, QrCode, Star, Users, UtensilsCrossed, Wifi } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { currentUser } from "@/server/auth/session";
import { DEMO_VENUES } from "@/server/seed";
import "@/styles/app.css";

const DEMO_NOTES: Record<string, string> = {
  demo: "Stamp card with reward tiers, hosted menu, Wi-Fi, Sudoku",
  "demo-crm": "Dark pub theme, Wi-Fi email gate, marketing consent, birthdays",
  "demo-rewards": "Members club, online ordering link, custom link cards",
};

const FEATURES = [
  { icon: UtensilsCrossed, title: "A menu you can change in seconds", text: "Prices, allergens, dietary tags and photos. Mark a dish sold out from your phone." },
  { icon: Wifi, title: "Wi-Fi without the questions", text: "Guests copy the password in one tap. Optionally ask for an email first." },
  { icon: Gift, title: "Loyalty that lives on their phone", text: "Digital stamp cards and reward tiers. No app to download, no paper cards to lose." },
  { icon: MessageSquareText, title: "Hear it first", text: "A private feedback box at every table, so small problems reach you while you can still fix them." },
  { icon: Star, title: "More Google reviews, by the rules", text: "Every guest is asked for a review at the table, so you get more reviews without breaking Google's policies." },
  { icon: Users, title: "A guest list you own", text: "Emails, birthdays and marketing consent, collected properly with double opt-in." },
  { icon: QrCode, title: "QR codes for every table", text: "Download print-ready codes and table cards. See which table scans the most." },
  { icon: Palette, title: "Looks like your place", text: "Your logo, cover photo and colours. Text stays readable on any background." },
];

export default async function Home() {
  const user = await currentUser();
  return (
    <div className="app">
      <header className="site-nav">
        <Link className="wordmark" href="/">
          <BrandMark />
          {BRAND.name}
        </Link>
        <nav>
          <a href="#pricing">Pricing</a>
          {user ? (
            <Link className="btn btn-primary" href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link className="btn btn-primary" href="/signup">
                Start free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="site-main">
        <section className="hero">
          <div>
            <h1>One QR code for everything your guests need at the table.</h1>
            <p className="lede">Menu, Wi-Fi, a loyalty card that lives on their phone, private feedback, and more Google reviews from the guests at your tables. Set it up yourself in ten minutes.</p>
            <div className="cta">
              <Link className="btn btn-primary" href={user ? "/dashboard" : "/signup"}>
                {user ? "Go to your dashboard" : "Create your page free"}
              </Link>
              <a className="btn" href="#demos">
                See live examples
              </a>
            </div>
            <p className="hero-note">Free forever plan · {TRIAL_DAYS}-day Pro trial · No card needed</p>
          </div>
          <div className="phone" aria-hidden>
            <iframe src="/s?i=demo&s=home&embed=1"title="Example venue page" loading="lazy" tabIndex={-1} />
          </div>
        </section>

        <h2 className="section-title">Everything on one page</h2>
        <p className="section-sub">Turn on what you need. Guests never download an app.</p>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card">
              <span className="feature-icon">
                <Icon aria-hidden />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>

        <h2 className="section-title">Live in three steps</h2>
        <p className="section-sub">No designer, no developer, no waiting on us.</p>
        <ol className="steps">
          <li className="card">
            <strong>Sign up and answer four questions</strong>
            <span>Name, colours, Wi-Fi, Google review link. Your page is created instantly.</span>
          </li>
          <li className="card">
            <strong>Add your menu and logo</strong>
            <span>Edit everything from the dashboard and watch the preview update.</span>
          </li>
          <li className="card">
            <strong>Print your QR codes</strong>
            <span>Download table cards, pop them on tables and watch the scans come in.</span>
          </li>
        </ol>

        <h2 className="section-title" id="pricing">
          Simple pricing
        </h2>
        <p className="section-sub">Per venue. Cancel any time and keep the Free plan.</p>
        <div className="pricing">
          {PLANS.map((plan) => (
            <section key={plan.id} className={`card price-card ${plan.id === "pro" ? "featured" : ""}`}>
              <h3>{plan.name}</h3>
              <div className="price">{plan.price}</div>
              <p className="muted">{plan.blurb}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check aria-hidden /> {feature}
                  </li>
                ))}
              </ul>
              <Link className={`btn btn-block ${plan.id === "pro" ? "btn-primary" : ""}`} href={user ? "/dashboard" : "/signup"}>
                {plan.id === "pro" ? `Start ${TRIAL_DAYS}-day trial` : "Start free"}
              </Link>
            </section>
          ))}
        </div>

        <h2 className="section-title" id="demos">
          Try a demo venue
        </h2>
        <p className="section-sub">Open one on your phone. This is exactly what your guests see.</p>
        <div className="demo-strip">
          {DEMO_VENUES.map((venue) => (
            <a key={venue.id} className="card" href={`/s?i=${venue.shortCode}&s=home`}>
              <strong>{venue.name}</strong>
              <span>{DEMO_NOTES[venue.shortCode] ?? venue.branding.tagline}</span>
            </a>
          ))}
        </div>
      </main>

      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {BRAND.name}
        </span>
        <nav>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}

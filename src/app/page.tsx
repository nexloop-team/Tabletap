import { Check, Heart, MessageCircle, Palette, QrCode, Star, Users, BookOpen, Wifi } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { BILLING_PERIOD, formatInr, GST_RATE, PLAN_FEATURES, PRICE_INR, PRICE_WITH_GST_INR, TRIAL_DAYS } from "@/lib/plans";
import { isLightColor } from "@/lib/theme";
import { currentUser } from "@/server/auth/session";
import { uiFont } from "@/app/fonts";
import { DEMO_VENUES } from "@/server/seed";
import "@/styles/app.css";

const DEMO_NOTES: Record<string, string> = {
  demo: "Café · stamp card, menu, Sudoku",
  "demo-crm": "Pub · Wi-Fi email gate, birthdays",
  "demo-rewards": "Bakery · members club, order online",
};

const FEATURES = [
  { icon: BookOpen, title: "Your menu, with allergens", text: "Search, the UK 14 allergens and dietary tags. Or link to the menu you already have." },
  { icon: Wifi, title: "Wi-Fi without the questions", text: "Network and password, one tap to copy. Optionally ask for an email first." },
  { icon: Heart, title: "A stamp card on their phone", text: "Staff stamp it at the till. No paper cards, no app to download." },
  { icon: MessageCircle, title: "Hear it first", text: "A private feedback box, so problems reach you before they reach the internet." },
  { icon: Star, title: "More Google reviews", text: "Every guest gets a friendly nudge to review you on Google." },
  { icon: Users, title: "A guest list you own", text: "Names, emails and birthdays, with consent done properly. Export any time." },
  { icon: QrCode, title: "QR codes for every table", text: "Print-ready table cards. See which tables get scanned most." },
  { icon: Palette, title: "Looks like your place", text: "Your colours, logo and cover photo. No one else's logo on your page." },
];

const STEPS = [
  { title: "Sign up and answer four questions", text: "Your venue, your colours, your Wi-Fi and your Google review link." },
  { title: "Add your menu and logo", text: "Type it in, or snap a photo of your printed menu and we'll read it for you." },
  { title: "Print your QR codes", text: "A sheet of table cards, one per table, so you can see which ones get scanned." },
];

export default async function Home() {
  const user = await currentUser();
  const startHref = user ? "/dashboard" : "/signup";
  return (
    <div className={`app mk ${uiFont.variable}`}>
      <header className="site-nav">
        <Link className="wordmark" href="/">
          <BrandMark />
          {BRAND.name}
        </Link>
        <nav aria-label="Main">
          <a href="#pricing">Pricing</a>
          {user ? (
            <Link className="mk-btn mk-btn-ink" href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link className="mk-btn mk-btn-ink" href="/signup">
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mk-wrap hero">
          <div className="hero-copy">
            <span className="mk-eyebrow">For independent cafés, pubs and bakeries</span>
            <h1>One QR code for everything your guests need at the table.</h1>
            <p className="lede">Menu, Wi-Fi, a stamp card and a private feedback box on one page that looks like your place. Set it up yourself in ten minutes. No designer, no developer, no waiting on us.</p>
            <div className="cta">
              <Link className="mk-btn mk-btn-lg mk-btn-accent" href={startHref}>
                {user ? "Go to your dashboard" : "Start your free trial"}
              </Link>
              <a className="mk-btn mk-btn-lg mk-btn-outline" href="#demos">
                See live examples
              </a>
            </div>
            <p className="hero-note">{TRIAL_DAYS}-day free trial · No card needed · {formatInr(PRICE_INR)} a year after that</p>
          </div>
          <div className="phone" aria-hidden>
            <div className="phone-screen">
              <iframe src="/s?i=demo&s=home&embed=1" title="Example venue page" loading="lazy" tabIndex={-1} />
            </div>
          </div>
        </section>

        <section className="mk-band">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2>Everything on one page</h2>
              <p>Guests scan, tap and get on with their coffee. You get regulars, reviews and the odd quiet word before it becomes a public one.</p>
            </div>
            <div className="feature-grid">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="feature">
                  <span className="feature-icon">
                    <Icon aria-hidden />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-section">
          <h2>Live in three steps</h2>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="step-num" aria-hidden>
                  {i + 1}
                </span>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mk-band" id="pricing">
          <div className="mk-wrap mk-narrow">
            <div className="mk-head mk-center">
              <h2>One plan. Everything included.</h2>
              <p>Try every feature free for {TRIAL_DAYS} days, no card needed. Then one yearly payment per venue.</p>
            </div>
            <div className="pricing pricing-single">
              <section className="price-card featured">
                <div className="price-top">
                  <h3>{BRAND.name}</h3>
                  <span className="price-flag">{TRIAL_DAYS} days free</span>
                </div>
                <div>
                  <div className="price">
                    {formatInr(PRICE_INR)}
                    <span> / {BILLING_PERIOD} per venue</span>
                  </div>
                  <p className="price-gst">
                    + {GST_RATE * 100}% GST ({formatInr(PRICE_WITH_GST_INR)} in total)
                  </p>
                </div>
                <ul>
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden /> {feature}
                    </li>
                  ))}
                </ul>
                <Link className="mk-btn mk-btn-lg mk-btn-light" href={startHref}>
                  Start your free trial
                </Link>
              </section>
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-section" id="demos">
          <h2>Try a demo venue</h2>
          <div className="demo-strip">
            {DEMO_VENUES.map((venue) => {
              const bg = venue.branding.backgroundColorHex || "#FFFFFF";
              const light = isLightColor(bg);
              return (
                <a key={venue.id} className={`demo-card ${light ? "is-light" : "is-dark"}`} style={{ background: bg }} href={`/s?i=${venue.shortCode}&s=home`}>
                  {venue.branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="demo-logo" src={venue.branding.logoUrl} alt="" width={56} height={56} />
                  ) : (
                    <span className="demo-logo" />
                  )}
                  <span className="demo-name">
                    <strong>{venue.name}</strong>
                    <span>{venue.branding.tagline}</span>
                  </span>
                  <span className="demo-note">{DEMO_NOTES[venue.shortCode] ?? "Open the demo"} →</span>
                </a>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="mk-wrap">
          <span>
            © {new Date().getFullYear()} {BRAND.name} · Made for independent hospitality
          </span>
          <nav aria-label="Footer">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

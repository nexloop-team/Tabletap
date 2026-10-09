import { ArrowRight, BookOpen, Check, Heart, MessageCircle, Palette, Printer, Star, Users, Wifi } from "lucide-react";
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
  demo: "Stamp card, menu with photos, Sudoku",
  "demo-crm": "Dark venue, Wi-Fi email gate, pub menu",
  "demo-rewards": "Members club, order online, colours from the logo",
};

const FEATURES = [
  { icon: BookOpen, tint: "orange", title: "A menu that's always right", text: "Change a price in seconds. Photos, allergens and today's specials included." },
  { icon: Wifi, tint: "green", title: "Wi-Fi without the questions", text: "Guests copy the password in one tap. Ask for an email first if you like." },
  { icon: Heart, tint: "rose", title: "A stamp card nobody loses", text: "Digital stamps, rewards and birthday treats. Staff stamp from any phone." },
  { icon: MessageCircle, tint: "blue", title: "Hear it first", text: "Guests tell you what went wrong in private, before it becomes a public review." },
  { icon: Star, tint: "amber", title: "More Google reviews", text: "Every guest gets a friendly invite to review you, the way Google allows." },
  { icon: Users, tint: "purple", title: "Know your regulars", text: "See who visits and how often. Export your guest list whenever you need it." },
  { icon: Printer, tint: "teal", title: "Print and you're done", text: "Table cards print at home. See which tables scan the most." },
  { icon: Palette, tint: "clay", title: "Looks like your place", text: "Your colour, your logo, your fonts. No Tabletap logo on your page." },
];

const STEPS = [
  { title: "Sign up and answer four questions", text: "Your venue's name, a colour, the Wi-Fi and a reward. Your page is live straight after." },
  { title: "Add your menu and logo", text: "Type it in, or take a photo of your printed menu and we'll read it for you." },
  { title: "Print your QR codes", text: "Table cards print on any home printer. Put one on every table and you're done." },
];

const REASONS = [
  { title: "No card for the trial.", text: "Try everything for 7 days first." },
  { title: "Pay your way.", text: "UPI, cards or netbanking, through Razorpay." },
  { title: "Nothing is ever lost.", text: "If you stop paying, your page pauses and comes back exactly as it was." },
];

const FAQS = [
  {
    q: "Do guests need to download an app?",
    a: "No. They scan the code with their phone camera and the page opens straight away. No app, no sign-up, and it loads quickly even on a slow 4G connection.",
  },
  {
    q: "What happens after the 7-day trial?",
    a: "Subscribe to keep your page live. If you don't, it pauses and guests see a friendly “back soon” page. Your menu, guests and stamp cards stay safe, and everything comes back the moment you subscribe.",
  },
  { q: "How do I pay?", a: "Through Razorpay, with UPI, a card or netbanking. It's ₹1,178.82 a year including 18% GST, for each venue." },
  {
    q: "I run two cafés. Do I need two plans?",
    a: "Each venue has its own page, QR codes and stamp card, and its own ₹999 yearly subscription. You manage them all from one login.",
  },
  {
    q: "Can my staff stamp cards without seeing my dashboard?",
    a: "Yes. Give them their own staff login, or pair the counter phone or tablet once. Staff can only open the till.",
  },
  {
    q: "Can I change things after I've printed my QR codes?",
    a: "Yes, anything: your menu, colours, Wi-Fi, rewards. The codes point to your page, so the same printed cards always show the latest version.",
  },
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
            <span className="mk-eyebrow mk-pill">
              <span className="mk-dot" aria-hidden /> For cafés, pubs, bakeries and small restaurants
            </span>
            <h1>One QR code for everything your guests need at the table.</h1>
            <p className="lede">Your menu, the Wi-Fi password, a stamp card and a private feedback box, on one page that looks like your place. Set it up yourself in ten minutes.</p>
            <div className="cta">
              <Link className="mk-btn mk-btn-lg mk-btn-accent" href={startHref}>
                {user ? "Go to your dashboard" : "Start your free trial"} <ArrowRight aria-hidden />
              </Link>
              <a className="mk-btn mk-btn-lg mk-btn-outline" href="#demos">
                See live examples
              </a>
            </div>
            <ul className="hero-note">
              <li>
                <Check aria-hidden /> {TRIAL_DAYS}-day free trial
              </li>
              <li>
                <Check aria-hidden /> No card needed
              </li>
              <li>
                <Check aria-hidden /> {formatInr(PRICE_INR)} a year after that
              </li>
            </ul>
          </div>
          <div className="hero-visual" aria-hidden>
            <div className="phone">
              <div className="phone-screen">
                <iframe src="/s?i=demo&s=home&embed=1" title="Example venue page" loading="lazy" tabIndex={-1} />
              </div>
            </div>
            <div className="hero-chip hero-chip-top">
              <span className="hero-chip-icon ok">
                <Check />
              </span>
              <span>
                <strong>Password copied</strong>
                No more asking at the counter
              </span>
            </div>
            <div className="hero-chip hero-chip-bottom">
              <span className="hero-chip-icon rose">
                <Heart fill="currentColor" />
              </span>
              <span>
                <strong>Stamp added · 6 of 8</strong>
                Two more for a free coffee
              </span>
            </div>
          </div>
        </section>

        <section className="mk-band">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2>Everything on one page</h2>
              <p>Guests get what they came for in a tap. You get regulars, reviews and the full picture.</p>
            </div>
            <div className="feature-grid">
              {FEATURES.map(({ icon: Icon, tint, title, text }) => (
                <div key={title} className="feature">
                  <span className={`feature-icon tint-${tint}`}>
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
          <div className="mk-wrap pricing-split">
            <div className="pricing-copy">
              <h2>One plan. Everything included.</h2>
              <p className="lede">No tiers, no add-ons, no surprises. About ₹3 a day for each venue.</p>
              <ul className="pricing-reasons">
                {REASONS.map((reason) => (
                  <li key={reason.title}>
                    <Check aria-hidden />
                    <span>
                      <strong>{reason.title}</strong> {reason.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pricing pricing-single">
              <section className="price-card featured">
                <div className="price-top">
                  <h3>Per venue</h3>
                  <span className="price-flag">{TRIAL_DAYS} days free</span>
                </div>
                <div>
                  <div className="price">
                    {formatInr(PRICE_INR)}
                    <span> / {BILLING_PERIOD}</span>
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
          <p className="mk-sub">Open one on your phone. It&apos;s exactly what your guests would see.</p>
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
                  <span className="demo-note">{DEMO_NOTES[venue.shortCode] ?? ""}</span>
                  <span className="demo-open">Open demo →</span>
                </a>
              );
            })}
          </div>
        </section>
        <section className="mk-band" id="faq">
          <div className="mk-wrap mk-narrow">
            <h2>Questions owners ask</h2>
            <div className="faq-list">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-cta-band">
          <h2>Your tables are ready when you are.</h2>
          <p>
            {TRIAL_DAYS} days free, no card needed. {formatInr(PRICE_INR)} a year after that.
          </p>
          <Link className="mk-btn mk-btn-lg mk-btn-light" href={startHref}>
            {user ? "Go to your dashboard" : "Start your free trial"} <ArrowRight aria-hidden />
          </Link>
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

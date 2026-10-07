# Tabletap roadmap

The working plan for Tabletap: what's done, what's next, why things were decided, and a log of every change.

**How to use this file**

- Tick a box (`- [x]`) when something is done, and add a line to the [Change log](#change-log).
- New idea? Put it in [Ideas parking lot](#ideas-parking-lot) first and move it into a section once you decide to do it.
- Changing a big decision (market, price, hosting)? Add it to the [Decisions](#decisions) table with the reason.

_Last updated: 2026-10-08_

---

## Where things stand

**Built**
- Guest page: menu, Wi-Fi, loyalty card, feedback, Google review link, Sudoku. Three demo venues.
- Self-serve owner side: signup/login, email verification, password reset, 4-step onboarding, dashboard (overview, guest page editor, menu editor, loyalty, guests, feedback, QR codes and print sheet, billing, settings), account deletion.
- One yearly plan per venue (₹999 + GST), 7-day free trial, Razorpay billing (dev mode without keys); unpaid venues go offline.
- Admin panel (`/admin`) for suspending venues and comping Pro.

- Staff stamping at the till, refer-a-friend, automatic guest emails, weekly owner digest.
- AI menu import and "What's this dish?" explanations; announcement banner; specials and badges on the menu.

**Not done yet**
- The code is **not committed to git** yet.
- Not deployed.
- No paying customers.

---

## 1. Before the first customer: product fixes

These are must-haves. Without them the product is not ready to demo or sell.

- [x] **Staff stamp & redeem mode:** paired till devices scan the guest's card QR (or search by name/email), add stamps, redeem rewards, undo; with a cooldown against double stamping.
- [x] **Follow Google's review rules:** every guest is offered the Google review after feedback; copy updated.
- [x] **Monday summary email** for owners (scans, guests, stamps, rewards, feedback), with an on/off switch per venue.
- [ ] Instant email when unhappy feedback arrives (deferred by decision on 2026-10-04).
- [x] **Captcha on signup** (Cloudflare Turnstile). Off until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are set.
- [x] **Pin the Node version** (`>=22.5`).
- [x] **Commit all code to git** (branch `redesign-and-customisation`; not pushed yet).
- [x] **Security patch:** Next.js 16.3.8 (September 2026 security release).

---

## 2. Launch setup: business and operations

- [ ] Decide the brand name and buy the domain (`.com` or `.co.uk`).
- [ ] Set up a professional email address (Google Workspace or similar) and a UK virtual phone number.
- [ ] **Deploy on Railway** (or Render, Fly.io or a VPS):
  - [ ] Connect the GitHub repo.
  - [ ] Add a volume mounted at `/data` and set `DATA_DIR=/data`.
  - [ ] Set `APP_URL` to the final domain. It's printed into every QR code, so **never change it afterwards**.
  - [ ] Set `ADMIN_EMAILS` to your own email.
  - [ ] Point your domain's DNS at Railway.
- [ ] **Email:** create a Resend account, verify your sending domain, then set `RESEND_API_KEY` and `MAIL_FROM`.
- [ ] **Payments:**
  - [x] Razorpay Subscriptions (India, rupees).
  - [ ] Create the yearly plan (₹1,178.82 = ₹999 + 18% GST) and API keys.
  - [ ] Add the webhook at `/api/billing/webhook` for `subscription.*` events.
  - [ ] Add your GSTIN in Razorpay so it issues GST invoices.
  - [ ] Test the whole flow in test mode first.
- [ ] **Backups** of `/data`, using Railway volume snapshots or Litestream. Test restoring once.
- [ ] **Monitoring:** Sentry for errors, plus an uptime check (e.g. UptimeRobot).
- [ ] **Legal:**
  - [ ] Get a lawyer to review `/terms` and `/privacy`.
  - [ ] Register for data protection in your country (e.g. the ICO in the UK).
  - [ ] Register the business.
- [x] Set the price: ₹999 + GST a year per venue (`src/lib/plans.ts`).

---

## 3. Getting customers (UK first)

- [ ] Pick the first city (suggested: Manchester, Bristol, Leeds or Brighton).
- [ ] Build a list of about 300 cafés from Google Maps, with review counts, Instagram and email.
- [ ] Write the scripts: Instagram DM, cold email, follow-up, and a 2-minute Loom demo.
- [ ] Outreach routine: 20–30 personalised messages a day, each with a demo page built for that café.
- [ ] Launch offer: free setup plus 3 months half price for the first 20 cafés, in return for a testimonial.
- [ ] Approach 3–5 partners (coffee roasters, equipment suppliers, POS resellers) with 20–30% recurring commission.
- [ ] **Goal: 10 paying cafés within 60 days.**
- [ ] Write 2 case studies from real numbers (scans, reviews, members).

---

## 4. Next: features that win deals

- [ ] **Apple & Google Wallet cards** with live-updating stamps. Apple needs a $99/year developer account; Google Wallet is free.
- [x] **AI menu import:** photo or PDF, then draft sections, with AI-suggested allergens flagged for the owner to check. Needs `ANTHROPIC_API_KEY`.
- [x] **"What's this dish?":** ⓘ button on unusual dishes; AI drafts, the owner approves.
- [x] **Automatic guest emails:** "your reward is ready", birthday treat, "we miss you" (marketing ones only to opted-in guests, with one-click unsubscribe).
- [x] **Announcement banner** (specials, events), with an optional end date.
- [ ] Opening hours, address and phone card (deferred by decision on 2026-10-04).
- [x] **Easier-to-read menu:** Popular / New / Spicy / Chef's pick badges, "Today's specials" strip, bigger text, photos first on phones.

## 5. Later: once you have customers

- [x] Staff logins (stamping only, no access to billing or guest data).
- [ ] Printable menu PDF generated from the same menu data.
- [ ] Automatic menu translation for tourists.
- [ ] Import name, logo, hours and review link from the Google Business Profile at signup.
- [x] Refer-a-friend: invite link on the member's card, welcome stamps for the friend, and bonus stamps for the inviter after the friend's first real visit (max 5 a month).
- [ ] Simple email campaigns to opted-in guests.
- [ ] Custom domains per café (e.g. `menu.cafename.com`).
- [ ] Annual billing (2 months free).

---

## 6. New markets

**US** (after about 10 UK testimonials)
- [ ] Pricing in $ (suggested $29/month).
- [ ] US allergen list (the 9 major allergens) alongside the UK's 14.
- [ ] Yelp link alongside Google reviews.
- [ ] Listing on the Square App Marketplace / Toast integrations.
- [ ] Sales tax handling (Paddle or Stripe Tax).

**India** (only if selling in person)
- [ ] WhatsApp messages instead of email for guests (WhatsApp Business API).
- [ ] Razorpay with UPI Autopay.
- [ ] ₹ pricing (suggested ₹999 + 18% GST) and GST invoices.
- [ ] Hindi and regional languages on the guest page.

**Europe**
- [ ] Translations (NL, DE, ES, FR).
- [ ] € pricing.
- [ ] Stricter cold-email rules (Germany needs consent first).

---

## 7. When to upgrade the tech

Do these when there's a reason, not before.

| Trigger | Change |
|---|---|
| About 1,000 venues, need for more than one server, or wanting Vercel | Move SQLite to Postgres (e.g. Neon); the repositories in `src/server/repositories` are the only code that touches SQL |
| Moving to Vercel or several servers | Uploads to Cloudflare R2 or Vercel Blob; rate limiting to Redis (Upstash) |
| Emails over 3,000/month or 100/day | Resend Pro ($20/month) |
| Cafés asking for staff accounts | Roles in `venue_members` (the table already has a `role` column) |

---

## 8. Numbers to watch

| Metric | What it tells you | Target |
|---|---|---|
| Paying cafés and monthly revenue | Is the business growing? | 10 in 60 days, 55 to replace about ₹1 lakh/month |
| Activation: first scan within 7 days of signup | Is onboarding working? | 70% or more |
| Trial → paid conversion | Is Pro worth paying for? | 25% or more |
| Monthly cancellations (churn) | Are customers happy? | Under 3% |
| Scans per café per week | Are guests actually using it? | Rising each month |

---

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-01 | SQLite on one server, not Postgres on Vercel | Simpler and cheaper to start; no external database to set up; easy to move later |
| 2026-10-01 | Own login code (scrypt and database sessions), not an auth service | No extra cost or dependency; fully tested |
| 2026-10-01 | Billing per venue, Free and Pro plans, 14-day Pro trial with no card | Matches how cafés think ("per shop") and lowers the barrier to trying it |
| 2026-10-02 | UK first at £19/month, then US at $29, India at ₹999 + GST only with WhatsApp | The UK pays about 2.5 times more per café and the product already fits it |
| 2026-10-07 | Owner layout: presets plus per-card controls, no page builder | Keeps every guest page fast and readable on any colour; café owners want a few good choices, not a blank canvas |
| 2026-10-07 | Hide/rename/reorder cards and the new menu look on every plan; layout presets, header styles and button shapes Pro only | Basic control shouldn't be paywalled; layouts are a visible reason to upgrade |

---

## Ideas parking lot

Ideas not yet decided. Move them into a section above when you commit to them.

- Tap-to-stamp NFC stickers at the till
- "Order at table" / pay at table
- Table-specific QR codes that call staff ("Request the bill")
- Integration with POS systems (Square, Toast, Petpooja) to stamp automatically on payment

---

## Change log

Newest first. One line per change: what changed and why.

**Template**

```
### YYYY-MM-DD
- Added / Changed / Fixed: what, and why
```

### 2026-10-08 (later)
- Changed: one plan instead of Free and Pro: ₹999 + 18% GST a year per venue, every feature included, 7-day free trial with no card. Pro markers and upgrade hints are gone.
- Changed: when a venue has no paid subscription and no trial left, its guest page goes offline; the owner can still sign in and subscribe, and the page comes back as it was.
- Changed: billing moved from Stripe to Razorpay Subscriptions (Checkout pop-up, signed webhook, cancel at the end of the paid year).
- Removed: the "Powered by" footer on guest pages and menus.
- Added (admin): Paying / Trial / Unpaid / Free access / Suspended filters, "Extend trial by 7 days", "Give free access", and a revenue panel (yearly and monthly recurring, churn, won't-renew, failing payments).

### 2026-10-08
- Added: "Changes saved" toasts with Undo (restores the version before the last save; undo twice to redo).
- Changed: the trial countdown and "confirm your email" share one slim bar; the email reminder can be snoozed for a day.
- Added: "How do I…?" help for the Google review link, pairing a till and printing at 100%, plus "Help & contact" in the sidebar (`NEXT_PUBLIC_SUPPORT_EMAIL`).
- Added: setup checklist links open the exact card and highlight it; full-screen "Preview" on phones; loading placeholders for dashboard pages.
- Added: social fields accept @handles.
- Added: English / Español switch on the guest page and menu (`tt_lang` cookie).
- Changed: the owner's own preview always shows "Suggestion box" (outside the label A/B test), and the editor explains the test.
- Added: staff logins. Owners invite by email; staff sign in (or sign up) and can only open the till. The till shows recent stamps and rewards.
- Added (admin): scans in the last 7 days and last scan per venue; "View as owner" is now read-only.
- Fixed: dashboard pages scrolled sideways on phones.

### 2026-10-07
- Changed: full redesign to the Claude Design mockups (brand, marketing home, guest page, menu, dashboard, editors, onboarding, staff till, A4 table cards).
- Added: owners can hide any card, rename cards in their own words, and drag to reorder cards and menu items (keyboard arrows work too).
- Changed: the hosted menu now shows the venue's cover, logo and font; dishes are rows with photo thumbnails inside one card per section; coloured badges; tap a dish for a detail sheet; a "Most popular" strip when nothing is marked special; optional section descriptions.
- Changed: demo venues refresh from code on every start, with dish illustrations, badges, specials and explainers.
- Fixed: dashboard switches ignored clicks (the drawn track sat above the checkbox).
- Fixed: ngrok tunnels can load the dev server's scripts (`allowedDevOrigins`).
- Security: Next.js 16.3.8.
- Added (Pro): layout presets. Guest page cards as List, Grid (two tiles per row) or Compact; header with logo beside the name, centred, or no logo; Rounded, Pill or Square corners. Menus as List, Photo cards or Classic (printed-menu look with dotted leaders). Free venues keep their choice saved but see the defaults until they upgrade.

### 2026-10-04 (later)
- Added: Groq as the AI provider (`GROQ_API_KEY`), using gpt-oss for dish notes and Qwen for menu photos, with strict JSON schemas. Photos are shrunk in the browser before upload. Claude remains an option.
- Changed: the guest's card now shows on the venue's own page ("Your rewards card") instead of a separate page. After joining, the card appears in place, and the phone remembers it. Opening the emailed link also teaches the phone the card.
- Changed: a returning member who types their email again sees their card straight away, instead of "already a member" (owner's decision).
- Added: a **Scan a card** button on the staff screens that uses the camera inside the page, plus "Scan the next card" after stamping.

### 2026-10-04
- Added: staff stamping. Owners pair till phones/tablets with a one-time link; guests tap "Show to staff" on their card; staff scan, stamp, redeem and undo. There's a cooldown against double stamps, and every change is recorded in a stamp ledger. The guest's card updates live.
- Fixed: the Google review link is now offered to every guest after feedback (Google bans asking only happy guests). Marketing copy updated.
- Added: Monday summary email for owners, a background job runner (hourly, never repeats work) and `POST /api/cron/run` for external schedulers.
- Added: AI menu import (photo/PDF) and "What's this dish?" notes, both drafts the owner approves. Pro only, daily quota, off without `ANTHROPIC_API_KEY`.
- Added: announcement banner with an end date; menu badges, a specials strip, bigger text, photos first on phones.
- Added: automatic guest emails (reward ready, birthday, we miss you) with one-click unsubscribe, and refer-a-friend with abuse limits.
- Added: optional Turnstile captcha on sign-up and password reset; Node version pinned; an "email confirmed" notice in onboarding; login returns you to the page you were on after a session expires.
- Fixed: a stats object from the database couldn't be sent to the Loyalty page (found in browser testing).
- Tests: 70 unit tests and 37 browser checks pass.

### 2026-10-03
- Fixed: no scrollbar inside the phone frames (home page and dashboard preview). Guest pages accept `?embed=1`, which hides the scrollbar but keeps scrolling.
- Fixed (security): when `APP_URL` is set, email links and the cross-origin check always use it instead of request headers. Before, a forged header could make password-reset emails link to another site. This was also needed to run behind ngrok.
- Added: ngrok installed for sharing a live preview from this computer.

### 2026-10-02
- Added: this roadmap file.
- Fixed: the database now adds new tables automatically after a code change, so the dev server no longer needs a restart (sign-up was failing with "no such table: users").

### 2026-10-01
- Added: the self-serve owner side (accounts, onboarding wizard, dashboard and editors, QR codes and print sheet, guests, feedback, Free/Pro plans with Stripe and dev mode, admin panel, marketing home page, terms page).
- Added: 25 new tests for the owner side, bringing the total to 52, plus an end-to-end check in Chrome.

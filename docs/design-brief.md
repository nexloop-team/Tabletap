# Tabletap — design brief

Context for designing Tabletap's UI. It covers what the product is, who uses it, every screen, the current design system, and the constraints a design has to respect so it can be built in the existing code.

---

## 1. The product in one paragraph

Tabletap is a self-serve SaaS for independent hospitality venues (cafés first, also pubs, bars, bakeries, small restaurants), launching in the UK. An owner signs up, answers four onboarding questions and gets a **guest page** plus **printable QR codes** for their tables. A guest scans the QR code at the table and lands on a mobile web page (no app download) with the venue's menu, Wi-Fi, a digital loyalty stamp card, a private feedback box with a Google review invitation, custom links, and a Sudoku to pass the time. Owners manage everything from a **dashboard** and pay per venue for Pro features.

**Positioning:** "One QR code for everything your guests need at the table." Set up yourself in ten minutes; no designer, no developer, no waiting on us.

**Pricing:** Free plan forever; Pro is £19 / month per venue, with a 14-day Pro trial and no card needed.

---

## 2. Who uses it

| User | Context | What they care about |
|---|---|---|
| **Guest** | Sitting at a table, on their own phone, often one-handed, just scanned a QR code. Might be in a dim pub or a bright café. Zero patience, has never heard of Tabletap. | Get the Wi-Fi password, see the menu and allergens, collect a stamp. Fast, obvious, no sign-up friction. |
| **Venue owner / manager** | Small independent business owner, not technical, often on their phone between customers, sometimes on a laptop after closing. | Looks like *their* place, easy to update the menu, more regulars, more Google reviews, hearing about problems privately before they become public reviews. |
| **Staff at the till** | A paired phone or tablet behind the counter during a rush. | Scan a guest's card, add a stamp, redeem a reward, undo a mistake, in seconds. |
| **Platform admin (me)** | Operator view. | See all accounts and venues, suspend, comp Pro. |

---

## 3. The four surfaces

There are four visually distinct surfaces. They intentionally do **not** share a single look.

### A. Guest page (`/s?i=<venue>`): the most important surface
- Mobile-first, single column, **max-width 500px**, centred on desktop.
- **Themed per venue:** the owner picks a background colour, and everything else is derived from it so text stays readable on any colour (see §5.2). It must look like the venue's own page, not like Tabletap.
- Uses the **system font stack** (SF Pro on iPhone), not a web font, so it loads instantly on a table-side 4G connection. Pro venues can choose a typography preset (Classic, Editorial or Modern).
- Feel: iOS-native, calm, tappable, like an Apple App Clip or a nicely made link-in-bio page.

### B. Hosted menu (`/menu?i=<venue>`)
- Same venue theme as the guest page. A long, scrollable menu that is pleasant to browse at the table.

### C. Merchant app: marketing site, auth, onboarding, dashboard, admin
- Tabletap's own brand: a cool slate neutral palette with **one brand colour, deep green `#1F6F5C`**. Font: **Inter**. Supports light and dark mode (follows the OS).
- Feel: modern, trustworthy B2B SaaS (Linear, Stripe or Square Dashboard territory), but warm and simple enough for a café owner who isn't technical.

### D. Staff till screens (`/staff`)
- Merchant styling, but optimised for speed: big tap targets and camera scanning.

---

## 4. Every screen and what is on it

### 4.1 Guest page: `/s?i=<code>`

**Header**
- Optional full-bleed **cover image** (200px tall).
- Circular **logo** (100px, overlaps the cover by about 55px, with a ring in the page colour and a soft shadow).
- **Venue name** (22px) and **tagline** (15px). Name and tagline sit beside the logo; they are centred if there is no logo.
- Optional **announcement banner** below the header (e.g. "Pumpkin spice is back today"), with an end date.

**Feature cards:** a vertical list of rounded cards (16px radius, soft shadow, 14–16px padding). Each has a 44px tinted **icon circle**, a 15px label and a chevron. The owner chooses the order. Tapping a card either **expands an inline sheet** (animated height) or navigates away.

| Card | Icon tint | Behaviour |
|---|---|---|
| **Loyalty / Stamp card** ("Your rewards card" once joined) | Rose `#D94D66`, filled heart | Expands: join form (name, email, optional birthday and marketing consent) → shows the digital stamp card: stamp grid, reward tiers, "Show to staff" QR, invite-a-friend link. Rewards-only venues show a members-club join instead of stamps. |
| **Menu** (or "Order online", "Book now", "Price list", or the owner's own label) | Orange `#FF9500` | Goes to the hosted menu or an external URL. |
| **Wi-Fi** | Green `#4DC778` | Expands: network name and password with one-tap copy. Optional **email gate** first (Pro). |
| **Feedback / Suggestion box** | Blue `#1447E6` | Expands: textarea with optional photo attach → thank-you → **every guest** is invited to leave a Google review (Google's rules forbid asking only happy guests). May offer "join and get a free stamp". An A/B test switches the label between "Suggestion box" and "Anonymous feedback". |
| **Google review** | — | Link out to the venue's Google review page. |
| **Custom links** | Purple `#9C27B0` | The owner's own links (website, booking, etc.) with chosen icons. |
| **Sudoku** | Purple `#7D59D9` accent | Expands into a playable Sudoku grid. |

**Footer**
- Social icon row (Google, Facebook, Instagram, TripAdvisor, YouTube).
- "Powered by Tabletap" footer, which Pro venues can hide.

**States to design:** loading, venue not found or suspended, form errors, success and confirmation ("check your inbox to confirm"), a returning member who sees their card immediately, and disabled buttons while busy.

**Languages:** English and Spanish (copy lengths vary).

### 4.2 Hosted menu: `/menu?i=<code>`
- Welcome text, a **search** field, a sticky **section jump bar** (chips/tabs), and an **allergen filter** (UK 14 allergens) plus dietary filters (vegan, vegetarian…).
- **"Today's specials"** horizontal strip.
- Items show name, description, price (£), optional photo (photos first on phones), dietary tags, allergens, optional kcal, badges (**Popular, New, Spicy, Chef's pick**) and a "sold out" state.
- An ⓘ **"What's this?"** button on unfamiliar dishes, which expands a short explainer.

### 4.3 Member web card: `/card/<id>`
The guest's loyalty card, also linked from their email: stamps, reward progress, a QR code for staff to scan, and an invite-a-friend link. It updates live when staff stamp it.

### 4.4 Marketing site: `/`
- **Top nav:** wordmark, Pricing, Sign in, **Start free**.
- **Hero:** "One QR code for everything your guests need at the table." Lede, two CTAs ("Create your page free" and "See live examples"), the note "Free forever plan · 14-day Pro trial · No card needed", and a **phone mockup** with the live demo guest page embedded.
- **"Everything on one page":** 8 feature cards (menu, Wi-Fi, loyalty, private feedback, Google reviews, guest list, QR codes, branding).
- **"Live in three steps":** sign up and answer four questions → add your menu and logo → print your QR codes.
- **Pricing:** Free vs Pro cards, with Pro highlighted.
- **"Try a demo venue":** three demo venues (see §6).
- **Footer:** Terms, Privacy, Sign in.

### 4.5 Auth
Sign up, Log in, Forgot password, Reset password. A centred card on a plain background, with an optional Cloudflare Turnstile captcha.

### 4.6 Onboarding wizard: `/onboarding`
Four steps with a progress bar: **venue name and type** → **colours** (swatches and a custom colour) → **Wi-Fi** → **Google review link**. Then the page is created instantly.

### 4.7 Dashboard: `/dashboard/<venue>`
**Shell:** left sidebar (it collapses into a drawer on mobile, behind a top bar with a menu button) containing a venue switcher, grouped navigation, Account and Sign out.

```
Overview
GUEST EXPERIENCE
  Guest page        (design editor)
  Menu
  Loyalty & capture  [PRO]
  QR codes
INSIGHTS
  Guests
  Feedback
VENUE
  Plan & billing
  Settings
─────
My venues · Platform admin (admins only) · Account · Sign out
```

| Screen | Content |
|---|---|
| **Overview** | Stat tiles (Scans, Menu views, Feedback, Review taps, Sent to Google, Stamps given, Guests), a "Scans per day" chart, "Where scans came from" (per-table QR sources), a **"Get set up" checklist** with progress (Add your logo, Add your menu, Share your Wi-Fi, Link your Google reviews, Set up a loyalty card, Print your QR codes and get a first scan), and a copy-link control. |
| **Guest page (design editor)** | Cover and logo upload, title and tagline, background colour, light/dark card appearance, typography preset (Pro), announcement, drag-to-reorder features, toggles (Google review button, Sudoku), social links, custom links. A **live phone preview** sits beside the form and reloads on save. |
| **Menu editor** | Menus → sections → items (name, description, price, photo, allergens, dietary tags, kcal, badges, featured/special, available/sold out, explainer). An external-menu-link option. **AI tools (Pro):** import from a photo or PDF, and draft "What's this?" text. AI drafts are flagged for the owner to check. |
| **Loyalty & capture (Pro)** | Stamp card (reward name, stamps required, reward tiers) or a rewards-only membership, refer-a-friend settings, guest capture switches (Wi-Fi email gate, marketing consent, birthday ask, join after feedback), automation emails (reward ready, birthday, win-back), and **staff device pairing**. |
| **QR codes** | QR designer (download PNG/SVG, per-table sources), plus a **print sheet** of table cards (a printable A4 layout). |
| **Guests** | Table of guests (name, email, consent, birthday, visits, stamps), with CSV export on Pro. |
| **Feedback** | Inbox of feedback with sentiment (Positive, Negative, Mixed), photos and dates. |
| **Plan & billing** | Current plan, trial countdown, Upgrade / Manage billing / Cancel. |
| **Settings** | Venue details, page address (short code), weekly digest on/off, and a danger zone to delete the venue. |
| **Account** | Name, password, notification preferences, delete account. |

**UI states that exist throughout:** Pro badges and upsell notices on locked features; notices (info, warning, error, ok, admin); a trial banner; empty states; confirmation dialogs; toasts; and saving or busy states.

### 4.8 Staff till: `/staff`, `/staff/stamp?c=<card>`
Pairing via a one-time link, then: a **"Scan a card"** button (an in-page camera QR scanner), search a member by name or email, then a card panel with the member's stamps, **+ Stamp**, **Redeem reward**, **Undo**, and a cooldown warning against double stamping. After stamping, a "Scan the next card" button appears.

### 4.9 Admin: `/admin`
Platform overview stats, a Venues table and an Accounts table, with Suspend and Comp Pro actions. It uses a purple "admin" accent to separate it from the owner UI.

### 4.10 Utility pages
Consent result (`/consent`), Unsubscribe, Privacy, Terms.

---

## 5. Current design system

### 5.1 Merchant app tokens (scoped under `.app`)

| Token | Light | Dark |
|---|---|---|
| `--a-bg` | `#F7F8FA` | `#0C0E12` |
| `--a-surface` | `#FFFFFF` | `#14171C` |
| `--a-surface-2` / `-3` | `#F2F4F7` / `#EAECF0` | `#1B1F26` / `#232831` |
| `--a-border` / `-strong` | `#E4E7EC` / `#D0D5DD` | `#252A33` / `#343B46` |
| `--a-text` / `-2` / `-3` | `#101828` / `#475467` / `#667085` | `#F2F4F7` / `#C1C7D0` / `#8F98A5` |
| `--a-accent` (brand green) | `#1F6F5C` (hover `#175A4A`, soft `#E7F3EF`) | `#4FB596` (soft `#12302A`) |
| `--a-danger` | `#B42318` | `#F97066` |
| `--a-warn` | `#93370D` | `#FDB022` |
| `--a-ok` | `#067647` | `#47CD89` |
| `--a-info` | `#175CD3` | `#84CAFF` |
| `--a-admin` | `#6941C6` | `#BDB4FE` |

- **Type:** Inter, 15px base, line height 1.5. Headings use −0.015em letter spacing and balanced wrapping. Numbers use tabular figures.
- **Radius:** 12px (cards), 8px (small). **Shadows:** subtle (`0 1px 2px rgba(16,24,40,.05)`) up to a large modal shadow.
- **Easing:** `cubic-bezier(0.2, 0, 0, 1)`. Reduced motion is respected.
- **Focus ring:** a 2px gap plus a 4px ring in the accent colour at 70%.
- **Icons:** [lucide-react](https://lucide.dev).
- **Primitives already in code:** `.btn` (primary, ghost, sm, block, icon), `.field` / `.field-label` / `.hint` / `.field-error`, input with prefix, `.switch` toggle rows, `.card` (head, foot, flush), `.notice-*`, `.badge-*` (info, admin, pro, ok, warn, danger), `.stat`, `.table`, sidebar `.nav-link`, wizard progress, colour swatches, choice grid.

### 5.2 Guest page theming (derived from one colour)
The owner sets **one background colour**. The code then computes:
- **Page text** is `#1A1A1A` on light backgrounds and `#FFFFFF` on dark ones (WCAG luminance threshold 0.45). Secondary and tertiary text are the primary colour at **70% and 50% alpha**, never a fixed grey, so they work on any brand colour.
- **Card chrome** is light (white cards `#FFFFFF`, inputs `#F2F2F7`) or dark (cards `#262626`, inputs `#3A3A3C`). It follows the background by default, or the owner can force it.
- **The guest page ignores the visitor's dark mode.** A venue looks the same to every guest. Only success and error status colours follow the OS.
- iOS-style system colours: success `#34C759`, error `#FF3B30`, accent blue `#1447E6`, loyalty rose `#D94D66`, Sudoku purple `#7D59D9`.
- Guest-page sizes: cards 16px radius, inputs 10px radius and 16px text (so iOS doesn't zoom), primary button 12px radius with 17px text and 15px padding.
- Typography presets (Pro) apply only to the venue name, tagline and card labels: **Classic** = Playfair Display SC, **Editorial** = Petrona, **Modern** = Outfit.

### 5.3 Brand
- Working name **Tabletap** (not final; the name is configurable via an environment variable). There is a small `BrandMark` icon and wordmark.
- No logo has been designed yet. A logo and wordmark would be welcome.

---

## 6. Demo venues (use these as realistic content)

| Venue | Look | Shows |
|---|---|---|
| **Juniper Coffee House**, "Slow coffee, good company" | White background, default style | Stamp card with reward tiers, hosted menu (Avocado on Sourdough £10.95, Eggs Florentine £12.50, Flat White £3.60, Oat Latte £3.95, Dirty Chai £4.20…), Wi-Fi, Sudoku |
| **The Copper Kettle**, "Est. 1887 · Real ales & roasts" | Dark green `#1F2A24`, Classic preset | Pub: Wi-Fi email gate, 18+ marketing consent, birthday ask; Beer-Battered Haddock £16.50, Steak & Ale Pie £17.50 |
| **Bloom Bakery**, "Sourdough, pastries & flowers" | Warm cream `#F6E7D8`, Modern preset | Rewards-only members club, "Order online" external link, custom link cards |

---

## 7. Constraints a design must respect

1. **The guest page must work on any owner-chosen colour**, from white to black and anything garish in between. Don't rely on a fixed accent colour for anything critical on that page; derive from page or card chrome instead.
2. **Guest page is mobile-first and fast:** a 500px column, no heavy web fonts by default, no large decorative images beyond the owner's cover and logo.
3. **Tap targets of 44px or more**, 16px input text, and safe-area insets on iPhone.
4. **Accessibility:** WCAG AA contrast, visible focus, labelled controls, and support for reduced motion.
5. **Light and dark mode** for the merchant app.
6. **Built as plain CSS with custom properties** (no Tailwind), with React 19 / Next.js components and lucide icons. Express designs as tokens and components that map onto §5 where possible.
7. **Don't copy Candour** (the competitor we benchmarked): not their heart logo, wordmark, copy or images.
8. Copy tone: plain, warm, short British English ("Wi-Fi without the questions", "Hear it first").

---

## 8. What I want designed

<!-- Edit this section before handing over: keep what you want, delete the rest. -->

- [ ] A brand identity: name lockup, logo mark and wordmark for Tabletap
- [ ] The marketing home page (hero, features, pricing, demos)
- [ ] The guest page: header, feature cards, expanded sheets (loyalty join, stamp card, Wi-Fi, feedback → Google review)
- [ ] The hosted menu page
- [ ] The dashboard shell and Overview (stats, chart, setup checklist)
- [ ] The guest page design editor with live phone preview
- [ ] The menu editor, including AI import
- [ ] The staff till screens
- [ ] Printable QR table cards (A6 / A4 sheet)
- [ ] The onboarding wizard

Please give me desktop and mobile versions of merchant screens, and mobile (390px) for guest screens. Show both a light venue (Juniper) and a dark venue (Copper Kettle) for guest screens.

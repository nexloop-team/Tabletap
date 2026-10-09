# Tabletap: design brief

This brief is for designing Tabletap's UI. It describes the product as it is built today: who uses it, every screen and its states, the design system in the code, real content to design with, and the constraints a design must respect so it can be built.

Everything listed here exists and works. "Design further" means improving or extending these screens, not starting over. Section 9 lists where help is most wanted.

---

## 1. The product

Tabletap is self-serve software for independent hospitality venues: cafés first, then pubs, bars, bakeries and small restaurants.

1. An owner signs up and answers four short onboarding questions.
2. They get a **guest page** and **printable QR codes** for their tables.
3. A guest scans the code at the table and opens a mobile web page. There's no app to download. The page has:
   - the venue's menu
   - the Wi-Fi password
   - a digital loyalty stamp card
   - a private feedback box, followed by a Google review invitation
   - the owner's own links
   - a Sudoku to pass the time
4. Owners run everything from a **dashboard**: page design, menu, loyalty, QR codes, guest list, feedback and their subscription.
5. Staff stamp loyalty cards from a **till screen** on a phone or tablet.
6. The platform operator runs an **admin console**.

**Positioning:** "One QR code for everything your guests need at the table." Owners set it up themselves in ten minutes, with no designer, no developer and no waiting on us.

**Name:** Tabletap is the working name. It can be changed with an environment variable, so the design shouldn't depend on the exact word.

### Pricing (one plan)

- **₹999 + 18% GST a year per venue** (₹1,178.82 in total). Every feature is included.
- **7-day free trial** for each new venue, with no card needed.
- **When neither paid nor on trial:** the venue's guest page goes **offline**. The owner can still sign in, edit and subscribe, and the page comes back exactly as it was.
- **Failed renewal:** the page stays up while Razorpay retries. It goes offline if the retries run out.
- **Cancelling** stops the next renewal. The page stays live until the paid year ends.
- **Payments:** Razorpay (India). Checkout opens as a pop-up on the Subscription page.
- **Admins** can also give a venue free access (the demo venues have it).

There are no plan tiers, "Pro" badges or upgrade prompts anywhere. Don't design any.

---

## 2. Who uses it

| User | Situation | What they care about |
|---|---|---|
| **Guest** | At a table, on their own phone, often one-handed, having just scanned a code. Could be in a dim pub or a bright café. Has never heard of Tabletap and has no patience. | Getting the Wi-Fi, seeing the menu and allergens, collecting a stamp. It must be fast and obvious, with no sign-up friction. |
| **Venue owner or manager** | Runs a small independent business and isn't technical. Often on a phone between customers, sometimes on a laptop after closing. | The page looks like *their* place. The menu is easy to update. More regulars, more Google reviews, and hearing about problems privately before they become public reviews. |
| **Staff at the till** | Using their own phone (with a staff login) or a shared phone or tablet behind the counter, during a rush. | Scanning a card, adding a stamp, redeeming a reward, undoing a mistake, all in seconds. |
| **Platform admin** | The operator. Super admins are set in config, and they can make other people admins. | Seeing every venue and account, helping owners, and watching revenue and churn. |

---

## 3. The five surfaces

Each surface has its own look on purpose. They don't share one style.

### A. Guest page (`/s?i=<venue>`): the most important surface

- **Layout:** mobile-first, one column, max-width 500px, centred on desktop.
- **Themed per venue:** the owner picks one background colour, and everything else is derived from it (section 5.2). It must look like the venue's own page, not like Tabletap. There is **no Tabletap branding on guest pages**.
- **Font:** the system font stack (SF Pro on iPhone), so it loads instantly on 4G. The owner can pick a typography preset instead.
- **Feel:** iOS-native, calm and easy to tap, like an Apple App Clip or a well-made link-in-bio page.

### B. Hosted menu (`/menu?i=<venue>`)

Uses the same venue theme. It's a long, scrollable menu that's pleasant to browse at the table.

### C. Merchant app

Covers the marketing site, sign-in, onboarding, the owner dashboard and the admin console.

- **Brand:** Tabletap's own. Warm paper neutrals with one brand colour, **deep green `#24573F`**, and a **warm clay `#C9682C`** accent for highlights and "needs attention".
- **Light and dark mode** follow the device setting.
- **Feel:** modern, trustworthy B2B software (Linear, Stripe or Square Dashboard territory), but warm and simple enough for a café owner.

### D. Staff till (`/staff`)

Merchant styling, tuned for speed: big tap targets and camera scanning.

### E. Print

A4 sheets of QR table cards, printed at 100%.

---

## 4. Every screen and what is on it

### 4.1 Guest page: `/s?i=<code>`

#### Header

The venue name is set big and bold in capitals **over the cover photo** (with a dark fade so it reads), with the tagline small above it. This applies to every layout. The Header setting arranges it:
- **Logo left** (default): the logo beside the name.
- **Centred:** the logo on top, everything centred (the cover is a little taller).
- **No logo:** just the name.

Without a cover photo, the same text sits on the page colour.

Below the header there can be an **announcement banner** (for example "Pumpkin spice is back today"). It can have an end date, after which it hides itself.

#### Feature cards

The owner controls the cards:
- They can show, hide, rename and reorder every card.
- **Layout:** List (one card per row, the default), Bento (see below), or Compact (shorter rows).
- **Button shape:** Rounded, Pill or Square.

Each card has a tinted icon circle (44px), a 15px label and a chevron. Tapping a card either opens an inline sheet with an animated height change, or goes to another page.

| Card | Icon tint | What happens |
|---|---|---|
| **Stamp card** (shows "Your rewards card" once joined) | Rose `#D94D66`, filled heart | Opens a join form: name, email, and optionally birthday and marketing consent (with a check badge). Then the **digital stamp card**: a stamp grid, reward tiers, a **"Show to staff"** button that reveals a QR code for staff to scan (hidden by default), and an invite-a-friend link. Rewards-only venues show a **Members club** join instead of stamps. |
| **Menu** (or "Order online", "Book now", "Price list", or the owner's own label) | Orange `#FF9500` | Goes to the hosted menu, or to an external URL. |
| **Wi-Fi** | Green `#4DC778` | Opens the network name and password, each with a one-tap copy row. The owner can turn on an **email gate** that asks for an email first. |
| **Suggestion box** (A/B tested against the label "Anonymous feedback") | Blue `#1447E6` | Opens a textarea with an optional photo, then a thank-you. **Every** guest is then invited to leave a Google review: Google's rules forbid asking only happy guests. It may also offer "join and get a free stamp". |
| **Google review** | Google G | Links out to the venue's Google review page. |
| **Custom links** | Purple `#9C27B0` | The owner's own links (website, booking and so on), each with an icon they choose. |
| **Sudoku** | Purple `#7D59D9` | Opens a playable Sudoku grid. |

#### Bento layout

- **Tiles** in three shades of one **tile colour** (the owner picks it, or it comes from the page colour, or deep green):
  - **Hero (deep):** the loyalty tile across the full width ("3/8", "5 more → Free coffee", stamp segments, "Show to staff" or "Join free"), and the Google review tile (three stars).
  - **Pop (bright):** Wi-Fi ("Tap to copy" copies the password in one tap, plus the network name).
  - **Pale:** Menu (tall, with a faint knife and fork and an arrow), Suggestion box ("Only the owner reads it"), Sudoku (a corner of a board), custom links.
- Tiles open their content in a **bottom sheet** instead of expanding in place.
- The arrangement never leaves gaps: a tile left without a partner takes the full row.

#### Footer

A row of social icons in single-colour glyphs: Google, Facebook, Instagram, TripAdvisor, YouTube. There's no language switch; guests get Spanish when their phone is set to it.

#### States

- **Loading:** a skeleton.
- **Page unavailable:** a sad-face icon and the text "This page isn't available". This shows when the code is wrong, the venue is suspended, or **the subscription has lapsed**.
- **Forms:** errors, success, "Check your inbox to confirm", and buttons disabled while busy.
- **Returning member:** sees their card straight away.

#### Copy

English and Spanish. Spanish strings run longer.

### 4.2 Hosted menu: `/menu?i=<code>`

#### Header and controls

- A branded header: a short cover banner (140px) with the logo overlapping it, then the venue name and "Menu".
- A search field.
- A sticky section jump bar (chips).
- **Dietary filters:** vegan, vegetarian and gluten-free.
- The **UK 14 allergens** are shown on items.

#### Highlights strip

A horizontal strip of **"Today's specials"**. If no dish is marked as a special, it shows **"Most popular"** dishes instead. A dish without a photo gets a tinted panel showing its first letter.

#### Dishes

There are three menu layouts:
- **List** (default): one card per section. Dishes are rows separated by hairlines, each with an 88px rounded thumbnail on the right.
- **Photo:** big photo cards.
- **Classic:** a printed-menu look for pubs and restaurants. No cards, centred section titles, and dotted leaders between the dish name and its price.

Each section can have an optional description, such as "Served until 11:30", and shows how many items it has.

Each dish shows:
- name, description and price
- an optional photo
- dietary tags with small icons
- allergens
- calories (optional)

Dishes can also have:
- **Coloured badges:** Popular (amber), New (green), Spicy (red, with a chilli icon), Chef's pick (purple).
- A **sold out** state.
- An ⓘ **"What's this?"** explainer for unfamiliar dishes.

Tapping a dish opens a **bottom sheet** with a large photo, the full description, allergens, calories and the explainer.

#### Footer

The allergen note.

### 4.3 Member web card: `/card/<id>`

The guest's loyalty card. It's also linked from their emails. It shows their stamps, progress towards rewards, a staff QR code (behind "Show to staff") and an invite-a-friend link. It updates live when staff add a stamp.

### 4.4 Marketing site: `/`

- **Top nav:** wordmark, Pricing, Sign in, **Start free trial**.
- **Hero:**
  - Headline: "One QR code for everything your guests need at the table."
  - CTAs: "Start your free trial" and "See live examples".
  - Note: "7-day free trial · No card needed · ₹999 a year after that".
  - A phone mockup with the live demo guest page embedded.
- **"Everything on one page":** eight feature tiles: menu, Wi-Fi, loyalty, private feedback, Google reviews, guest list, QR codes, branding.
- **"Live in three steps":** sign up and answer four questions, add your menu and logo, print your QR codes.
- **Pricing:**
  - Heading: "One plan. Everything included."
  - One dark featured card with a "7 days free" flag.
  - Price: **₹999 / year per venue**, with "+ 18% GST (₹1,178.82 in total)".
  - A list of nine features and a "Start your free trial" button.
- **"Try a demo venue":** the three demo venues (section 6).
- **Footer:** Terms, Privacy, Sign in.

### 4.5 Sign-in pages

- **Pages:** Sign up, Log in, Forgot password and Reset password.
- **Layout:** a centred card on a plain background. There's an optional Cloudflare Turnstile captcha.
- **Copy:** sign-up says "Try everything free for 7 days. No card needed."
- **Staff invites:** a staff member arriving from an invite gets their own short version of the copy.
- **Sessions:** sign-ins last 90 days from the last visit, so people who come back stay signed in.

### 4.6 Onboarding wizard: `/onboarding`

Four steps with a progress bar and a live guest-page preview:

1. **Tell us about your venue:** name and type (café, pub, bakery and so on).
2. **Pick a colour that feels like your place:** colour tiles (White, Oat, Sage, Mist, Blush, Forest, Navy, Espresso, Terracotta, Black) and a custom colour.
3. **The essentials** (all optional): menu link, Wi-Fi name and password, Google review link.
4. **Bring guests back:** a stamp card yes/no, the reward name ("Free coffee") and the number of stamps needed.

The page is then created straight away, and the owner lands on the Overview with "Your page is live".

### 4.7 Owner dashboard: `/dashboard/<venue>`

#### Shell

A left sidebar holds:
- a venue switcher, showing the subscription status under each venue name ("Active", "Trial · 5 days left", "Unpaid")
- grouped navigation
- Help & contact
- Account
- Sign out

On phones the sidebar becomes a drawer behind a top bar.

```
Overview
GUEST EXPERIENCE
  Guest page
  Menu
  Loyalty & capture
  QR codes
INSIGHTS
  Guests
  Feedback
VENUE
  Subscription
  Settings
─────
My venues · Platform admin (admins only) · Help & contact · Account · Sign out
```

#### Bars above the page content

- **Account bar:** one slim bar that combines the trial countdown ("Free trial · 5 days left", with a **Subscribe** button) and "Confirm your email" (with Resend, and an × that snoozes it for a day).
- **Offline banner** (red), shown when unpaid: "**Your guest page is offline.** Your free trial has ended. Subscribe to bring it back exactly as it was. [Subscribe]".
- **Suspended notice:** shown when an admin has suspended the venue.
- **Admin notice** (purple), shown when an admin views someone else's venue. See 4.9.

#### Overview

- **Stat tiles:** Scans, Menu views, Feedback, Review taps, Stamps given, Guests, each with a week-on-week change.
- A **"Scans per day"** bar chart.
- **"Where scans came from":** sources per table QR code.
- A **"Get set up" checklist** with a progress bar. Each item deep-links to the exact field and highlights it:
  - Add your logo
  - Add your menu
  - Share your Wi-Fi
  - Link your Google reviews
  - Set up a loyalty card
  - Print your QR codes and get a first scan
- A "View page" button and a copy-link field.

#### Guest page editor

The form is on the left. A **live phone preview** is on the right; on phones it becomes a full-screen "Preview" button. The cards on the page are:

- **Cover and logo:** upload or remove.
- **Title and tagline.**
- **Background colour:** the swatches plus a custom colour.
- **Card appearance:** Auto, Light or Dark.
- **Typography:** Default, Classic, Editorial or Modern.
- **Layout:** layout tiles (List, Grid, Compact), header style, button shape.
- **Announcement:** with an end date.
- **Features:** one row per card with an on/off switch, an inline rename, and drag to reorder (keyboard arrows work too). There are help tips, for example on how to find your Google review link.
- **Wi-Fi.**
- **Social links:** these accept @handles.
- **Custom links:** with an icon picker.

A floating **save bar** shows "Unsaved changes" with Save and Reset. After saving, a toast offers **Undo**, which restores the previous version.

#### Menu editor

- **Three panes:** menus, then sections, then items. On phones they stack.
- **Menu details:** name, layout (List, Photo or Classic), an external menu link option, and section descriptions.
- **Item editor:** name, description, price, photo, allergens, dietary tags, calories, badges, special or featured, available or sold out, and the "What's this?" explainer.
- **Reordering:** drag items, or use the keyboard.
- **AI import:** drop a photo or PDF of a printed menu, review what was read, then add it to the menu or replace the menu. Items the AI wasn't sure about are flagged "check this".
- **AI explainers:** draft "What's this?" notes for dishes guests might not recognise, then review them one by one.

#### Loyalty & capture

- **Stamp card:** the reward name, stamps required and reward tiers. Alternatively, a rewards-only members club.
- **Refer a friend:** stamps for the person who refers, stamps for the friend, and stats.
- **Guest capture switches:** Wi-Fi email gate, marketing consent (with an 18+ option), birthday ask, and join after feedback.
- **Staff devices:** pair a shared phone or tablet with a one-time link or QR code, see the list of devices with when each was last used, and remove a device.
- **Staff logins:** invite staff by email. Staff can only open the till, never the dashboard. The list can be removed from, and removing someone locks their devices too.
- **Automatic emails:** reward ready, birthday treat, and win-back after N days.

#### QR codes

- A QR designer: colour, download as PNG or SVG, and a source per table so each table's scans are counted.
- A **print sheet** of A4 table cards, with the venue name, a call to action and the QR code.

#### Guests

A searchable, paginated table with name, email, consent, birthday, visits, stamps, where they joined, and when. There's an **Export CSV** button.

#### Feedback

An inbox of guest feedback with a sentiment label (Positive, Negative or Mixed), photos and dates.

#### Subscription (formerly "Plan & billing")

- **Status card:**
  - **Subscribed** (Active): "Renews on 8 October 2027", with a quiet "Cancel subscription" button.
  - **Free trial:** "Trial · 5 days left", plus "Your trial ends on … Your page goes offline then unless you subscribe."
  - **Not subscribed** (Unpaid).
  - **Free access from the Tabletap team.**
- **Plan card:** "Tabletap, ₹999 / year, + 18% GST, so ₹1,178.82 in total", the feature list, and **Subscribe / Subscribe now**. The button opens Razorpay Checkout.
- **Notices:**
  - "You're subscribed. Thank you!"
  - Dev-mode warning.
  - Offline (red).
  - "Your renewal payment didn't go through. Razorpay will try again…"
  - "Your subscription won't renew. Your guest page stays live until …"
- **Cancel confirmation:** "Cancel your subscription?", with the buttons **Keep it** and **Cancel subscription**.

#### Settings

- **Venue details.**
- **Page address:** the short code inside the QR codes.
- **Danger zone:** delete the venue by typing its name.

#### Account

- Weekly summary emails (one switch per venue).
- Profile name.
- Password change.
- Delete account (needs the password).

#### UI patterns used throughout

- notices: info, ok, warn, error, admin
- empty states
- confirmation dialogs (danger dialogs focus Cancel first)
- toasts, some with Undo
- busy spinners
- help tips ("How do I…?")
- loading skeletons for each dashboard page

### 4.8 Staff till: `/staff`, `/staff/stamp?c=<card>`

- **Getting in:** staff reach the till in one of two ways:
  - pair a shared device with a one-time link from the owner, or
  - sign in with their own staff login and tap **"Open the till"**.
- **Till screen:**
  - A big **"Scan a card"** button opens an in-page camera QR scanner.
  - Staff can also search for a member by name or email.
  - The **card panel** shows the member's stamps, with **+ Stamp**, **Redeem reward** and **Undo**.
  - A cooldown warning prevents stamping the same card twice.
  - After stamping, a "Scan the next card" button appears.
- **Recent activity:** the last few stamps and redemptions.
- **Unpaired state:** "This isn't a staff device yet".

### 4.9 Admin console: `/admin`

Purple "admin" accent (`#6941C6`) to separate it from the owner UI. Sidebar: Overview, Venues, Accounts, Activity log.

#### Overview

- **Stat tiles:** Venues, Accounts, Paying, On trial, Unpaid (guest page offline), Guests captured.
- **Revenue panel** (amounts before GST): Yearly recurring (₹), Per month, Churn over 30 days (%), Won't renew, and Payment failing.
- **"New accounts"** chart for the last 30 days.
- **"Needs attention"** list: failing payments, trials ending, pages that just went offline, and suspended venues.
- **Latest venues** table.

#### Venues

- **Filters:** All, Paying, Trial, Unpaid, Free access, Suspended.
- **Search** by name, code or owner email.
- **Table columns:** venue, owner, subscription badge, guests, scans in the last 7 days, last scan, created.
- **Row actions:** "View", which opens the owner dashboard read-only, and a **"…" menu** with:
  - View as owner
  - View guest page
  - Extend trial by 7 days
  - Give free access, or Remove free access
  - Suspend venue, or Restore venue

#### Accounts

- **Filters:** All, Unverified, No venue, Blocked, Admins.
- **Badges:** Verified, Unverified, Blocked, Admin, Super admin.
- **The "…" menu:**
  - Resend confirmation email
  - Send password reset link
  - Make admin, or Remove admin (super admins only)
  - Block or Unblock account
  - Delete account, where the admin types the account's email to confirm

#### Activity log

Every admin change, showing when, which admin, the action and what it was done to. For example:
- "Extended trial +7 days"
- "Blocked account"
- "Edited for owner: saved branding, menus"

#### Edit for owner

When an admin views a venue, a purple banner says it's read-only, with an **"Edit for owner"** button.

- Switching it on asks for confirmation first.
- Editing then lasts 30 minutes. The banner turns amber: "You're editing Juniper Coffee House for the owner until 1:26 pm. Every save is logged." with a **Stop editing** button.
- Billing and deleting the venue always stay with the owner.

### 4.10 Utility pages

Consent result (`/consent`), Unsubscribe, Privacy, Terms.

---

## 5. Design system in the code

### 5.1 Merchant app tokens (scoped under `.app`)

**Light mode:**

| Token | Value | Use |
|---|---|---|
| `--a-bg` | `#F5F5F1` | Page background (warm paper) |
| `--a-surface` | `#FFFFFF` | Cards |
| `--a-surface-2` / `-3` | `#F1F0EB` / `#E9E8E2` | Wells, table headers, hover |
| `--a-border` / `-strong` | `#E6E5E0` / `#D6D5CE` | Hairlines |
| `--a-text` / `-2` / `-3` | `#16181A` / `#4A4F54` / `#5C6166` | Text (all AA) |
| `--a-accent` | `#24573F` (hover `#1C4532`, soft `#E4EEE7`) | Brand green, primary buttons |
| `--a-warm` | `#C9682C` (soft `#FBEBDD`) | Clay highlight, the dot in the logo mark |
| `--a-danger` | `#B42318` | Errors, destructive actions |
| `--a-warn` | `#9A4512` | Warnings |
| `--a-ok` | `#1E6B44` | Success |
| `--a-info` | `#175CD3` | Info |
| `--a-admin` | `#6941C6` (soft `#F4F3FF`) | Admin console |

**Dark mode:**
- background `#0F1113`
- surface `#1A1D21`
- text `#F2F3F1`
- accent `#5FBF84`
- warm `#F2B48A`

**Typography:**
- Body font: **Instrument Sans**, 15px base, 1.5 line height.
- Headings and the wordmark: **Bricolage Grotesque** (700).
- Numbers use tabular figures.

**Shape, motion and icons:**
- **Radius:** 12px for cards, 8px for small elements.
- **Shadows:** from a subtle 1px shadow up to a large modal shadow.
- **Easing:** `cubic-bezier(0.2, 0, 0, 1)`. Reduced-motion settings are respected.
- **Focus ring:** a 2px gap, then a 4px ring in the accent colour at 70%.
- **Icons:** [lucide](https://lucide.dev).

**Building blocks already in code:**
- buttons: primary, ghost, danger, small, block, icon
- form pieces: field, label, hint, error
- switch rows, cards (with head, foot or flush), notices, badges (ok, warn, danger, info, admin, trial)
- stat tiles, tables, filter tabs, popover "…" menus
- confirm dialog, toast, save bar
- preset tiles (for layout and typography), colour swatches, choice grid, wizard progress
- empty states, skeletons, a phone preview frame

### 5.2 Guest page theming (derived from one colour)

The owner sets **one background colour**, and the code computes the rest:

- **Page text** is `#1A1A1A` on light backgrounds and `#FFFFFF` on dark ones (the switch happens at WCAG luminance 0.45).
- **Secondary and tertiary text** are the primary text colour at **70% and 50% opacity**, never a fixed grey, so they work on any colour.
- **Card chrome** is light (white cards, `#F2F2F7` inputs) or dark (`#262626` cards). It follows the background by default, or the owner can force it.
- **The guest page ignores the visitor's dark mode.** A venue looks the same to every guest.
- **System colours:** success `#34C759`, error `#FF3B30`, accent blue `#1447E6`, loyalty rose `#D94D66`, Sudoku purple `#7D59D9`.
- **Sizes:**
  - Cards have a 16px radius.
  - Inputs have a 10px radius and 16px text, so iOS doesn't zoom in.
  - The primary button has 17px text.
  - The button shape setting can change the radius (pill or square).
- **Typography presets** apply to the venue name, the tagline and the card labels:
  - **Classic:** Playfair Display SC
  - **Editorial:** Petrona
  - **Modern:** Outfit

### 5.3 Brand

- **Wordmark:** "tabletap" in lower case, Bricolage Grotesque.
- **Mark:** a rounded square containing a table/"T" shape, with a small clay dot (the "tap").
- **Favicon and app icon:** the same mark.

---

## 6. Demo venues (realistic content)

| Venue | Look | What it shows |
|---|---|---|
| **Juniper Coffee House**, "Slow coffee, good company" (`/s?i=demo`) | White background, default style | Stamp card with reward tiers. Hosted menu with photos, badges and a special: Avocado on Sourdough, Eggs Florentine, Flat White, Oat Latte, Dirty Chai. Wi-Fi, Sudoku. |
| **The Copper Kettle**, "Est. 1887 · Real ales & roasts" (`/s?i=demo-crm`) | Dark green `#1F2A24`, Classic typography | A pub: Wi-Fi email gate, 18+ marketing consent, birthday ask. Beer-Battered Haddock, Steak & Ale Pie. |
| **Bloom Bakery**, "Sourdough, pastries & flowers" (`/s?i=demo-rewards`) | Warm cream `#F6E7D8`, Modern typography | Rewards-only members club, "Order online" external link, custom link cards. |

**Currency:** each venue has its own (the demos use £). Tabletap's own subscription is priced in ₹.

---

## 7. Constraints a design must respect

1. **The guest page must work on any colour the owner picks,** from white to black and anything garish in between. Never rely on a fixed accent colour for anything important there; derive from the page or card colours instead.
2. **The guest page must be fast:** a 500px column, no heavy web fonts by default, and no big decorative images beyond the owner's cover and logo.
3. **Touch:** tap targets of at least 44px, 16px text in inputs, and iPhone safe-area insets.
4. **Accessibility:** WCAG AA contrast, visible focus, labelled controls, reduced motion, and no information conveyed by colour alone (badges always pair an icon with text).
5. **Both modes:** the merchant app needs a light and a dark version of every screen.
6. **Phones work for everything:** owners often use the dashboard on a phone, so every merchant screen needs a 390px version with no sideways scrolling.
7. **Buildable as-is:** plain CSS with custom properties (no Tailwind), React 19 / Next.js components and lucide icons. Express designs as tokens and components that map onto section 5.
8. **Tone:** plain, warm and short ("Wi-Fi without the questions", "Hear it first").
9. **Originality:** don't copy competitors' logos, copy or images.

---

## 8. How things behave (worth showing in designs)

- **Saving:** the editors save explicitly with the save bar, then show a toast with **Undo**.
- **Checklist links:** a checklist item opens the right page and highlights the exact card.
- **Confirmations:** destructive actions always ask first. Typed confirmation is required to delete a venue (type the name) or an account (type the email).
- **Subscription changes:**
  - When a trial ends, the account bar turns into the red offline banner.
  - The venue switcher label changes from "Trial · N days left" to "Unpaid".
  - Guests see "This page isn't available".
- **Admin help:** an admin can look at any venue read-only, and can switch on time-limited, logged editing.
- **Staff:** removing a staff login also locks every till device that person opened.

---

## 8b. Built from the last design round (October 2026)

These now match the Claude Design boards:
- **Bento tile colours:** From your logo (two colours read from it), Page colour, or Pick a colour, with a second colour for the Wi-Fi tile, stamp bars and stars (Auto = brighter shades of the main colour).
- **Rewards card page** (`/card`), **"Back soon"** paused page and "Page not found".
- **Menu (List layout)** in the tile colours: each dish a pale card, badges as deep chips, diet tags bright, specials as coloured tiles; the dish sheet's allergen reassurance.
- **Subscription** with every state (trial, last day, unpaid with steps, payment failing, won't renew with "Subscribe again", free access), FAQ and the dark plan card.
- **Overview** with 7/30/90 days, "What to do next", unread feedback on the nav, and a new-venue checklist with a Next step.
- **Editor** live preview (no save needed), typography descriptions, tagline counter.
- **Onboarding** time left and own-colour box; **till** member line and online status; **admin** revenue chart, conversion and attention actions; **marketing** chips, FAQ and closing band; **sign-up** password toggle and staff invite; **print** A6, tent, round sticker and Wi-Fi sign formats.

## 9. What could be designed next

Pick from these. They're ordered roughly by impact.

1. **Subscription journey:** the trial countdown at 7, 3 and 1 days left. The moment a page goes offline, for both the owner and the guest; a friendlier "This venue's page is paused" might be better. The Razorpay hand-off and the success screen. The "won't renew" state. Reminder email templates.
2. **Guest page polish:**
   - richer expanded sheets (loyalty join, stamp card, Wi-Fi, feedback leading to the Google review)
   - the Grid and Compact layouts
   - the three header styles
   - a light venue (Juniper) and a dark one (Copper Kettle) for each
3. **Menu page:** each of the three layouts (List, Photo, Classic), the dish sheet, the specials and "Most popular" strip, and the dietary filters, shown on light and dark venues.
4. **Owner Overview:** better stats and charts, and a clearer "what to do next".
5. **Admin console:** the revenue panel as a proper finance view (yearly and monthly recurring revenue trend, churn, trial-to-paid conversion), an account detail page, a venue detail page with its activity history, and the edit-for-owner states.
6. **Staff till:** a faster scan-stamp-next flow, plus big success and failure feedback.
7. **Print:** more QR table card styles (tent card, sticker, A6), using the venue's colours.
8. **Marketing site:** India-first messaging (₹ pricing, GST note), testimonials, an FAQ, and a "how it works" animation.
9. **Emails:** verification, password reset, welcome, trial ending, payment failed, the guest loyalty pass, the reward-ready email, and the weekly summary.

**Deliverables wanted:** desktop and 390px mobile for merchant screens, in light and dark. For guest screens, 390px mobile on a light venue (Juniper) and a dark venue (Copper Kettle).

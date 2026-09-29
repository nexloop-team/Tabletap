# Candour `s.html` — Reverse-Engineering Analysis

**Target:** `https://candour.app/s.html?i=1` (demo business "Maple Café")
**Inspected:** 2026-09-30
**Method:** Live browser inspection (Chrome), DOM/computed-style measurement, network capture, and a full read of the page source (`s.html`, ~5,400 lines, ~400 KB) plus its included scripts. Every behaviour below comes from the observed page or its shipped source. Anything not exercised live is marked **(code only)**.

> **Scope note.** This document describes *behaviour and UX* so we can build our own equivalent. We should **not** copy Candour's brand (name, heart logo, "By Candour" wordmark), their copywriting verbatim, their hosted images, or call their backend/API keys. See §21.

---

## Table of contents

1. [What the page is](#1-what-the-page-is)
2. [Architecture](#2-architecture)
3. [URL parameters & routing](#3-url-parameters--routing)
4. [Boot sequence & loading state](#4-boot-sequence--loading-state)
5. [Business data model (API response)](#5-business-data-model-api-response)
6. [Page layout & visual spec](#6-page-layout--visual-spec)
7. [Theming / branding engine](#7-theming--branding-engine)
8. [Feature cards — selection, ordering, rendering](#8-feature-cards--selection-ordering-rendering)
9. [Feature: Loyalty (stamp card)](#9-feature-loyalty-stamp-card)
10. [Feature: Rewards-only join](#10-feature-rewards-only-join)
11. [Feature: Wi-Fi (+ email capture gate, birthday)](#11-feature-wi-fi--email-capture-gate-birthday)
12. [Feature: Feedback / Suggestion box (+ sentiment routing)](#12-feature-feedback--suggestion-box--sentiment-routing)
13. [Camera / gallery photo attachment](#13-camera--gallery-photo-attachment)
14. [Feature: Google review, Menu, External links, Social row](#14-feature-google-review-menu-external-links-social-row)
15. [Feature: Sudoku mini-game](#15-feature-sudoku-mini-game)
16. [API / network requests](#16-api--network-requests)
17. [State catalogue: loading / error / success](#17-state-catalogue-loading--error--success)
18. [Local storage, cookies, session state](#18-local-storage-cookies-session-state)
19. [Analytics events](#19-analytics-events)
20. [i18n, responsiveness, accessibility, security](#20-i18n-responsiveness-accessibility-security)
21. [Assets, ancillary scripts, quirks & recreation notes](#21-assets-ancillary-scripts-quirks--recreation-notes)

---

## 1. What the page is

A **QR-code landing page for a hospitality venue**. It's the web fallback of Candour's iOS App Clip, and a customer lands on it after scanning a table/counter QR code. It's a vertical "link-in-bio"-style list of tappable **feature cards**, each of which either expands an inline panel ("sheet") or navigates away:

| Card (EN label) | Action |
|---|---|
| Start earning rewards | Expands loyalty sign-up (stamp card → Apple/Google Wallet pass) |
| Leave a Google Review | Opens the venue's Google review URL in a new tab |
| View Menu | Navigates to `menu.html` (or an external menu URL) |
| Connect to Wi-Fi | Expands SSID/password with copy buttons (optionally gated behind email capture) |
| Suggestion Box / Leave Anonymous Feedback | Expands feedback textarea + photo attach; sentiment-routes to a review/loyalty ask |
| Play Sudoku | Expands a full Sudoku game |
| *Custom links* | Open merchant-defined URLs |

Below the cards sits a row of social icons, then a "By Candour" footer.

**Observed card order for `i=1`:** loyalty → google_review → menu → wifi → feedback → sudoku. (The merchant's `featureOrder` = `[loyalty, googleReview, menu, wifi, feedback]`, and sudoku isn't listed, so it's appended.)

---

## 2. Architecture

- **One static HTML file.** Inline `<style>` (≈1,000 lines of CSS) plus one inline IIFE `<script>` (≈4,300 lines). **No framework, no build step, no bundler** for the page itself. All UI is built by string-concatenated HTML → `innerHTML`, then wired with `addEventListener`.
- **Hosting:** Firebase Hosting (`candour.app`).
- **Backend:** Google Cloud Functions (Firebase), region `europe-west2` (primary) with legacy `us-central1`. Firestore behind them.
- **Third-party calls from the browser:** Google Cloud Natural Language API (sentiment), Firebase Analytics / GA4.
- **Scripts loaded (in order):**

| Script | Purpose | Load |
|---|---|---|
| `firebase-app-compat.js` 10.12.2 (gstatic) | Firebase core | blocking |
| `firebase-analytics-compat.js` 10.12.2 | GA4 via Firebase | blocking |
| `analytics.js` | `window.CandourAnalytics.trackEvent/setPage`; per-load `session_id` | blocking |
| `candour-config.js?v=…` | Endpoint bases, Firebase web config, public API keys, test-endpoint map, `candourFunctionUrl()` | blocking |
| inline #1 | `firebase.initializeApp(config)` + `setupCandourAnalytics()` | blocking |
| `debug-panel.js` (+ `.css`) | Dev overlay, active only with `?debug=1` | blocking |
| `sudoku-engine.js` | Puzzle generator/solver (bundled MIT libs) | `defer` |
| inline #2 (main app) | Everything else | blocking |
| `/candour-landing/build/welcome-overlay.js?v=…` | "Claim your page" overlay for demo builders | `defer` |

- **Fonts:** system stack for UI. Google Fonts **Fraunces** (opsz 9, wght 630) is loaded non-blocking for the footer wordmark only. Optional style presets lazy-load Playfair Display SC / Petrona / Outfit (§7).

---

## 3. URL parameters & routing

| Param | Meaning |
|---|---|
| `i` or `id` | **Business identifier.** Either a canonical Firestore doc id or a short code; the server resolves it and returns the canonical `businessId`, which then replaces the local value. |
| `s` | Scan *source* tag (e.g. which QR/table). Defaults to `"unknown"`. Sent on feedback as `source: "web-<s>"` and on every analytics event. |
| `databaseId` | `test` switches every write endpoint to its `*Test` twin function. |
| `d=t` | Short alias → rewritten to `databaseId=test` via `history.replaceState` (App Clip Code URL length limits). |
| `e=debug` | Same rewrite as `d=t`. |
| `debug=1` | Shows the floating debug panel ("D" button): env info, URL params, API responses, a prod/test DB toggle. |
| `cta=cta_box` \| `cta_anon` | Forces the feedback-card A/B variant (QA). Skips the analytics user property. |

**Outbound navigation:**
- View Menu → `menu.html` + the *same* query string (`window.location.href`), **or** `window.open(externalUrl)` when the merchant's menu is an external link. Falls back to same-tab navigation if the popup is blocked.
- Google review / external links / socials → new tab (`target=_blank rel=noopener`).
- Privacy notice link → `/privacy.html` (new tab).
- Android "Open Wi-Fi Settings" → `intent:#Intent;action=android.settings.WIFI_SETTINGS;end`. iOS → `App-Prefs:root=WIFI`, then `prefs:root=WIFI` 250 ms later.

---

## 4. Boot sequence & loading state

1. HTML paints `<div id="content" class="loading-state"></div>` inside `.page-wrapper`.
2. `detectLang()` picks the locale from `navigator.language` and sets `<html lang>`, plus `dir="rtl"` for Arabic.
3. A/B bucket for the feedback CTA (§12) is read from or created in localStorage.
4. `init()`:
   - Sets `#content` text to **"Loading..."**, centred in a flex box, `min-height: 300px`, 16px, secondary colour. It's plain text with no spinner. (Observed: visible for roughly 0.5–1 s on a cold load.)
   - No id → error view "Business ID is missing from this link."
   - `GET fetchSocialMediaLinksEU?businessId=<id>&surface=s[&databaseId=]`.
   - Non-OK → error view "We could not load business details. Please try again." A 404 also fires `short_code_resolution_failed`.
   - OK → `renderLanding(data)`, then the events `screen_viewed{screen_name:"app_clip"}` and `app_clip_opened{features_shown:"loyalty,google_review,…"}`.
5. Deferred: the sudoku engine and the welcome overlay load.

**Design intent (from comments):** a flash-free first paint. The CSS defaults are white; brand colours are applied a frame after the data arrives.

---

## 5. Business data model (API response)

Captured live from `GET https://europe-west2-suggestion-box-e23b2.cloudfunctions.net/fetchSocialMediaLinksEU?businessId=1&surface=s` (200, ~7.9 KB JSON, no auth, CORS `vary: Origin`). An unknown id returns **404**.

```jsonc
{
  "businessId": "1",                      // canonical id (replaces URL token)
  "name": "Maple Café",
  "currencyCode": "GBP",
  "venueType": null,                      // "pub"|"bar" → 18+ consent copy, else 13+
  // CRM switches (absent = ON for crm*Enabled switches; absent = OFF for ask flags)
  "customerContactEnabled": false,
  "crmEnabled": false,                    // master CRM flag
  "crmConsentAskEnabled": false,          // show marketing-consent checkbox
  "crmWifiCaptureEnabled": false,         // email gate in front of Wi-Fi
  "crmFeedbackCaptureEnabled": false,     // rewards join on feedback thank-you
  "crmBirthdayAskEnabled": false,         // birthday picker
  // Wi-Fi (the client also accepts wifiSsid/ssid/wifi.ssid etc. as aliases)
  "wifiSSID": "SoDoSoPa",
  "wifiPassword": "Welcomehome",
  "wifiSecurityType": "WPA2",             // "open"/"none"/"nopass" → no password
  "socialMediaLinks": {
    "google": "https://…",                // review URL
    "instagram": "https://…"
    // also: facebook, tripAdvisor, youtube
  },
  "menuSections": [ /* legacy flat sections */ ],
  "menuSettings": { "calorieDisclaimerEnabled": false, "showCalories": false, "photoMenuEnabled": true },
  "menuBranding": { "headerImageURL": "…", "primaryColorHex": "#002212", "secondaryColorHex": "#38571A",
                    "welcomeText": "Welcome to Maple Café", "backgroundColorHex": "#FFFFFF", "disclaimerText": null },
  "menus": [{
    "id": "…", "name": "Lunch",
    "externalUrl": "https://…",           // optional: menu is an external link
    "linkLabelToken": "view_menu|view_price_list|our_services|book_now|visit_website|order_online",
    "linkLabelCustom": "…",               // optional custom label
    "sections": [{ "id": "…", "name": "Brunch & Light Plates", "sortOrder": 0,
      "items": [{ "id": "…", "name": "…", "itemDescription": "…", "priceInPence": 1150,
                  "isAvailable": true, "allergens": ["milk", "eggs", …], "dietaryTags": ["vegan"],
                  "calories": 420, "imageURL": "…|null", "modifiers": [] }] }],
    "settings": { … }, "branding": { … }
  }],
  "loyaltyProgram": {
    "programId": "…",
    "rewardName": "Free Meal",
    "stampsRequired": 10,
    "stampsEnabled": true,                // false → "rewards-only" programme
    "rewardTiers": [
      { "rewardName": "Free Coffee", "stampsRequired": 8 },
      { "rewardName": "Free Meal",   "stampsRequired": 10 }
    ]
  },
  "clipBranding": {
    "coverImageURL": "…", "logoURL": "…",
    "titleOverride": "Maple Café",        // legacy key: welcomeText
    "tagline": "Simply good coffee",
    "backgroundColorHex": "#FFFFFF",
    "appearance": "light|dark",           // optional card-chrome override
    "style": "classic|editorial|modern",  // optional font preset
    "showGoogleReviewButton": true,
    "sudokuEnabled": true,
    "showLogo": null,
    "featureOrder": ["loyalty", "googleReview", "menu", "wifi", "feedback"]
  },
  "externalLinks": [                      // optional custom link cards
    { "id": "…", "url": "https://…", "labelToken": "book_now", "labelCustom": "…", "icon": "calendar" }
  ]
}
```

---

## 6. Page layout & visual spec

### 6.1 Wireframe (mobile)

```
┌───────────────────────────────────────┐
│          COVER IMAGE  (200px tall,    │  full-bleed 100vw, object-fit: cover
│          full viewport width)         │
│  ╭─────╮                              │
│  │LOGO │  Maple Café         (22/600) │  logo 100×100 circle, overlaps cover by -55px
│  ╰─────╯  Simply good coffee (15/400) │  3px border = page bg, shadow 0 4 12 .2
│                                       │
│ ╭───────────────────────────────────╮ │  card: radius 16, shadow 0 3 6, 0.5px border
│ │ (♥)  Start earning rewards       › │ │  padding 14/16, gap 12, height ≈72px
│ ╰───────────────────────────────────╯ │  12px gap between cards
│ ╭───────────────────────────────────╮ │
│ │ (G)  Leave a Google Review       › │ │
│ ╰───────────────────────────────────╯ │
│ ╭───────────────────────────────────╮ │
│ │ (≡)  View Menu                   › │ │
│ ╰───────────────────────────────────╯ │
│   … Wi-Fi, Suggestion Box, Sudoku …   │
│                                       │
│               [ IG ]                  │  56×56 social icons, gap 20, centred
│                                       │
│            ♥ Candour                  │  footer, Fraunces 17px/630, 70% text colour
└───────────────────────────────────────┘
```

### 6.2 Measured dimensions (desktop 1536px viewport, `i=1`)

| Element | Measured | CSS source |
|---|---|---|
| `.page-wrapper` | 500px wide, centred | `max-width: 500px; margin: 0 auto; padding-bottom: env(safe-area-inset-bottom, 20px)` |
| `.cover` | 200px tall, full viewport width | `width:100vw; left:50%; transform:translateX(-50%)` |
| `.logo-circle` | 100×100 | `margin-top:-55px; border:3px solid var(--logo-border-color); box-shadow:0 4px 12px rgba(0,0,0,.2)` |
| `.header-row` | flex, gap 14 | `padding:4px 16px 0`; `.no-logo` centres text; `.no-cover` adds `padding-top:16px` |
| `h1` | 22px / 600 / lh 1.25 | `rgb(26,26,26)` on light bg |
| `.tagline` | 15px / 400 / lh 1.3 | 70%-alpha text colour |
| `.feature-grid` | single column | `padding:20px 16px 16px` |
| `.feature-wrapper` (card) | 468×74 | `radius 16; box-shadow 0 3px 6px var(--card-shadow); border .5px solid var(--card-border); margin-bottom 12px; overflow hidden` |
| `.feature-card` (row) | 466×72 | `display:flex; align-items:center; gap:12px; padding:14px 16px; cursor:pointer` |
| `.icon-circle` | 44×44 circle; SVG 20×20 | background = feature colour + `26` hex alpha (≈15%) |
| `.feature-label` | 15px / 600 / lh 1.3 | `flex:1` |
| `.chevron` | `›` (U+203A) 16px / 600 | tertiary colour; rotates **90°** on `.expanded` (0.3 s ease) |
| `.feedback-social-links` (landing) | 56px row | `flex; justify-content:center; gap:20px; margin-top:-10px` |
| `.powered-by` | 67px tall | `padding:24px 16px 20px`; heart SVG 22.5px tall |

### 6.3 Colour palette

**Base tokens (`:root`, light default):**

| Token | Value | Use |
|---|---|---|
| `--page-bg` | `#FFFFFF` (overridden by brand) | body |
| `--card-bg` | `#FFFFFF` / dark cards `#262626` | cards, sheets |
| `--text-primary` | `#1A1A1A` (light bg) / `#FFFFFF` (dark bg) | set by JS |
| `--text-secondary` | primary @ 70% alpha | tagline, footer |
| `--text-tertiary` | primary @ 50% alpha | chevrons, placeholders |
| `--separator` | `rgba(60,60,67,.12)` / dark `rgba(84,84,88,.34)` | sheet top border, field rows |
| `--card-shadow` | `rgba(0,0,0,.1)` | |
| `--card-border` | `rgba(0,0,0,.06)` / dark `rgba(255,255,255,.15)` | |
| `--input-bg` | `#F2F2F7` / dark `#3A3A3C` | inputs, secondary buttons, reward tiles |
| `--input-border` | `#D1D1D6` / dark `#48484A` | |
| `--success-green` | `#34C759` (dark scheme `#30D158`) | ticks, Wi-Fi hint box |
| `--error-red` | `#FF3B30` (dark scheme `#FF453A`) | errors, sudoku clashes |
| `--accent-blue` | `#1447E6` light cards / `#5B8DEF` dark cards | feedback submit, error "Try Again" |

**Feature accent colours** (icon circle bg = colour @ 15%, glyph = colour):

| Feature | Hex |
|---|---|
| Menu | `#FF9500` (orange) |
| Wi-Fi | `#4DC778` (green) |
| Loyalty | `#D94D66` (rose). Also the Join button bg, input focus border and checkbox accent |
| Sudoku | `#7D59D9` (purple); dark-card variant `#B79BFF` |
| Feedback | `#1447E6` (blue, follows `--accent-blue`) |
| Google review | no tint: card-bg circle with 1px `rgba(128,128,128,.15)` border and the 4-colour Google "G" |
| External links | `#9C27B0` (magenta) |
| Reward-tier chips (cycle) | `#FF9F0A`, `#D94D66`, `#5B8DEF`, `#34C759`, `#AF52DE` @ `22` alpha |
| Google review button | `#4285F4`, hover `#3367D6` |
| Wallet button | `#000` bg, white text |

### 6.4 Typography

- **UI font:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`, antialiased.
- **Scale:** 22 (h1) · 18/700 (sheet h3) · 17/600 (primary buttons) · 16 (inputs; 16px avoids iOS zoom-on-focus) · 15 (labels, values) · 14 (secondary text, sheet buttons) · 13 (reward names, sudoku controls) · 12 (sub-labels, badges) · 8 (sudoku pencil marks).
- **Footer wordmark:** Fraunces opsz 9, wght 630, letter-spacing −0.006em.
- **Note:** `.sheet-btn` does not set `font-family: inherit`, so the Wi-Fi Copy buttons render in the browser's default button font (visibly Arial on Windows). This is a minor bug; don't replicate it.

---

## 7. Theming / branding engine

`applyBranding(clipBranding)` runs right before render:

1. `bg = backgroundColorHex || "#FFFFFF"` → sets `--page-bg` and `--logo-border-color`. **A missing colour always means white; the page never follows the OS dark mode.**
2. `isLightReal` = WCAG relative luminance of `bg` > **0.45**.
3. `isLightCards` = `appearance === "light"` → true, `"dark"` → false, otherwise `isLightReal`.
4. Page-level text vars (`--text-*`) follow `isLightReal`. Card-level vars (`--card-text-*`) follow `isLightCards`. Primary is `#1A1A1A` or `#FFFFFF`; secondary and tertiary are the same RGB at 0.7 and 0.5 alpha (never a fixed grey, so they stay legible on any brand colour).
5. Card chrome swaps between the light and dark token sets in §6.3, including the sudoku palette and `--accent-blue`.
6. `applyStyle(style)`: for `classic` / `editorial` / `modern` it sets `#content[data-landing-style]` and lazily injects the Google Font link (only then, so cold QR loads don't fetch fonts):
   - `classic` → "Playfair Display SC", weight 400
   - `editorial` → Petrona 400/600
   - `modern` → Outfit 400/600, `text-transform: uppercase; letter-spacing: .06em`
   - Applies only to `h1`, `.tagline` and `.feature-label`.

**Header resolution:**
- Title = `titleOverride` (else legacy `welcomeText`). Whitespace-only means **hide the title**. Otherwise it falls back to the business `name`, and if that is empty no title is drawn.
- Tagline = trimmed `tagline` or nothing.
- No cover → `.no-cover` variants. No logo → text centred. None of logo/title/tagline → the header row is omitted entirely.

---

## 8. Feature cards — selection, ordering, rendering

**`buildFeatures(data)` availability rules (default order):**

1. `loyalty` when a stamp programme exists (`loyaltyProgram.rewardName` and `stampsEnabled !== false`) **or** it's rewards-only (`stampsEnabled === false`).
2. `menu` when `menuSections` is non-empty or `menus[0].externalUrl` is a valid `http(s)` URL. An invalid URL hides the card and fires `menu_external_url_open_failed{reason:"invalid_url"}`.
3. `wifi` when an SSID is non-empty.
4. `sudoku` unless `clipBranding.sudokuEnabled === false` (on by default).
5. `feedback`: **always** present.
6. `google_review` when `clipBranding.showGoogleReviewButton` is set and `socialMediaLinks.google` exists.
7. `link:<id>` for each `externalLinks[]` entry that has an id.

**`applyFeatureOrder(features, clipBranding.featureOrder)`:** listed keys come first in the given order (`googleReview` → `google_review`). Anything unlisted keeps its default order after them. The order can reorder cards but never add or remove one.

**Card markup:**

```html
<div class="feature-wrapper">
  <div class="feature-card" data-feature="wifi" role="button" tabindex="0" aria-label="Connect to Wi-Fi">
    <div class="icon-circle" style="background:#4DC77826;color:#4DC778;"><svg…/></div>
    <span class="feature-label">Connect to Wi-Fi</span>
    <span class="chevron" aria-hidden="true">›</span>
  </div>
  <section id="wifiSheet" class="sheet" aria-live="polite"><div class="sheet-inner">…</div></section>
</div>
```

**Expand/collapse ("sheet") mechanics:**
- `.sheet { max-height: 0; overflow: hidden; transition: max-height .45s ease }`
- `.sheet.open { max-height: 600px; border-top: .5px solid var(--separator) }`. Feedback raises this to 1100px and Sudoku to 1400px.
- Tapping toggles `.open` on the sheet and `.expanded` on the card (chevron rotates 90°).
- **Sheets are independent, not an accordion:** several can be open at once (verified live).
- When a sheet opens, `scrollIntoView({behavior:"smooth", block:"start"})` fires after 350 ms.
- Keyboard: Enter/Space on a focused card triggers it.

**Icon set (inline SVG, 24×24 viewBox, stroke 2, Lucide-style):** menu, list, calendar, globe, cart, link, ticket, event, music, food, drink, coffee, delivery, gift, offer, location, phone, email, hours, info, document, star, heart, camera, jobs, wifi, loyalty (filled heart), sudoku (grid), suggestion_box (archive box), refresh, feedback (filled speech bubble), checkmark, google_review (4-colour G).

---

## 9. Feature: Loyalty (stamp card)

**Sheet contents:**
- Heart icon 48px `#D94D66`, `h3` = business name (18/700).
- Description:
  - **Multiple tiers** → "Collect stamps to earn rewards" plus a **rewards grid** of tiles (`--input-bg`, radius 12, padding 14/12). Each tile has a 36px number circle (stamps required, tier colour) and the reward name (13/600). Grid layout adapts to count: 2 → side by side; 3 → 2 columns with the last tile full-width; 4 → 2×2; 5 → 2 columns with the last full-width.
  - **Single reward** → "Collect {stamps} stamps to earn a {reward}" (reward lower-cased first letter).
- Form (`.loyalty-form`, flex column gap 12):
  - `input[type=text]` "Your name" (`autocomplete=name`)
  - `input[type=email]` "Email address" (`inputmode=email`)
  - Birthday month/day selects (only when the CRM consent box shows **and** the birthday ask is on)
  - Consent checkbox (only when `crmEnabled && crmConsentAskEnabled`): "Email me offers and news from {business}. I confirm I'm 13 or over." (18+ for pub/bar), plus a "Privacy notice" link
  - **"Join Loyalty Program"** button: full width, 15px padding, radius 12, `#D94D66`, white 17/600. Starts `disabled` but keeps **full opacity** (`opacity:1`), so it looks active.
- Inputs: padding 14, radius 10, 1px `--input-border`, bg `--input-bg`, 16px. Focus border is `#D94D66`.

**Validation (live, on every `input` event):** name non-empty **and** email passes a hand-rolled check (exactly one `@`, non-empty local part, domain contains `.` not at start or end). Result toggles `disabled`. A click while invalid shows "Please enter your name and a valid email address." (defensive only).

**Submit flow (code only; not submitted, to avoid writing to their production DB):**
1. Event `loyalty_signup_started`. Button → disabled, text "Enrolling...". Error hidden.
2. `POST enrollCustomer` (30 s timeout) with body `{businessId, customerName, customerEmail(lowercased), locale, [marketingConsent, ageAttested], [databaseId]}`.
3. The response carries `customerId`, `wasExisting`, `passEmailed`, `passBase64` (Apple .pkpass), `googleWalletUrl`, `confirmationPending`.
4. **Success panel** replaces the form:
   - × close button (32px, top-right) collapses the sheet
   - Green check-in-circle SVG (52px)
   - h3: "You're enrolled!" or "You're already enrolled in this loyalty program!"
   - Text: "Your pass was sent to a•••e@gmail.com - check your inbox and spam." (email masked to first char + ••• + last char), or "We couldn't email your pass - ask us to resend it."
   - If `confirmationPending`: "Check your inbox to confirm."
   - **Wallet button** (§9.1)
   - Birthday saved fire-and-forget if the consent box was ticked
5. **Failure** → red "Something went wrong. Please try again."; button restored to "Join Loyalty Program".

### 9.1 Wallet pass button

- Platform from the user agent: iOS/Mac → **Apple**, everything else → **Google**.
- Apple: `<a class="wallet-btn" download="loyalty.pkpass">Add to Apple Wallet</a>`. `href` = `URL.createObjectURL(Blob(atob(passBase64), "application/vnd.apple.pkpass"))`. If decoding fails, the button is hidden.
- Google: `href = googleWalletUrl`, **only if** it starts with `https://pay.google.com/` (XSS guard). Opens in a new tab.
- Style: black, white 16/600, radius 12, padding 14, full width, margin-top 12.
- Events: `wallet_button_shown{wallet_type, shown:1|0, context}` and `wallet_pass_added` on tap.

---

## 10. Feature: Rewards-only join

Used when `loyaltyProgram.stampsEnabled === false` (a membership without stamps). It reuses the same "Start earning rewards" card and `#loyaltySheet` id.

- Header: heart, business name, "Your rewards land on a pass in your Apple Wallet."
- Form: "First name", "Email address", optional birthday, then a consent statement *without* a checkbox ("{business} will send you your pass and your rewards." + Privacy link) and **one** checkbox holding the 13+/18+ consent sentence (sent as `ageAttested`).
- The button ("Start earning rewards") is **not** disabled up front. Validation happens on click: an invalid email shows "We need an email address to send your rewards."
- `POST enrollCustomer` body: `{businessId, customerEmail, captureSource:"rewards", joined:true, ageAttested, locale, door:"home"|"feedback"|"wifi_gate", [firstName], [databaseId]}`. There's no `customerName` or `initialStamps`.
- Success: "You're in - here's your rewards pass." + pass line ("Your pass is on its way to {email}." / "You're already a member - we sent your pass to {email}.") + optional confirm notice + Wallet button.
- Stores `candour.customer.<businessId>` = `customerId` (so the Wi-Fi gate is skipped later) and retires any open Wi-Fi gate on the page.

---

## 11. Feature: Wi-Fi (+ email capture gate, birthday)

### 11.1 Plain mode (observed for `i=1`: `crmEnabled=false`)

Sheet content:
- *(iOS only)* a green "⚡ Connect instantly — Tap "Open" in the banner above…" row. Clicking it scrolls to the top, where iOS Safari shows the App Clip Smart Banner.
- Three `.field` rows (label 14px secondary left, value 15/600 right, 1px separator): **Network (SSID)**, **Security**, **Password**. Open networks show "No password required". Missing values show "Not provided".
- `.sheet-actions` (flex wrap, gap 8): **Copy SSID**, **Copy Password** (disabled when open or empty; opacity .4), **Open Wi-Fi Settings**. Button style: padding 10/14, radius 10, bg `--input-bg`, 14/600.
- `.hint-box`: green 4px left border, 10% green bg, radius 0 8 8 0. Text: "Copy the password, then open Wi-Fi settings and paste it when prompted." (open network: "This is an open network…").

Behaviours:
- **Copy** uses `navigator.clipboard.writeText`, falling back to a hidden textarea + `execCommand("copy")`. The button text flashes **"Copied!"** (or "Failed") for **1.5 s**, then reverts.
- **Open Wi-Fi Settings** depends on the platform:
  - Android: `intent:` URL. If the page is still visible after 600 ms, `alert("Open your device Wi-Fi settings…")`.
  - iOS: `App-Prefs:root=WIFI` → `prefs:root=WIFI`.
  - Mac / Windows / other: `alert()` with OS-specific instructions.

### 11.2 Email capture gate (code only; active when `crmEnabled && crmWifiCaptureEnabled !== false && crmConsentAskEnabled === true`)

- If localStorage `candour.customer.<businessId>` exists, the guest is recognised: credentials show immediately, and a `crmRecordVisit{type:"wifi_tap"}` fires on the tap (once per session).
- Otherwise **credentials are not in the DOM**. The sheet shows:
  - "Enter your email to get online." / Email / First name / consent line(s)
  - Primary (if a programme exists): **"Join the Wi-Fi and start your stamp card with a free stamp."** (stamp venue) or "Start earning rewards - we'll email you your pass." (rewards-only)
  - Secondary: **"Just the Wi-Fi, thanks."**
- Email is required ("We need an email address to get you online."). Consent is never required.
- The offer path posts `enrollCustomer{initialStamps:1, captureSource:"wifi", …}`. **If it fails, the Wi-Fi is still revealed.**
- The Wi-Fi-only path posts `crmCaptureGuest{email, marketingConsent, ageAttested, locale, source:"wifi"}`. **If it fails, an error shows and nothing is revealed** (retry allowed).
- On completion: remember the customer, hide the gate, show the pass line and confirm notice, reveal the credentials, then maybe ask for a birthday.
- **Birthday prompt** (only if `crmBirthdayAskEnabled === true` and consent was given): "Add your birthday for a treat on us", Month (1–12) and Day (1–31) selects, **Save** / **Skip**. Skip escalates `candour.bday.<id>` "1" → "2" (stops asking after two skips) and posts `crmSetBirthday{skipped:true}`. Save posts `{month, day}` (no year, ever).
- Closing the sheet with the gate still visible → `wifi_gate_abandoned`.

---

## 12. Feature: Feedback / Suggestion box (+ sentiment routing)

### 12.1 Card A/B test

On first visit, localStorage `candour_feedback_cta_variant` is set to a random `cta_box` or `cta_anon` (50/50). It's recorded as the GA user property `landing_variant`.
- `cta_box` → label **"Suggestion Box"** with the archive-box icon (observed)
- `cta_anon` → label **"Leave Anonymous Feedback"** with the speech-bubble icon

### 12.2 Sheet

- Intro text: "Share your honest thoughts" (14px secondary).
- `textarea#feedbackText`: placeholder "What went well? What didn't?", min-height 120, radius 10, 16px, `resize: vertical`, focus border `#5B8DEF`.
- **"Add photo"** pill button: transparent, 1px border, radius 100, camera icon (§13).
- Photo preview: hidden until a photo is picked.
- **"Send Anonymous Feedback"**: full width, `--accent-blue`, 17/600, radius 12. **Disabled (grey tertiary bg) until the textarea has non-whitespace text.** Verified live: typing enables it.

**Opening trick (mobile keyboard):** on tap, a hidden 0×0 `<input>` is created and focused *synchronously* inside the user gesture, so iOS opens the keyboard. After 500 ms, focus moves to the textarea, which is scrolled to centre, and the temp input is removed. Verified: `document.activeElement` = `feedbackText` after opening.

Events: `feedback_expanded` on open, `feedback_started` on the first textarea focus.

### 12.3 Submit flow (code only; not submitted)

1. One submission per page load (`feedbackSubmittedThisSession`). The button is disabled, text goes transparent, and a centred **24px white spinner** (`feedbackSpin` 0.8 s linear) shows.
2. **In parallel:** `POST https://language.googleapis.com/v1/documents:analyzeSentiment?key=<public key>` with `{document:{type:"PLAIN_TEXT", content}, encodingType:"UTF8"}` → `documentSentiment.score` ∈ [−1, 1]. Any failure counts as 0.
3. **Optimistic UI:** after **800 ms**, the thank-you renders once sentiment resolves. The feedback POST itself is fire-and-forget, and its errors are ignored and never shown.
4. `POST submitSuggestionEU` body: `{suggestion, business: businessId, rating: sentimentScore, source: "web-<s>", [imageBase64], [databaseId]}`.
5. Thank-you is rendered with a crossfade (opacity → 0 over 0.2 s, swap at 200 ms, back to 1).

### 12.4 Thank-you routing (the key business logic)

Always shown: × close, green check (52px), **"Thank you!"**, "Your feedback has been sent."

Then, with `positive = score > 0.5`, the **first matching branch** wins:

| # | Condition | Extra UI |
|---|---|---|
| 1 | Stamp programme exists and the user hasn't enrolled this session | **"You've earned a free stamp! Join {business}'s loyalty programme to claim it."** + name/email form + **"Join & Get a Free Stamp"**. *Then*, if positive and a Google URL exists: "Tap to leave a review - we'll copy your feedback so you can paste it." + blue **"Leave a Google Review"** button |
| 2 | Rewards-only, feedback capture on, not joined | Rewards join form ("Start earning rewards from {business} - we'll add them to a pass in your Wallet.") + the same Google ask if positive |
| 3 | Positive and a Google URL exists | "Tap to leave a review…" + **Google button** as the primary ask, + other social icons below |
| 4 | Positive, social links but no Google | "Glad you enjoyed it! A review would mean a lot." + social icons |
| — | Otherwise (neutral/negative, no programme) | Just the thank-you |

**Google button behaviour:** copies the user's **feedback text to the clipboard**, then opens the review URL (so the user can paste it). If the URL host is `candour.app` (a demo placeholder), an `alert()` pitch shows instead.

**"Zeus" free-stamp join (branch 1):**
- Same validation as §9. `POST enrollCustomer{initialStamps:1}`.
- New member → heart icon + "You're enrolled!" + email copy + Wallet button, then the Google nudge if positive. It also updates the main loyalty sheet to its success state.
- **Existing member** (`wasExisting`) → `POST stampForFeedback{businessId, customerEmail}`:
  - `stamped:true` → **"Stamp added!"** + (Apple: "If you've added your pass to Apple Wallet, it updates automatically." then a background `enrollCustomer` call to fetch a refreshed .pkpass that swaps in a Wallet button) or (others: pass-email copy).
  - `stamped:false` → "No stamp this time - show your card on your next visit." (cooldown/throttle, deliberately neutral)
  - Error → red error, button restored.

---

## 13. Camera / gallery photo attachment

**Markup (inside the feedback form):**

```html
<button class="photo-trigger" id="photoTriggerBtn">[camera svg] Add photo</button>
<input type="file" id="photoInputCamera"  accept="image/*" capture="environment" class="photo-hidden-input">
<input type="file" id="photoInputLibrary" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" class="photo-hidden-input">
<div class="photo-preview hidden"><img id="photoPreviewImage"><button class="photo-remove">×</button></div>
```

The hidden inputs are **positioned off-screen** (`left:-9999px; 1×1; opacity 0`) rather than `display:none`, because iOS Safari needs a real layout box to open the camera picker.

**Platform split:**
- **iOS** (UA, `iP(hone|od|ad)` platform, or iPadOS-as-Mac with touch): the trigger calls `libraryInput.click()` directly, and iOS's native action sheet already offers Camera / Photo Library.
- **Everyone else:** a custom **Material 3 bottom sheet** (`#photoSheet`, static in `<body>`, `z-index:10000`), verified live:
  - Scrim `rgba(0,0,0,.45)`, fade 0.25 s. Tapping it closes the sheet.
  - Panel pinned to the bottom, **full viewport width** (not constrained to 500px), top radius **28px**, shadow `0 -8px 32px rgba(0,0,0,.18)`, slides up via `translateY(100%→0)` over 0.28 s `cubic-bezier(.3,0,0,1)`, bottom padding `24px + safe-area`.
  - Drag handle 32×4 (decorative, not draggable).
  - Two rows (padding 18/24, gap 16, 24px icons, 16px text): **"Take photo"** → `cameraInput.click()` (rear camera); **"Choose from gallery"** → `libraryInput.click()`.
  - `Escape` closes it. `body` overflow is locked while it's open. It has `role="dialog" aria-modal="true"`.

**Processing (`compressImage`):** FileReader → `Image` → canvas, longest side scaled down to at most **1200px** → `toDataURL("image/jpeg", 0.7)`. The base64 (without the prefix) is kept in memory and sent as `imageBase64` in the feedback POST. There's no separate upload endpoint and no size check beyond compression.

**Preview:** full-width image, `max-height:280px; object-fit:cover`, radius 12. A 32px round **remove** button (top-right, `rgba(0,0,0,.6)` + `backdrop-filter: blur(4px)`) clears the state and resets both inputs. The "Add photo" pill is hidden while a photo is attached (one photo max).

**Error:** decode/read failure → `alert("Could not load that image. Please try a different one.")` (not localised).

---

## 14. Feature: Google review, Menu, External links, Social row

- **Google review card:** `window.open(socialMediaLinks.google, "_blank", "noopener")`. The demo placeholder URL on `candour.app` shows an `alert()` pitch instead. Event: `google_review_tapped{from_context:"landing_page", placeholder}`.
- **Menu card:** external URL → new tab (fallback: same tab if the popup is blocked). Otherwise → `menu.html?<same params>`. The label and icon can be customised via `linkLabelToken` / `linkLabelCustom` ("View Price List", "Our Services", "Book Now", "Visit Website", "Order Online"; custom → link icon).
- **`menu.html`** (separate page, only skimmed): header bar with the business name, "copy" and "filter" icons; horizontally scrolling section chips (jump bar); welcome text; search box; sections with items (name, description, dietary chip e.g. "Vegan"/"Vegetarian" in green, price `£11.50` from `priceInPence`, red "Contains: Gluten, Eggs, Fish, Milk" allergen line); allergen filter sheet; item detail sheet; photo-feed mode; image overlay; loading spinner "Loading menu..."; error + retry. It's worth a separate analysis if we clone the menu.
- **External link cards:** rendered as `<a class="feature-card" target=_blank>` with a magenta icon and **no chevron**. The URL must be `http(s)` or the card is dropped. Icons come from a 23-token allow-list. Event: `external_link_tapped{link_id, label_token, is_custom, position}`.
- **Landing social row:** Facebook → Instagram → TripAdvisor → YouTube, each shown only if it's a safe `http(s)` URL. 56×56 PNG icons, gap 20. TripAdvisor/YouTube get a white rounded tile (radius 12) with the logo at 44px. Event: `social_link_tapped{social_platform, from_context:"landing"}`.
- **Footer:** inline heart SVG + "Candour" (not localised).

---

## 15. Feature: Sudoku mini-game

This is a complete game embedded in a sheet (the 81 cells are rendered only on first open). Verified live.

- **Header row:** "Sudoku" (15/600) + a 44px **refresh icon** (New Game). Tapping it shows an inline confirm strip, "Do you want to start a new game?" **Yes / No**, instead of `window.confirm`. Focus moves to "No"; Escape cancels.
- **Top row:** segmented control **Easy | Medium | Hard** (`role=tablist`, selected segment = white raised pill) + timer `mm:ss` (tabular numerals).
- **Board:** 9×9 CSS grid, `aspect-ratio:1`, 2px outer border radius 8. Thick lines at every 3rd row and column. Given digits are bold in primary colour; user digits are in the accent colour; clashes are red.
- **Highlight tiers:** selected cell (30% accent), cells with the same digit (16% accent), peers in the same row/column/box (6% grey).
- **Notes:** pencil marks in a fixed 3×3 sub-grid, 8px.
- **Actions** (4 columns): **Notes** (toggle, `aria-pressed`), **Undo** (disabled with no history; up to 200 snapshots), **Erase** (needs a selection), **Hint**. A hint fixes a wrong entry first ("That square was wrong - the hint fixed it."), otherwise fills the engine's next logical cell.
- **Number pad:** 1–9. Disabled until a cell is selected, and a digit is dimmed once it has been placed 9 times. Tapping the same digit again clears the cell.
- **Keyboard (desktop):** 1–9, Backspace/Delete/0 to erase, arrows to move the selection, Escape. Ignored while focus is in an input.
- Each difficulty keeps its own board. Switching pauses one clock and resumes the other. Closing the sheet pauses the clock.
- **Solved:** "Solved in 04:12" + **New Game** primary button.
- **Engine failure:** "Couldn't start a puzzle." + **Try Again**, which re-injects `sudoku-engine.js`.
- **Engine:** `sudoku-engine.js` = esbuild bundle of `sudoku-gen` 1.0.2 + `fast-sudoku-solver` 3.0.3 (both MIT). `generate(level)` returns `{puzzle, solution}` as 81-char strings from seed puzzles with randomised symmetry and digit relabelling.

---

## 16. API / network requests

**Endpoint base:** `https://europe-west2-suggestion-box-e23b2.cloudfunctions.net/<name>` (a `*Test` twin when `databaseId=test`). All are JSON, all `POST` except the first, and none are authenticated (App Check is not used on this page).

| # | Endpoint | Method | When | Request body / query | Response (used fields) | Timeout |
|---|---|---|---|---|---|---|
| 1 | `fetchSocialMediaLinksEU` | GET | page load | `?businessId=&surface=s[&databaseId=]` | full business object (§5); 404 on unknown | none |
| 2 | `enrollCustomer` | POST | loyalty join, Zeus join, rewards join, Wi-Fi offer, pass refresh | `{businessId, customerEmail, customerName?, firstName?, initialStamps?, captureSource?("wifi"\|"rewards"), joined?, door?, marketingConsent?, ageAttested?, locale, databaseId?}` | `{customerId, wasExisting, passEmailed, passBase64, googleWalletUrl, confirmationPending}` | 30 s (15 s for refresh) |
| 3 | `stampForFeedback` | POST | Zeus join by an existing member | `{businessId, customerEmail, databaseId?}` | `{stamped, currentStamps}` | 15 s |
| 4 | `submitSuggestionEU` | POST | feedback send | `{suggestion, business, rating, source, imageBase64?, databaseId?}` | ignored (fire-and-forget) | none |
| 5 | `crmCaptureGuest` | POST | Wi-Fi gate "Just the Wi-Fi" | `{businessId, email, firstName?, marketingConsent, ageAttested, locale, source:"wifi"}` | `{customerId, confirmationPending}` | 15 s |
| 6 | `crmRecordVisit` | POST | recognised device opens Wi-Fi | `{businessId, customerId, type:"wifi_tap"}` | ignored | 10 s |
| 7 | `crmSetBirthday` | POST | birthday save/skip | `{businessId, customerId, month, day}` or `{…, skipped:true}` | ok/not ok | 10–15 s |
| 8 | Google NL `documents:analyzeSentiment` | POST | feedback send | `{document:{type:"PLAIN_TEXT",content}, encodingType:"UTF8"}` | `documentSentiment.score` | none |
| 9 | GA4 `g/collect` | POST | analytics | — | — | — |
| 10 | Firebase `webConfig` | GET | analytics init | — | — | — |

- **Timeouts** are implemented with `AbortController` + `setTimeout` (not `AbortSignal.timeout`, for older Safari support).
- **Observed on load for `i=1`:** gtag.js, Firebase webConfig, GA collect (which returned **503**, harmlessly), the business fetch, cover/logo images from `firebasestorage.googleapis.com`, `images/instagram.png`, and the Fraunces woff2.

---

## 17. State catalogue: loading / error / success

| Where | Loading | Error | Success |
|---|---|---|---|
| Page | "Loading..." plain centred text (min-h 300) | Red-bordered box (1px `--error-red`, 10% red bg, radius 12, padding 14) with the message + blue full-width **"Try Again"** (re-runs `init`). Messages: "Business ID is missing from this link." / "We could not load business details. Please try again." (verified live) | Landing renders |
| Loyalty join | Button "Enrolling...", disabled | Red centred 14px text "Something went wrong. Please try again." / "Please enter your name and a valid email address." | Green check, "You're enrolled!" / "already enrolled", masked-email copy, confirm notice, Wallet button, × close |
| Rewards join | "Enrolling..." | "We need an email address to send your rewards." / "Something went wrong…" | Heart icon, "You're in - here's your rewards pass.", pass line, Wallet button |
| Wi-Fi copy | — | Button flashes "Failed" 1.5 s | Button flashes "Copied!" 1.5 s |
| Wi-Fi gate | Both buttons disabled | "We need an email address to get you online." / "Something went wrong…" | Gate hides, credentials revealed, optional birthday card |
| Feedback | Button text hidden + white spinner, ≥800 ms | Submit errors swallowed; sentiment failure → score 0 | Crossfade to thank-you + routed CTA (§12.4) |
| Photo | (sync) | `alert()` "Could not load that image…" | Preview with remove button |
| Zeus stamp | "Enrolling..." | red error | "Stamp added!" / "No stamp this time…" |
| Sudoku | — | "Couldn't start a puzzle." + Try Again | "Solved in mm:ss" + New Game |

---

## 18. Local storage, cookies, session state

**localStorage** (every access is wrapped in try/catch, so a blocked storage just degrades):

| Key | Value | Purpose |
|---|---|---|
| `candour_feedback_cta_variant` | `cta_box` \| `cta_anon` | A/B bucket (observed: `cta_box`) |
| `candour.customer.<businessId>` | opaque `customerId` | recognised device → skip the Wi-Fi gate, record visits. **No email or name is ever stored.** |
| `candour.bday.<businessId>` | `"1"`, `"2"`, `"answered"` | birthday-ask ladder |
| `candour_build_claim_token` / `candour_build_claim_code` | token | welcome overlay (demo builders only) |
| `_gcl_ls` | Google Ads linker | set by gtag |

**Cookies:** only Google Analytics (`_ga*`). The app itself sets none.
**sessionStorage:** unused.
**In-memory per-page flags:** `loyaltyEnrolledThisSession`, `rewardsJoinedThisSession`, `feedbackSubmittedThisSession`, `wifiVisitRecordedThisSession`, `photoSelectedBase64`, and the sudoku state.

---

## 19. Analytics events

Sent through `CandourAnalytics.trackEvent` → Firebase `logEvent`. Every event carries `database_id`, `source` (the `s` param), `session_id`, `platform:"web"` and `page:"s"`, plus `business_id` once the id has resolved.

`screen_viewed`, `app_clip_opened{features_shown}`, `feature_card_tapped{feature}`, `feedback_cta_tapped{variant}`, `feedback_expanded`, `feedback_started`, `feedback_submitted{sentiment pos|neu|neg, feedback_length, has_image}`, `photo_attach_tapped{picker}`, `image_source_selected{camera|gallery}`, `photo_removed`, `google_review_prompted`, `google_review_tapped{from_context, placeholder}`, `social_link_tapped`, `external_link_tapped`, `menu_external_url_tapped`, `menu_external_url_open_failed`, `wifi_sheet_opened`, `wifi_copy_ssid`, `wifi_copy_password`, `wifi_connected{device_platform}`, `wifi_gate_shown|abandoned|completed`, `wifi_offer_taken|failed`, `wifi_known_device_connected`, `birthday_prompt_shown|skipped`, `birthday_added`, `loyalty_signup_shown|started|completed|already_enrolled`, `loyalty_stamp_from_feedback`, `rewards_join_shown|tapped|completed|failed`, `consent_confirmation_sent`, `wallet_button_shown{shown 1|0}`, `wallet_pass_added`, `short_code_resolution_failed`, `sudoku_opened`, `sudoku_difficulty_changed`, `sudoku_new_game_tapped`, `sudoku_new_game_confirm_shown|dismissed`, `sudoku_notes_toggled`, `sudoku_hint_used`, `sudoku_puzzle_solved{seconds, hints_used}`.

User property: `landing_variant`.

---

## 20. i18n, responsiveness, accessibility, security

**i18n:** 16 locales are embedded inline: en, ar (RTL), bn, de, es, fi, fr, it, ja, ko, nl, pl, pt-BR, ru, tr, zh-Hans. The locale is picked from `navigator.language` with remaps (`zh*`→zh-Hans, `pt*`→pt-BR), falling back to English. `t(key)` looks up the string and `tf(key, vars)` replaces `{business}`, `{email}`, `{reward}`, `{stamps}`, `{time}` (first occurrence only). About 110 keys. The sudoku board and number pad are forced to `direction:ltr`.

**Responsiveness:**
- It's a single-column, mobile-first layout capped at a **500px** centred column. There are **no media queries** for width; on desktop the column just sits centred on the page background (verified at 1536px).
- The cover is full-bleed via `100vw`. **Quirk:** on desktop with a visible scrollbar, `100vw` exceeds the content width and causes a horizontal scrollbar (observed). Fix: use `width:100%` of the body or `overflow-x:clip`.
- `viewport-fit=cover`, with safe-area insets on the wrapper and the photo sheet.
- Inputs are 16px to stop iOS zoom-on-focus. Tap targets are ≥44px (sudoku, sheet items). `-webkit-tap-highlight-color: transparent` is set everywhere.
- `prefers-color-scheme: dark` only changes the green and red status colours. Everything else follows the brand.
- *(The browser-window resize to 430px didn't take effect in the test harness, so mobile rendering was verified from CSS rather than live. The layout has no width breakpoints, so it's identical apart from the column filling the screen.)*

**Accessibility:**
- Cards are `role=button`/`tabindex=0` with `aria-label`, and respond to Enter/Space.
- Sheets use `aria-live=polite`. Chevrons are `aria-hidden`.
- The photo sheet is `role=dialog aria-modal` and closes on Escape.
- Sudoku uses `role=grid/tablist/tab`, `aria-selected`, `aria-pressed`, a `row, col` label per cell, and `role=status` for results.
- Close buttons carry an `aria-label`.
- Gaps: no focus trap in the photo sheet, and no visible focus styles.

**Security measures worth copying:**
- `escapeHtml()` on every interpolated value.
- `sanitiseExternalUrl()` allows only `http(s)`.
- Google Wallet URLs must start with `https://pay.google.com/`.
- Icon tokens are allow-listed.
- `rel="noopener"` on new tabs.
- Wi-Fi credentials are never put in the DOM before the gate is passed.
- No PII in localStorage.
- Consent checkboxes are never pre-ticked and never required.

**Security weaknesses to avoid:**
- The Google NL API key is called **from the browser** (it's exposed; they rely on key restrictions).
- The sentiment score is computed client-side and sent as `rating`, so it can be spoofed.
- Write endpoints have no bot protection (App Check / reCAPTCHA) on this page.

---

## 21. Assets, ancillary scripts, quirks & recreation notes

### 21.1 Publicly accessible assets (verified 200)

| Asset | Type/size | Recreate? |
|---|---|---|
| `images/facebook.png` | PNG 31 KB | **Use our own**/official brand-kit icons |
| `images/instagram.png` | PNG 66 KB | " |
| `images/tripadvisor.png` | PNG 128 KB | " |
| `images/youtube.png` | PNG 16 KB | " |
| `favicon.ico` | 3 KB | Candour brand, don't copy |
| Candour heart SVG (inline) | — | Candour brand, don't copy |
| All UI icons (inline SVG) | Lucide-style | Use **Lucide** (ISC licence) directly |
| `sudoku-engine.js` | bundle of MIT libs | Use `sudoku-gen` + `fast-sudoku-solver` from npm directly |
| Business images | Firebase Storage URLs | Merchant content |

### 21.2 Ancillary scripts

- **App Clip meta:** `<meta name="apple-itunes-app" content="app-id=6472616973, app-clip-bundle-id=…Clip, app-clip-display=card">` makes iOS Safari show a native App Clip card. Our equivalent would be a PWA or our own App Clip, if we build one.
- **`debug-panel.js`** (`?debug=1`): a draggable floating panel with tabs for env, params, API responses, sentiment and a request log, plus a prod/test DB switch. A good idea for our own QA.
- **`welcome-overlay.js`:** only for a venue owner who just generated a demo at `/build`. If `candour_build_claim_token` is in localStorage, it shows an orange "Claim" pill top-right that opens a "Claim your page" email card (lazy-loads Firebase Functions, App Check and reCAPTCHA Enterprise). It turns into "Get the app" afterwards. This is a **sales-funnel feature** (demo → claim → lead), not part of the customer UX.

### 21.3 Observed quirks / bugs (don't replicate)

1. Horizontal scrollbar on desktop from `.cover { width: 100vw }`.
2. `.sheet-btn` doesn't inherit the font family (renders in the browser's default font).
3. `.join-btn:disabled { opacity: 1 }`: a disabled button looks enabled, with no visual hint about why tapping does nothing.
4. The photo bottom sheet is full-window width on desktop instead of matching the 500px column.
5. `alert()` is used for Wi-Fi instructions, the demo Google placeholder and image errors (not styleable, not localised in one case).
6. Feedback submission is fire-and-forget, so the user sees "Thank you!" even if the POST failed.
7. "Loading..." is plain text with no skeleton, which creates layout shift when content arrives.
8. `max-height` sheet animation with a fixed cap (600/1100/1400px). Content taller than the cap gets clipped, and the animation timing is uneven.

### 21.4 Recommendations for our build (to settle before coding)

- **Stack:** the original is vanilla JS on purpose (fast QR cold start). For our SaaS, something like Next.js/Astro with a static-first customer page (or a tiny Preact/Svelte island) keeps first paint fast while giving us components. The customer page should stay **< 50 KB JS** before interaction.
- **Our own backend:** a single `GET /api/venues/:slug/public` that returns a trimmed version of the §5 shape, plus `POST` endpoints for feedback (multipart or a signed-URL image upload instead of base64-in-JSON), loyalty enrol, stamp, guest capture and birthday. **Compute sentiment server-side** and keep the API key off the client.
- **Keep:** the card list + expandable sheets pattern, the branding engine (luminance → light/dark tokens), feature ordering, the sentiment-routed thank-you (positive → review ask with the feedback copied to the clipboard), the Wallet pass flow, Wi-Fi copy buttons, the platform-aware photo picker, the optimistic 800 ms thank-you, masked email, the localStorage "recognised device", A/B-able labels and the analytics taxonomy.
- **Legal/brand:** build our own copy, name, logo, footer and icons. The *behaviour* is fair to emulate; Candour's trademarks, wording, images and backend are not ours to use. Marketing-consent capture (GDPR/PECR, double opt-in via `confirmationPending`) and the 13+/18+ age line are there for compliance reasons we need to handle too.
- **Open questions for scope:** do we need Apple/Google Wallet passes in v1 (requires an Apple developer cert and a Google Wallet issuer account)? The Wi-Fi email gate / CRM? Sudoku? The multi-language dictionary (which locales)?

### 21.5 Not verified live (code only)

Any POST (loyalty/rewards join, feedback submit, stamp, Wi-Fi gate, birthday). We deliberately didn't submit, because they write to Candour's production database and send emails. Also not verified: the success states, the Wallet button rendering, the iOS-specific branches, the Arabic RTL rendering, the style presets, and the Wi-Fi gate (disabled for `i=1`). All of these are documented from the shipped source above.

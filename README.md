# Tabletap — self-serve QR pages for hospitality venues

Venue owners sign up, answer four onboarding questions and get a live guest page with printable QR codes, all without help from us. A guest who scans a table QR code gets the menu, Wi-Fi, a loyalty card, feedback that routes happy guests to Google reviews, and a Sudoku to pass the time. Owners manage everything from a dashboard and pay per venue for Pro features. Guest-page behaviour is modelled on the analysis in [docs/candour-analysis.md](docs/candour-analysis.md), with our own brand, copy and backend.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (vitest)
pnpm lint
pnpm build && pnpm start
```

Requires Node 22+ (the database uses the built-in `node:sqlite`). The SQLite file, uploaded images and feedback photos live in `./data/` (override with `DATA_DIR`). Migrations run automatically on start; restart the dev server after pulling a schema change.

### Try the owner flow locally

1. Open `/signup` and create an account. You land in the onboarding wizard, and the venue starts on a 14-day Pro trial.
2. Edit the guest page, menu and loyalty settings from the dashboard. The phone preview reloads on save.
3. Download QR codes or a print sheet of table cards from **QR codes**.
4. Emails aren't sent in development. They go to the `outbox` table and the server log, so copy the verification or reset link from there.
5. To see `/admin`, put your email in `ADMIN_EMAILS` and verify it.
6. Billing runs in **dev mode** without Stripe keys: "Upgrade" switches Pro on instantly and "Cancel" switches it off.

Three demo venues are seeded on first start (Pro, no owner):

| URL | Shows |
|---|---|
| `/s?i=demo` | Stamp card with reward tiers, hosted menu, plain Wi-Fi, Sudoku |
| `/s?i=demo-crm` | Dark pub theme, Wi-Fi email gate, marketing consent (18+), birthday ask |
| `/s?i=demo-rewards` | Rewards-only membership, external ordering link, custom link cards |

## Plans

| | Free | Pro (per venue) |
|---|---|---|
| Guest page, hosted or linked menu, Wi-Fi, feedback + Google review routing, links, socials, QR codes, scan stats | ✓ | ✓ |
| Stamp cards and members club | | ✓ |
| Guest capture: Wi-Fi email gate, marketing consent, birthdays, join after feedback | | ✓ |
| Typography presets, no "Powered by" footer, guest CSV export | | ✓ |

The plan is applied when the guest page is served (`applyEntitlements`), so a lapsed subscription switches features off without losing the owner's settings. Plans and prices live in `src/lib/plans.ts`.

## Going to production

1. **Host on a server with a persistent disk**, such as Railway, Fly.io, Render or a VPS, and mount a volume at `DATA_DIR`. SQLite and uploads are files, so serverless hosts like Vercel would lose them. Run a single instance, because rate limits are kept in memory.
2. **Set `APP_URL`** to your public origin (e.g. `https://tabletap.app`). It's encoded into every QR code, so it must never change.
3. **Email:** create a [Resend](https://resend.com) account, verify your sending domain, then set `RESEND_API_KEY` and `MAIL_FROM`.
4. **Stripe:**
   1. Create a Product with a monthly recurring Price, and set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`.
   2. Add a webhook endpoint at `https://<your-domain>/api/billing/webhook` for `checkout.session.completed` and `customer.subscription.created`, `.updated` and `.deleted`, then set `STRIPE_WEBHOOK_SECRET`.
   3. Turn on the Customer Portal in the Stripe dashboard.
   4. Without keys in production, billing is disabled and the UI says so.
5. **Set `ADMIN_EMAILS`** to your own address(es).
6. **Back up `DATA_DIR`**: snapshot the volume, or use [Litestream](https://litestream.io) for continuous SQLite replication.
7. **Get the starter [terms](src/app/terms/page.tsx) and [privacy notice](src/app/privacy/page.tsx) reviewed by a lawyer.**

## Configuration

| Env var | Purpose |
|---|---|
| `APP_URL` | Public origin encoded into QR codes and links (falls back to the request host) |
| `DATA_DIR` | Where the SQLite database, media and feedback photos are stored |
| `ADMIN_EMAILS` | Comma-separated emails allowed into `/admin` (the email must be verified) |
| `RESEND_API_KEY` | Sends email through Resend; without it emails only go to the `outbox` table and log |
| `MAIL_FROM` | Sender for all emails, e.g. `Tabletap <hello@tabletap.app>` |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` | Stripe Checkout and Customer Portal for the Pro plan |
| `STRIPE_WEBHOOK_SECRET` | Verifies `/api/billing/webhook` |
| `BILLING_DEV_MODE` | `1` allows dev-mode billing in a production build (for staging only) |
| `NEXT_PUBLIC_PRO_PRICE_LABEL` | Price shown on the pricing page (default "£19 / month per venue") |
| `NEXT_PUBLIC_BRAND_NAME` | Product name in the footer and titles (default "Tabletap") |
| `GOOGLE_NL_API_KEY` | Optional: Google Cloud Natural Language for sentiment (a built-in lexicon is used otherwise) |
| `APPLE_PASS_CERT_PATH`, `GOOGLE_WALLET_ISSUER_ID` | Reserved for Wallet passes (not implemented yet; the web card is used instead) |

## Routes

**Owners**

| Path | What |
|---|---|
| `/` | Marketing page with pricing and demos |
| `/signup`, `/login`, `/forgot-password`, `/reset-password` | Accounts (email + password) |
| `/onboarding` | Four-step wizard that creates a venue |
| `/dashboard` | Venue list (or straight into your only venue) |
| `/dashboard/<venue>` | Overview: scans, guests, feedback, setup checklist |
| `/dashboard/<venue>/design`, `/menu`, `/loyalty` | Editors for the guest page, menus and loyalty/capture |
| `/dashboard/<venue>/guests`, `/feedback` | Guest list (CSV on Pro) and feedback inbox |
| `/dashboard/<venue>/qr`, `/qr/print` | QR downloads (PNG/SVG, per-table sources) and printable table cards |
| `/dashboard/<venue>/billing`, `/settings` | Plan, venue details, page address, delete venue |
| `/dashboard/account` | Name, password, delete account |
| `/admin` | Operator view: all accounts and venues, suspend, comp Pro |

**Guests**

| Path | What |
|---|---|
| `/s?i=<code>&s=<source>` | Landing page (server-rendered, venue theme applied before first paint). `cta=box\|anon` forces the feedback-card A/B variant. |
| `/menu?i=<code>` | Hosted menu: search, section jump bar, allergen filter, dietary tags |
| `/card/<id>?t=<token>` | Member's web card (linked from the enrolment email) |
| `/consent?status=` | Result of the double-opt-in link |
| `/privacy`, `/terms` | Privacy notice and terms of service |
| `/media/<venue>/<file>` | Images uploaded by owners |

**APIs:** `api/auth/*`, `api/account`, `api/dashboard/venues/*` and `api/admin/*` are cookie-authenticated, and their writes are refused from other origins. `api/billing/webhook` is signed by Stripe. The guest APIs (`api/venues`, `api/loyalty`, `api/feedback`, `api/guests`, `api/consent`, `api/events`) are unchanged.

## Security notes

- Passwords are hashed with scrypt. Sessions are random tokens in an HttpOnly, SameSite=Lax cookie, stored hashed in `sessions`. A password reset or change signs out other devices.
- Every dashboard page and API checks venue ownership on the server. `src/proxy.ts` only does an early redirect to the login page.
- Uploads are identified by their bytes (JPEG/PNG/WebP/GIF only, so no SVG) and capped at 5 MB. Guests' feedback photos are only served to the venue's owner.
- Saved configs pass a strict zod schema (`src/lib/venue/schema.ts`): http(s) links only, hex colours only, length limits.

## Code map

- `src/app/` holds the routes: pages and `api/*` handlers.
- `src/components/landing/` holds the guest page. `src/components/dashboard/` holds the owner UI: editors, wizard and shell.
- `src/lib/` holds pure logic shared by client and server: plans, venue schema and entitlements, theme, feature rules, validation, i18n, sudoku, API contracts.
- `src/server/` holds the database, auth, repositories and services. Only route handlers and server pages import it.

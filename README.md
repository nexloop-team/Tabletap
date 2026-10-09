# Tabletap — self-serve QR pages for hospitality venues

Venue owners sign up, answer four onboarding questions and get a live guest page with printable QR codes, all without help from us. A guest who scans a table QR code gets the menu, Wi-Fi, a loyalty card that staff stamp at the till, a private feedback box with a Google review invitation for every guest, and a Sudoku to pass the time. Owners manage everything from a dashboard and pay one yearly subscription per venue. Guest-page behaviour is modelled on the analysis in [docs/candour-analysis.md](docs/candour-analysis.md), with our own brand, copy and backend.

Plans, to-dos, decisions and the change log live in [docs/ROADMAP.md](docs/ROADMAP.md).

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (vitest)
pnpm lint
pnpm build && pnpm start
```

Requires Node 22+. The database is **PostgreSQL**:

- **Locally, with nothing set up**, the app runs an embedded Postgres ([PGlite](https://pglite.dev)) saved in `./data/pg`. Uploaded images and feedback photos go to `./data/` too (override with `DATA_DIR`). Only one process can open that local database at a time.
- **With `DATABASE_URL` set**, it connects to that server instead: Supabase, Neon, AWS RDS or your own Postgres. Moving between hosts is a change of that one URL plus a data copy (`pg_dump` / `pg_restore`).

Migrations run automatically on start; restart the dev server after pulling a schema change.

**Coming from the old SQLite version?** Stop the app, then copy everything across once:

```bash
node scripts/migrate-sqlite-to-postgres.mjs                    # into the local ./data/pg
DATABASE_URL=postgres://… node scripts/migrate-sqlite-to-postgres.mjs   # into Supabase or your server
```

It creates the tables if needed, skips rows that are already there, and with `S3_*` set it also uploads the images.

### Try the owner flow locally

1. Open `/signup` and create an account. You land in the onboarding wizard, and the venue starts on a 7-day free trial (no card).
2. Edit the guest page, menu and loyalty settings from the dashboard. The phone preview reloads on save.
3. Download QR codes or a print sheet of table cards from **QR codes**.
4. Emails aren't sent in development. They go to the `outbox` table and the server log, so copy the verification or reset link from there.
5. To see `/admin`, put your email in `ADMIN_EMAILS` and verify it.
6. Billing runs in **dev mode** without Razorpay keys: "Subscribe" switches the venue on for a year instantly and "Cancel subscription" ends it straight away.

Three demo venues are seeded on first start (free access, no owner):

| URL | Shows |
|---|---|
| `/s?i=demo` | Stamp card with reward tiers, hosted menu, plain Wi-Fi, Sudoku |
| `/s?i=demo-crm` | Dark pub theme, Wi-Fi email gate, marketing consent (18+), birthday ask |
| `/s?i=demo-rewards` | Rewards-only membership, external ordering link, custom link cards |

## Subscription

One plan, billed per venue: **₹999 + 18% GST a year** (₹1,178.82 in total), with a **7-day free trial** and no card needed. Every feature is included.

When a venue has neither a paid subscription nor trial days left, its guest page (and everything guests reach through it: menu, loyalty card, till stamping) goes offline. The owner can still sign in, edit and subscribe, and the page comes back exactly as it was. A failed renewal keeps the page up while Razorpay retries; it goes offline when Razorpay halts the subscription. Prices and the access rules live in `src/lib/plans.ts`.

## Going to production

1. **Database and files:**
   1. Set `DATABASE_URL` to your Postgres.
      - **Supabase:** Project → Connect → copy the **Session pooler** string (IPv4, port 5432), with your database password filled in.
      - **Self-hosted:** `postgres://user:pass@host:5432/tabletap`, plus `DATABASE_SSL=off` if it has no TLS.
   2. For images, set the `S3_*` variables to a bucket.
      - **Supabase:** Storage → create a private bucket `tabletap` → Storage settings → S3 access keys. Use the endpoint shown there (`https://<project>.supabase.co/storage/v1/s3`) and the project's region.
      - **MinIO, R2 or AWS:** use their endpoint and keys.
   3. Without `S3_*`, images stay on the server's disk under `DATA_DIR`. That needs a persistent volume, so it won't work on serverless hosts.
   4. Check both before starting: `node --env-file=.env.local scripts/check-connections.mjs`.
   5. Run a single instance, because rate limits are kept in memory.
   6. Every table has row-level security on with no policies. Supabase's automatic REST API can't read them; the app connects as the tables' owner and isn't affected.
2. **Set `APP_URL`** to your public origin (e.g. `https://tabletap.app`). It's encoded into every QR code, so it must never change.
3. **Email:** create a [Resend](https://resend.com) account, verify your sending domain, then set `RESEND_API_KEY` and `MAIL_FROM`.
4. **Razorpay:**
   1. In the Razorpay dashboard, create a yearly plan (Subscriptions → Plans) for ₹1,178.82 (₹999 + 18% GST), and set `RAZORPAY_PLAN_ID`.
   2. Create API keys and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
   3. Add a webhook at `https://<your-domain>/api/billing/webhook` for the `subscription.*` events (activated, charged, pending, halted, cancelled, completed, paused, resumed), and set `RAZORPAY_WEBHOOK_SECRET`.
   4. Owners subscribe in Razorpay Checkout on the Subscription page; the signed payment response switches the venue on at once, and the webhook keeps renewals and cancellations in step.
   5. Without keys in production, payments are disabled and the Subscription page asks owners to email support.
   6. Ask your accountant about GST invoices: Razorpay can issue them if you add your GSTIN in its dashboard.
5. **Set `ADMIN_EMAILS`** to your own address(es).
6. **Backups:**
   - **Database:** Supabase backs it up daily on paid plans. Elsewhere, schedule `pg_dump`.
   - **Images:** they're in the bucket, or in `DATA_DIR` if you kept them on disk.
7. **Get the starter [terms](src/app/terms/page.tsx) and [privacy notice](src/app/privacy/page.tsx) reviewed by a lawyer.**

## Configuration

| Env var | Purpose |
|---|---|
| `APP_URL` | Public origin encoded into QR codes and links (falls back to the request host) |
| `DATABASE_URL` | PostgreSQL connection string (Supabase, Neon, RDS, self-hosted). Without it, an embedded Postgres in `DATA_DIR/pg` is used |
| `DATABASE_SSL` | `off` for a server without TLS (localhost is detected automatically) |
| `DATABASE_POOL_SIZE` | Connections per server (default 5) |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Store images and feedback photos in any S3-compatible bucket (Supabase Storage, MinIO, R2, AWS). Without them they're saved under `DATA_DIR` |
| `DATA_DIR` | Local folder for the embedded database and, without `S3_*`, images and feedback photos (default `./data`) |
| `ADMIN_EMAILS` | Comma-separated super admins (the email must be verified). They can make other accounts admins from `/admin/accounts` |
| `RESEND_API_KEY` | Sends email through Resend; without it emails only go to the `outbox` table and log |
| `MAIL_FROM` | Sender for all emails, e.g. `Tabletap <hello@tabletap.app>` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID` | Razorpay Subscriptions for the yearly plan |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies `/api/billing/webhook` |
| `BILLING_DEV_MODE` | `1` allows dev-mode billing in a production build (for staging only) |
| `GROQ_API_KEY` | Turns on AI menu import (photos, up to 3 at a time) and "What's this?" drafts using Groq; used first when set |
| `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL` | Groq models (defaults `openai/gpt-oss-120b` for text, `qwen/qwen3.8-27b` for menu photos) |
| `ANTHROPIC_API_KEY` | Alternative AI provider (Claude); also reads PDF menus and up to 5 photos |
| `ANTHROPIC_MODEL` | Claude model (default `claude-opus-5-5`) |
| `AI_PROVIDER` | `groq` or `anthropic`, to choose when both keys are set |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile captcha on sign-up and password reset; off without them |
| `CRON_SECRET` | Enables `POST /api/cron/run` for an external scheduler (`Authorization: Bearer …`) |
| `DISABLE_JOBS` | `1` stops the in-process hourly job ticker (weekly digest, guest emails), e.g. when running more than one server |
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
| `/dashboard/<venue>/guests`, `/feedback` | Guest list (with CSV export) and feedback inbox |
| `/dashboard/<venue>/qr`, `/qr/print` | QR downloads (PNG/SVG, per-table sources) and printable table cards |
| `/dashboard/<venue>/billing`, `/settings` | Plan, venue details, page address, delete venue |
| `/dashboard/account` | Name, password, delete account |
| `/admin` | Operator view: all accounts and venues, suspend, extend trials, give free access, revenue, account actions (resend emails, reset link, block, delete) and an activity log of every admin change |
| `/staff`, `/staff/stamp?c=<card>` | Till screens for paired staff devices: find a member, add stamps, redeem rewards, undo |

**Guests**

| Path | What |
|---|---|
| `/s?i=<code>&s=<source>` | Landing page (server-rendered, venue theme applied before first paint). `cta=box\|anon` forces the feedback-card A/B variant. |
| `/menu?i=<code>` | Hosted menu: search, section jump bar, allergen filter, dietary tags |
| `/card/<id>?t=<token>` | Member's web card (linked from the enrolment email) |
| `/consent?status=` | Result of the double-opt-in link |
| `/privacy`, `/terms` | Privacy notice and terms of service |
| `/unsubscribe?token=` | Stop offer emails from one venue (also one-click from mail apps) |
| `/media/<venue>/<file>` | Images uploaded by owners |

**APIs:** `api/auth/*`, `api/account`, `api/dashboard/venues/*` and `api/admin/*` are cookie-authenticated, and their writes are refused from other origins. `api/billing/webhook` is signed by Razorpay. The guest APIs (`api/venues`, `api/loyalty`, `api/feedback`, `api/guests`, `api/consent`, `api/events`) are unchanged.

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

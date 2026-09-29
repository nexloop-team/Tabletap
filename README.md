# Tabletap — QR pages for hospitality venues

A customer lands on a venue's page after scanning a table QR code. The page offers the menu, Wi-Fi, a loyalty card, feedback that routes happy guests to Google reviews, and a Sudoku to pass the time. Behaviour is modelled on the analysis in [docs/candour-analysis.md](docs/candour-analysis.md), with our own brand, copy and backend.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (vitest)
pnpm lint
pnpm build && pnpm start
```

Requires Node 22+ (the database uses the built-in `node:sqlite`). The SQLite file and uploaded photos live in `./data/` (override with `DATA_DIR`), and three demo venues are seeded on first start:

| URL | Shows |
|---|---|
| `/s?i=demo` | Stamp card with reward tiers, hosted menu, plain Wi-Fi, Sudoku |
| `/s?i=demo-crm` | Dark pub theme, Wi-Fi email gate, marketing consent (18+), birthday ask |
| `/s?i=demo-rewards` | Rewards-only membership, external ordering link, custom link cards |

Emails aren't sent in development. They are written to the `outbox` table and printed in the server log, including the card links and consent-confirmation links, so every flow can be completed locally.

## Routes

| Path | What |
|---|---|
| `/s?i=<code>&s=<source>` | Landing page (server-rendered, venue theme applied before first paint). `cta=box\|anon` forces the feedback-card A/B variant. |
| `/menu?i=<code>` | Hosted menu: search, section jump bar, allergen filter, dietary tags |
| `/card/<id>?t=<token>` | Member's web card (linked from the enrolment email) |
| `/consent?status=` | Result of the double-opt-in link |
| `/privacy` | Privacy notice linked from consent lines |
| `GET /api/venues/:id` | Public venue profile (id or short code) |
| `POST /api/loyalty/enroll`, `/api/loyalty/stamp` | Join / feedback stamp |
| `POST /api/feedback` | Feedback + optional photo; sentiment is scored server-side |
| `POST /api/guests/capture`, `/visit`, `/birthday` | Wi-Fi gate, recognised-device visit, birthday |
| `GET /api/consent/confirm?token=` | Double-opt-in confirmation |
| `POST /api/events` | First-party analytics sink |

## Configuration

| Env var | Purpose |
|---|---|
| `NEXT_PUBLIC_BRAND_NAME` | Product name in the footer and titles (default "Tabletap") |
| `MAIL_FROM` | Sender for pass/consent emails |
| `DATA_DIR` | Where the SQLite database and uploads are stored |
| `GOOGLE_NL_API_KEY` | Optional: Google Cloud Natural Language for sentiment (a built-in lexicon is used otherwise) |
| `APPLE_PASS_CERT_PATH`, `GOOGLE_WALLET_ISSUER_ID` | Reserved for Wallet passes (not implemented yet; the web card is used instead) |

## Code map

- `src/app/` holds the routes: pages and `api/*` handlers.
- `src/components/landing/` holds the landing page. `LandingApp` assembles the header, cards, socials and footer, and each feature's sheet has its own folder.
- `src/lib/` holds pure logic shared by client and server: theme, feature rules, validation, i18n, sudoku, API contracts.
- `src/server/` holds the database, repositories and services. Only route handlers and server pages import it.

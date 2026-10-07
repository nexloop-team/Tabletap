import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedDemoVenues } from "./seed";

/**
 * SQLite through Node's built-in driver: zero native dependencies, one file
 * on disk. Repositories are the only callers, so moving to Postgres later is
 * a change to this file and the repositories, not to the routes.
 */

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

const MIGRATIONS: string[] = [
  `CREATE TABLE venues (
     id TEXT PRIMARY KEY,
     short_code TEXT NOT NULL UNIQUE,
     config TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE customers (
     id TEXT PRIMARY KEY,
     venue_id TEXT NOT NULL REFERENCES venues(id),
     email TEXT NOT NULL,
     first_name TEXT,
     name TEXT,
     locale TEXT,
     capture_source TEXT,
     marketing_consent TEXT NOT NULL DEFAULT 'unasked',
     age_attested INTEGER NOT NULL DEFAULT 0,
     consent_token TEXT,
     consent_updated_at TEXT,
     birthday_month INTEGER,
     birthday_day INTEGER,
     birthday_skips INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (venue_id, email)
   );
   CREATE TABLE loyalty_cards (
     id TEXT PRIMARY KEY,
     venue_id TEXT NOT NULL REFERENCES venues(id),
     customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id),
     access_token TEXT NOT NULL,
     stamps INTEGER NOT NULL DEFAULT 0,
     last_pass_email_at TEXT,
     last_feedback_stamp_at TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE visits (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     venue_id TEXT NOT NULL,
     customer_id TEXT NOT NULL,
     type TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE feedback (
     id TEXT PRIMARY KEY,
     venue_id TEXT NOT NULL REFERENCES venues(id),
     text TEXT NOT NULL,
     sentiment REAL NOT NULL,
     source TEXT,
     image_path TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE outbox (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     recipient TEXT NOT NULL,
     subject TEXT NOT NULL,
     body TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     params TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );`,
  // Merchant accounts: owners sign up, own venues, and pay per venue.
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     email_verified_at TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE auth_tokens (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     purpose TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     used_at TEXT
   );
   CREATE TABLE venue_members (
     venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role TEXT NOT NULL DEFAULT 'owner',
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (venue_id, user_id)
   );
   CREATE INDEX venue_members_user ON venue_members(user_id);
   CREATE TABLE subscriptions (
     venue_id TEXT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
     plan TEXT NOT NULL DEFAULT 'free',
     status TEXT NOT NULL DEFAULT 'active',
     trial_ends_at TEXT,
     current_period_end TEXT,
     provider TEXT,
     provider_customer_id TEXT,
     provider_subscription_id TEXT,
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   ALTER TABLE venues ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
   ALTER TABLE venues ADD COLUMN updated_at TEXT;
   ALTER TABLE events ADD COLUMN venue_id TEXT;
   UPDATE events SET venue_id = json_extract(params, '$.venue_id');
   CREATE INDEX events_venue ON events(venue_id, name, created_at);
   CREATE INDEX feedback_venue ON feedback(venue_id, created_at);
   CREATE INDEX visits_venue ON visits(venue_id, created_at);`,
  // Staff stamping, owner-only venue settings, digest preferences, jobs.
  `CREATE TABLE stamp_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     venue_id TEXT NOT NULL,
     card_id TEXT NOT NULL,
     kind TEXT NOT NULL,
     delta INTEGER NOT NULL,
     reward_name TEXT,
     device_id TEXT,
     undone_at TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX stamp_events_card ON stamp_events(card_id, created_at);
   CREATE INDEX stamp_events_venue ON stamp_events(venue_id, kind, created_at);
   CREATE TABLE staff_devices (
     id TEXT PRIMARY KEY,
     venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     label TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     last_used_at TEXT,
     revoked_at TEXT
   );
   CREATE INDEX staff_devices_venue ON staff_devices(venue_id);
   CREATE TABLE staff_pairings (
     id TEXT PRIMARY KEY,
     venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     label TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     used_at TEXT
   );
   ALTER TABLE venues ADD COLUMN settings TEXT;
   CREATE TABLE notification_prefs (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     weekly_digest INTEGER NOT NULL DEFAULT 1,
     PRIMARY KEY (user_id, venue_id)
   );
   CREATE TABLE job_runs (
     job TEXT NOT NULL,
     key TEXT NOT NULL,
     ran_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (job, key)
   );`,
  // AI quota, guest email automations, refer-a-friend.
  `CREATE TABLE ai_usage (
     venue_id TEXT NOT NULL,
     day TEXT NOT NULL,
     units INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (venue_id, day)
   );
   ALTER TABLE customers ADD COLUMN unsubscribe_token TEXT;
   CREATE UNIQUE INDEX customers_unsubscribe ON customers(unsubscribe_token);
   CREATE TABLE guest_emails (
     customer_id TEXT NOT NULL,
     kind TEXT NOT NULL,
     key TEXT NOT NULL,
     sent_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (customer_id, kind, key)
   );
   ALTER TABLE loyalty_cards ADD COLUMN referral_code TEXT;
   ALTER TABLE loyalty_cards ADD COLUMN referred_by_card_id TEXT;
   ALTER TABLE loyalty_cards ADD COLUMN referral_rewarded_at TEXT;
   CREATE UNIQUE INDEX loyalty_cards_referral ON loyalty_cards(referral_code);`,
  // One step of undo for the page editors.
  `ALTER TABLE venues ADD COLUMN previous_config TEXT;`,
  // Staff logins: owners invite staff by email; staff can only open the till.
  `CREATE TABLE staff_invites (
     id TEXT PRIMARY KEY,
     venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     email TEXT NOT NULL,
     invited_by TEXT,
     expires_at TEXT NOT NULL,
     used_at TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX staff_invites_venue ON staff_invites(venue_id);`,
  // Till devices remember which staff login opened them, so removing the person locks the device too.
  `ALTER TABLE staff_pairings ADD COLUMN user_id TEXT;
   ALTER TABLE staff_devices ADD COLUMN user_id TEXT;`,
  // One plan, billed yearly through Razorpay; a cancellation takes effect when the paid year ends.
  `ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;`,
];

function migrate(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
  while (version < MIGRATIONS.length) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      version += 1;
      db.prepare("UPDATE schema_version SET version = ?").run(version);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

declare global {
  // Survives dev-server hot reloads so we keep one connection.
  var __appDb: DatabaseSync | undefined;
  // How many migrations the kept connection has seen.
  var __appDbMigrations: number | undefined;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__appDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    globalThis.__appDb = db;
  }
  // A hot reload can bring new migrations while the connection lives on, so
  // check on every call (a number compare) rather than only at open.
  if (globalThis.__appDbMigrations !== MIGRATIONS.length) {
    migrate(globalThis.__appDb);
    seedDemoVenues(globalThis.__appDb);
    globalThis.__appDbMigrations = MIGRATIONS.length;
  }
  return globalThis.__appDb;
}

/** Runs `fn` in a transaction; SQLite serialises writers, so this is our lock. */
export function transaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

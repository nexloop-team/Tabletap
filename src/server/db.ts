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
}

export function getDb(): DatabaseSync {
  if (!globalThis.__appDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrate(db);
    seedDemoVenues(db);
    globalThis.__appDb = db;
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

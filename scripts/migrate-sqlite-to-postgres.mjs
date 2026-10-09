// Copies everything from the old SQLite database (data/app.db) into PostgreSQL.
//
//   DATABASE_URL=postgres://… node scripts/migrate-sqlite-to-postgres.mjs [path/to/app.db]
//
// Without DATABASE_URL it fills the local embedded Postgres (PGlite, DATA_DIR/pg)
// that `pnpm dev` uses. Run it once, with the app stopped. It creates the tables
// if they aren't there yet, skips rows that already exist, and is safe to rerun.
//
// With S3_BUCKET set (and the other S3_* variables), it also uploads the images
// under DATA_DIR/media and DATA_DIR/uploads to the bucket.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const source = process.argv[2] || path.join(DATA_DIR, "app.db");
if (!fs.existsSync(source)) {
  console.error(`No SQLite database at ${source}`);
  process.exit(1);
}

// Parent tables before their children.
const TABLES = [
  "users",
  "venues",
  "venue_members",
  "subscriptions",
  "customers",
  "loyalty_cards",
  "visits",
  "feedback",
  "outbox",
  "events",
  "sessions",
  "auth_tokens",
  "stamp_events",
  "staff_devices",
  "staff_pairings",
  "notification_prefs",
  "job_runs",
  "ai_usage",
  "guest_emails",
  "staff_invites",
  "admin_actions",
  "admin_edit_grants",
];
const IDENTITY_TABLES = ["visits", "outbox", "events", "stamp_events"];

/** The schema, read from the app's own migrations so the two never drift. */
function migrations() {
  const text = fs.readFileSync(path.join(process.cwd(), "src/server/db.ts"), "utf8");
  const start = text.indexOf("const MIGRATIONS: string[] = [");
  const end = text.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error("Couldn't find MIGRATIONS in src/server/db.ts");
  return new Function(`return [${text.slice(text.indexOf("[", start) + 1, end)}];`)();
}

async function connect() {
  if (process.env.DATABASE_URL) {
    const pg = (await import("pg")).default;
    const url = process.env.DATABASE_URL;
    const client = new pg.Client({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === "off" || /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    await client.connect();
    return {
      label: "PostgreSQL (DATABASE_URL)",
      query: (sql, params) => client.query(sql, params),
      exec: (sql) => client.query(sql),
      close: () => client.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(DATA_DIR, "pg");
  fs.mkdirSync(dir, { recursive: true });
  const lite = new PGlite(dir);
  await lite.waitReady;
  return { label: `PGlite (${dir})`, query: (sql, params) => lite.query(sql, params), exec: (sql) => lite.exec(sql), close: () => lite.close() };
}

/** SQLite wrote UTC times without a zone ("2026-10-09 13:05:00"); mark them as UTC. */
function value(v) {
  if (typeof v === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$/.test(v)) return `${v.replace(" ", "T")}Z`;
  return v;
}

const sqlite = new DatabaseSync(source, { readOnly: true });
const target = await connect();
console.log(`From ${source}\nTo   ${target.label}`);

// Tables, if the app hasn't created them yet.
await target.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
const versionRow = (await target.query("SELECT version FROM schema_version")).rows[0];
const all = migrations();
let version = versionRow?.version ?? 0;
if (!versionRow) await target.query("INSERT INTO schema_version (version) VALUES (0)");
for (; version < all.length; version++) {
  await target.exec(all[version]);
  await target.query("UPDATE schema_version SET version = $1", [version + 1]);
}

const sourceTables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
await target.exec("BEGIN");
try {
  for (const table of TABLES) {
    if (!sourceTables.has(table)) continue;
    const targetColumns = new Set((await target.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table])).rows.map((r) => r.column_name));
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    let copied = 0;
    for (const row of rows) {
      const columns = Object.keys(row).filter((c) => targetColumns.has(c));
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const result = await target.query(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        columns.map((c) => value(row[c])),
      );
      copied += result.rowCount ?? result.affectedRows ?? 0;
    }
    console.log(`  ${table.padEnd(20)} ${copied} of ${rows.length} rows`);
  }
  // Keep new ids after the copied ones.
  for (const table of IDENTITY_TABLES) {
    await target.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST(1, (SELECT COALESCE(MAX(id), 0) FROM ${table})))`);
  }
  await target.exec("COMMIT");
} catch (error) {
  await target.exec("ROLLBACK");
  throw error;
} finally {
  await target.close();
  sqlite.close();
}

// Images, when they should live in a bucket.
if (process.env.S3_BUCKET) {
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    region: process.env.S3_REGION || "us-east-1",
    service: "s3",
  });
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com`).replace(/\/$/, "");
  const types = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
  let uploaded = 0;
  const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);
  for (const file of [...walk(path.join(DATA_DIR, "media")), ...walk(path.join(DATA_DIR, "uploads"))]) {
    const key = path.relative(DATA_DIR, file).split(path.sep).join("/");
    const url = `${endpoint}/${process.env.S3_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
    const response = await client.fetch(url, { method: "PUT", body: fs.readFileSync(file), headers: { "Content-Type": types[key.split(".").pop()] ?? "application/octet-stream" } });
    if (!response.ok) throw new Error(`Upload of ${key} failed: ${response.status} ${await response.text()}`);
    uploaded++;
  }
  console.log(`  images               ${uploaded} uploaded to ${process.env.S3_BUCKET}`);
}

console.log("Done.");

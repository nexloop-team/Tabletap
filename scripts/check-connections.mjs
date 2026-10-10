// Checks DATABASE_URL and the S3_* bucket from .env.local, without changing anything lasting.
//   node --env-file=.env.local scripts/check-connections.mjs
import fs from "node:fs";
import { AwsClient } from "aws4fetch";

/** Same rules as src/server/db.ts databaseSsl. */
function sslFor(url) {
  if (process.env.DATABASE_SSL === "off" || /localhost|127\.0\.0\.1/.test(url)) return undefined;
  const ca = process.env.DATABASE_SSL_CA?.trim();
  if (ca) return { rejectUnauthorized: true, ca: ca.includes("BEGIN CERTIFICATE") ? ca.replaceAll("\\n", "\n") : fs.readFileSync(ca, "utf8") };
  return { rejectUnauthorized: process.env.DATABASE_SSL === "verify" };
}


let ok = true;

if (process.env.DATABASE_URL) {
  const pg = (await import("pg")).default;
  const url = process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString: url,
    ssl: sslFor(url),
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT version() AS v, current_database() AS db, now() AS t");
    const tables = await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(`Database  ok   ${rows[0].db} · ${rows[0].v.split(" ").slice(0, 2).join(" ")} · ${tables.rows[0].n} tables in public`);
  } catch (error) {
    ok = false;
    console.log(`Database  FAIL ${error.message}`);
  } finally {
    await client.end().catch(() => {});
  }
} else {
  console.log("Database  not set (DATABASE_URL empty: the app uses the local embedded database)");
}

if (process.env.S3_BUCKET) {
  const client = new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    region: process.env.S3_REGION || "us-east-1",
    service: "s3",
  });
  const endpoint = (process.env.S3_ENDPOINT || "").replace(/\/$/, "");
  const url = `${endpoint}/${process.env.S3_BUCKET}/_connection-check.txt`;
  try {
    const put = await client.fetch(url, { method: "PUT", body: "ok", headers: { "Content-Type": "text/plain" } });
    if (!put.ok) throw new Error(`upload ${put.status}: ${(await put.text()).slice(0, 200)}`);
    const get = await client.fetch(url);
    if (!get.ok || (await get.text()) !== "ok") throw new Error(`download ${get.status}`);
    const del = await client.fetch(url, { method: "DELETE" });
    if (!del.ok && del.status !== 204) throw new Error(`delete ${del.status}`);
    console.log(`Storage   ok   bucket ${process.env.S3_BUCKET}: upload, download and delete all work`);
  } catch (error) {
    ok = false;
    console.log(`Storage   FAIL ${error.message}`);
  }
} else {
  console.log("Storage   not set (S3_BUCKET empty: files stay on this server's disk)");
}

process.exit(ok ? 0 : 1);

import "server-only";
import { getDb } from "../db";
import { stampActivity } from "./stamps";

/**
 * Read-only queries behind the merchant dashboard. Scans made from the
 * dashboard's own preview (`s=preview`) are left out of every count.
 */

const NOT_PREVIEW = "COALESCE((params->>'source'), '') != 'preview'";

export interface VenueStats {
  days: number;
  scans: number;
  visitors: number;
  menuViews: number;
  wifiOpens: number;
  reviewTaps: number;
  feedbackCount: number;
  averageSentiment: number | null;
  newGuests: number;
  totalGuests: number;
  members: number;
  stampsHeld: number;
  stampsGiven: number;
  rewardsRedeemed: number;
  daily: { day: string; scans: number }[];
  /** Visits per spot (table), QR scans and NFC taps together. */
  sources: { source: string; scans: number }[];
}

/**
 * A scan is a visit: one guest opening the page counts once, however many
 * times they refresh or go to the menu and back (see lib/analytics visitId).
 * Days are the venue's own, given its offset from UTC in minutes.
 */
export async function venueStats(venueId: string, days = 30, utcOffsetMinutes = 0): Promise<VenueStats> {
  const db = await getDb();
  const since = `-${days} days`;
  const local = `${utcOffsetMinutes >= 0 ? "+" : "-"}${Math.abs(utcOffsetMinutes)} minutes`;
  const count = async (name: string) =>
    (
      (await db.get(`SELECT COUNT(*) AS n FROM events WHERE venue_id = ? AND name = ? AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}`, venueId, name, since)) as { n: number }
    ).n;
  // Page views count once per visit, so a refresh isn't a second view.
  const visits = async (name: string) =>
    (
      (await db.get(`SELECT COUNT(DISTINCT (params->>'session_id')) AS n FROM events WHERE venue_id = ? AND name = ? AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}`, venueId, name, since)) as { n: number }
    ).n;

  const visitors = (
    (await db.get(
        `SELECT COUNT(DISTINCT (params->>'session_id')) AS n FROM events
         WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}`, venueId, since)) as { n: number }
  ).n;

  const feedback = (await db.get("SELECT COUNT(*) AS n, AVG(sentiment) AS avg FROM feedback WHERE venue_id = ? AND created_at >= now() + CAST(? AS INTERVAL)", venueId, since)) as { n: number; avg: number | null };

  const guests = (await db.get(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN created_at >= now() + CAST(? AS INTERVAL) THEN 1 ELSE 0 END) AS recent
       FROM customers WHERE venue_id = ?`, since, venueId)) as { total: number; recent: number | null };

  const cards = (await db.get("SELECT COUNT(*) AS n, COALESCE(SUM(stamps), 0) AS stamps FROM loyalty_cards WHERE venue_id = ?", venueId)) as {
    n: number;
    stamps: number;
  };

  const dailyRows = (await db.all(
      `SELECT to_char((created_at + CAST(? AS INTERVAL)) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(DISTINCT (params->>'session_id')) AS scans FROM events
       WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}
       GROUP BY 1`, local, venueId, since)) as { day: string; scans: number }[];
  const byDay = new Map(dailyRows.map((row) => [row.day, row.scans]));
  const daily: VenueStats["daily"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() + utcOffsetMinutes * 60_000 - i * 86_400_000).toISOString().slice(0, 10);
    daily.push({ day, scans: byDay.get(day) ?? 0 });
  }

  // A table's QR ("table-4") and NFC tag ("table-4-nfc") count as one spot; an unnamed NFC tag ("nfc") belongs to the main code.
  const sources = (await db.all(
      `SELECT base AS source, COUNT(DISTINCT session_id) AS scans FROM (
         SELECT CASE WHEN src = 'nfc' THEN 'unknown' WHEN src LIKE '%-nfc' THEN left(src, length(src) - 4) ELSE src END AS base, session_id
           FROM (SELECT COALESCE((params->>'source'), 'unknown') AS src, (params->>'session_id') AS session_id FROM events
                  WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}) AS opened
       ) AS spots
       GROUP BY base ORDER BY scans DESC LIMIT 8`, venueId, since)) as { source: string; scans: number }[];

  return {
    days,
    scans: visitors,
    visitors,
    menuViews: await visits("menu_viewed"),
    wifiOpens: await count("wifi_sheet_opened"),
    reviewTaps: await count("google_review_tapped"),
    feedbackCount: feedback.n,
    averageSentiment: feedback.avg,
    newGuests: guests.recent ?? 0,
    totalGuests: guests.total,
    members: cards.n,
    stampsHeld: cards.stamps,
    ...(await stampActivity(venueId, days)),
    daily,
    sources,
  };
}

export interface VenueEngagement {
  /** Visits that opened each card on the guest page ("menu", "wifi", "loyalty"…). */
  features: { feature: string; visits: number }[];
  /** Visits by the venue's local hour, 0–23. */
  hours: number[];
  /** The dishes guests opened most on the menu. */
  dishes: { itemId: string; opens: number }[];
}

/** What guests do once they're on the page: which cards they open, when they come, which dishes they look at. */
export async function venueEngagement(venueId: string, days = 30, utcOffsetMinutes = 0): Promise<VenueEngagement> {
  const db = await getDb();
  const since = `-${days} days`;
  const local = `${utcOffsetMinutes >= 0 ? "+" : "-"}${Math.abs(utcOffsetMinutes)} minutes`;
  const features = (await db.all(
      `SELECT (params->>'feature') AS feature, COUNT(DISTINCT (params->>'session_id')) AS visits FROM events
       WHERE venue_id = ? AND name = 'feature_card_tapped' AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}
       GROUP BY feature ORDER BY visits DESC`, venueId, since)) as { feature: string; visits: number }[];
  const hourRows = (await db.all(
      `SELECT CAST(EXTRACT(HOUR FROM (created_at + CAST(? AS INTERVAL)) AT TIME ZONE 'UTC') AS INTEGER) AS hour, COUNT(DISTINCT (params->>'session_id')) AS visits FROM events
       WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}
       GROUP BY 1`, local, venueId, since)) as { hour: number; visits: number }[];
  const hours = new Array<number>(24).fill(0);
  for (const row of hourRows) hours[row.hour] = row.visits;
  const dishes = (await db.all(
      `SELECT (params->>'item_id') AS "itemId", COUNT(DISTINCT (params->>'session_id')) AS opens FROM events
       WHERE venue_id = ? AND name = 'menu_item_opened' AND created_at >= now() + CAST(? AS INTERVAL) AND ${NOT_PREVIEW}
       GROUP BY 1 ORDER BY opens DESC LIMIT 5`, venueId, since)) as { itemId: string; opens: number }[];
  return { features: features.filter((f) => f.feature), hours, dishes: dishes.filter((d) => d.itemId) };
}

export interface GuestRow {
  id: string;
  email: string;
  firstName: string | null;
  name: string | null;
  captureSource: string | null;
  marketingConsent: string;
  birthday: string | null;
  stamps: number | null;
  visits: number;
  createdAt: string;
}

export async function listGuests(venueId: string, options: { query?: string; limit?: number; offset?: number } = {}): Promise<{ rows: GuestRow[]; total: number }> {
  const db = await getDb();
  const query = (options.query ?? "").trim().toLowerCase();
  const filter = query ? "AND (c.email ILIKE ? OR LOWER(COALESCE(c.first_name, '') || ' ' || COALESCE(c.name, '')) LIKE ?)" : "";
  const filterArgs = query ? [`%${query}%`, `%${query}%`] : [];
  const total = ((await db.get(`SELECT COUNT(*) AS n FROM customers c WHERE c.venue_id = ? ${filter}`, venueId, ...filterArgs)) as { n: number }).n;
  const rows = (await db.all(
      `SELECT c.*, l.stamps,
              (SELECT COUNT(*) FROM visits v WHERE v.customer_id = c.id) AS visit_count
       FROM customers c LEFT JOIN loyalty_cards l ON l.customer_id = c.id
       WHERE c.venue_id = ? ${filter}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, venueId, ...filterArgs, options.limit ?? 50, options.offset ?? 0)) as {
    id: string;
    email: string;
    first_name: string | null;
    name: string | null;
    capture_source: string | null;
    marketing_consent: string;
    birthday_month: number | null;
    birthday_day: number | null;
    stamps: number | null;
    visit_count: number;
    created_at: string;
  }[];
  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      name: row.name,
      captureSource: row.capture_source,
      marketingConsent: row.marketing_consent,
      birthday: row.birthday_month && row.birthday_day ? `${String(row.birthday_day).padStart(2, "0")}/${String(row.birthday_month).padStart(2, "0")}` : null,
      stamps: row.stamps,
      visits: row.visit_count,
      createdAt: row.created_at,
    })),
  };
}

export interface FeedbackRow {
  id: string;
  text: string;
  sentiment: number;
  source: string | null;
  hasPhoto: boolean;
  createdAt: string;
}

export type FeedbackFilter = "all" | "positive" | "neutral" | "negative";

const SENTIMENT_WHERE: Record<FeedbackFilter, string> = {
  all: "",
  positive: "AND sentiment >= 0.25",
  neutral: "AND sentiment > -0.25 AND sentiment < 0.25",
  negative: "AND sentiment <= -0.25",
};

export async function listFeedback(venueId: string, options: { filter?: FeedbackFilter; limit?: number; offset?: number } = {}): Promise<{ rows: FeedbackRow[]; total: number }> {
  const db = await getDb();
  const where = SENTIMENT_WHERE[options.filter ?? "all"];
  const total = ((await db.get(`SELECT COUNT(*) AS n FROM feedback WHERE venue_id = ? ${where}`, venueId)) as { n: number }).n;
  const rows = (await db.all(`SELECT id, text, sentiment, source, image_path, created_at FROM feedback WHERE venue_id = ? ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, venueId, options.limit ?? 30, options.offset ?? 0)) as {
    id: string;
    text: string;
    sentiment: number;
    source: string | null;
    image_path: string | null;
    created_at: string;
  }[];
  return {
    total,
    rows: rows.map((row) => ({ id: row.id, text: row.text, sentiment: row.sentiment, source: row.source, hasPhoto: !!row.image_path, createdAt: row.created_at })),
  };
}

export async function feedbackPhotoPath(venueId: string, feedbackId: string): Promise<string | null> {
  const row = (await (await getDb()).get("SELECT image_path FROM feedback WHERE venue_id = ? AND id = ?", venueId, feedbackId)) as { image_path: string | null } | undefined;
  return row?.image_path ?? null;
}

import "server-only";
import { getDb } from "../db";

/**
 * Read-only queries behind the merchant dashboard. Scans made from the
 * dashboard's own preview (`s=preview`) are left out of every count.
 */

const NOT_PREVIEW = "COALESCE(json_extract(params, '$.source'), '') != 'preview'";

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
  daily: { day: string; scans: number }[];
  sources: { source: string; scans: number }[];
}

export function venueStats(venueId: string, days = 30): VenueStats {
  const db = getDb();
  const since = `-${days} days`;
  const count = (name: string) =>
    (
      db
        .prepare(`SELECT COUNT(*) AS n FROM events WHERE venue_id = ? AND name = ? AND created_at >= datetime('now', ?) AND ${NOT_PREVIEW}`)
        .get(venueId, name, since) as { n: number }
    ).n;

  const visitors = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT json_extract(params, '$.session_id')) AS n FROM events
         WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= datetime('now', ?) AND ${NOT_PREVIEW}`,
      )
      .get(venueId, since) as { n: number }
  ).n;

  const feedback = db
    .prepare("SELECT COUNT(*) AS n, AVG(sentiment) AS avg FROM feedback WHERE venue_id = ? AND created_at >= datetime('now', ?)")
    .get(venueId, since) as { n: number; avg: number | null };

  const guests = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN created_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS recent
       FROM customers WHERE venue_id = ?`,
    )
    .get(since, venueId) as { total: number; recent: number | null };

  const cards = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(stamps), 0) AS stamps FROM loyalty_cards WHERE venue_id = ?").get(venueId) as {
    n: number;
    stamps: number;
  };

  const dailyRows = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS scans FROM events
       WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= datetime('now', ?) AND ${NOT_PREVIEW}
       GROUP BY day`,
    )
    .all(venueId, since) as { day: string; scans: number }[];
  const byDay = new Map(dailyRows.map((row) => [row.day, row.scans]));
  const daily: VenueStats["daily"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    daily.push({ day, scans: byDay.get(day) ?? 0 });
  }

  const sources = db
    .prepare(
      `SELECT COALESCE(json_extract(params, '$.source'), 'unknown') AS source, COUNT(*) AS scans FROM events
       WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= datetime('now', ?) AND ${NOT_PREVIEW}
       GROUP BY source ORDER BY scans DESC LIMIT 8`,
    )
    .all(venueId, since) as { source: string; scans: number }[];

  return {
    days,
    scans: count("landing_opened"),
    visitors,
    menuViews: count("menu_viewed"),
    wifiOpens: count("wifi_sheet_opened"),
    reviewTaps: count("google_review_tapped"),
    feedbackCount: feedback.n,
    averageSentiment: feedback.avg,
    newGuests: guests.recent ?? 0,
    totalGuests: guests.total,
    members: cards.n,
    stampsHeld: cards.stamps,
    daily,
    sources,
  };
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

export function listGuests(venueId: string, options: { query?: string; limit?: number; offset?: number } = {}): { rows: GuestRow[]; total: number } {
  const db = getDb();
  const query = (options.query ?? "").trim().toLowerCase();
  const filter = query ? "AND (c.email LIKE ? OR LOWER(COALESCE(c.first_name, '') || ' ' || COALESCE(c.name, '')) LIKE ?)" : "";
  const filterArgs = query ? [`%${query}%`, `%${query}%`] : [];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM customers c WHERE c.venue_id = ? ${filter}`).get(venueId, ...filterArgs) as { n: number }).n;
  const rows = db
    .prepare(
      `SELECT c.*, l.stamps,
              (SELECT COUNT(*) FROM visits v WHERE v.customer_id = c.id) AS visit_count
       FROM customers c LEFT JOIN loyalty_cards l ON l.customer_id = c.id
       WHERE c.venue_id = ? ${filter}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(venueId, ...filterArgs, options.limit ?? 50, options.offset ?? 0) as {
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

export function listFeedback(venueId: string, options: { filter?: FeedbackFilter; limit?: number; offset?: number } = {}): { rows: FeedbackRow[]; total: number } {
  const db = getDb();
  const where = SENTIMENT_WHERE[options.filter ?? "all"];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE venue_id = ? ${where}`).get(venueId) as { n: number }).n;
  const rows = db
    .prepare(`SELECT id, text, sentiment, source, image_path, created_at FROM feedback WHERE venue_id = ? ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(venueId, options.limit ?? 30, options.offset ?? 0) as {
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

export function feedbackPhotoPath(venueId: string, feedbackId: string): string | null {
  const row = getDb().prepare("SELECT image_path FROM feedback WHERE venue_id = ? AND id = ?").get(venueId, feedbackId) as { image_path: string | null } | undefined;
  return row?.image_path ?? null;
}

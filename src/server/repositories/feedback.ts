import "server-only";
import { getDb } from "../db";

export interface NewFeedback {
  id: string;
  venueId: string;
  text: string;
  sentiment: number;
  source: string | null;
  imagePath: string | null;
}

export async function insertFeedback(input: NewFeedback) {
  (await (await getDb()).run("INSERT INTO feedback (id, venue_id, text, sentiment, source, image_path) VALUES (?, ?, ?, ?, ?, ?)", input.id, input.venueId, input.text, input.sentiment, input.source, input.imagePath));
}

/** Feedback newer than this owner's last look at the inbox (or the last 14 days, before their first look). */
export async function unreadFeedback(venueId: string, userId: string): Promise<{ count: number; latest: string | null }> {
  const db = await getDb();
  const seen = (await db.get("SELECT feedback_seen_at FROM venue_members WHERE venue_id = ? AND user_id = ?", venueId, userId)) as { feedback_seen_at: string | null } | undefined;
  const since = seen?.feedback_seen_at ?? null;
  const where = since ? "created_at > ?" : "created_at >= now() + INTERVAL '-14 days'";
  const args = since ? [venueId, since] : [venueId];
  const count = ((await db.get(`SELECT COUNT(*) AS n FROM feedback WHERE venue_id = ? AND ${where}`, ...args)) as { n: number }).n;
  const latest = count
    ? (((await db.get(`SELECT text FROM feedback WHERE venue_id = ? AND ${where} ORDER BY created_at DESC LIMIT 1`, ...args)) as { text: string } | undefined)?.text ?? null)
    : null;
  return { count, latest };
}

export async function markFeedbackSeen(venueId: string, userId: string) {
  (await (await getDb()).run("UPDATE venue_members SET feedback_seen_at = now() WHERE venue_id = ? AND user_id = ?", venueId, userId));
}

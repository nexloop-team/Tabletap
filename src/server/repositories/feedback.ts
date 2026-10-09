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

export function insertFeedback(input: NewFeedback) {
  getDb()
    .prepare("INSERT INTO feedback (id, venue_id, text, sentiment, source, image_path) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.id, input.venueId, input.text, input.sentiment, input.source, input.imagePath);
}

/** Feedback newer than this owner's last look at the inbox (or the last 14 days, before their first look). */
export function unreadFeedback(venueId: string, userId: string): { count: number; latest: string | null } {
  const db = getDb();
  const seen = db.prepare("SELECT feedback_seen_at FROM venue_members WHERE venue_id = ? AND user_id = ?").get(venueId, userId) as { feedback_seen_at: string | null } | undefined;
  const since = seen?.feedback_seen_at ?? null;
  const where = since ? "created_at > ?" : "created_at >= datetime('now', '-14 days')";
  const args = since ? [venueId, since] : [venueId];
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE venue_id = ? AND ${where}`).get(...args) as { n: number }).n;
  const latest = count
    ? ((db.prepare(`SELECT text FROM feedback WHERE venue_id = ? AND ${where} ORDER BY created_at DESC LIMIT 1`).get(...args) as { text: string } | undefined)?.text ?? null)
    : null;
  return { count, latest };
}

export function markFeedbackSeen(venueId: string, userId: string) {
  getDb().prepare("UPDATE venue_members SET feedback_seen_at = datetime('now') WHERE venue_id = ? AND user_id = ?").run(venueId, userId);
}

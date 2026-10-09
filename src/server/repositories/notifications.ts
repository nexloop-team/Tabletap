import "server-only";
import { getDb } from "../db";

/** Per owner, per venue email preferences. A missing row means "on". */

export async function weeklyDigestEnabled(userId: string, venueId: string): Promise<boolean> {
  const row = (await (await getDb()).get("SELECT weekly_digest FROM notification_prefs WHERE user_id = ? AND venue_id = ?", userId, venueId)) as
    | { weekly_digest: number }
    | undefined;
  return row ? row.weekly_digest === 1 : true;
}

export async function setWeeklyDigest(userId: string, venueId: string, enabled: boolean) {
  (await (await getDb()).run(
      `INSERT INTO notification_prefs (user_id, venue_id, weekly_digest) VALUES (?, ?, ?)
       ON CONFLICT (user_id, venue_id) DO UPDATE SET weekly_digest = excluded.weekly_digest`, userId, venueId, enabled ? 1 : 0));
}

export interface DigestRecipient {
  venueId: string;
  venueName: string;
  userId: string;
  email: string;
  name: string;
}

/** Verified owners of active venues older than two days who haven't switched the digest off. */
export async function digestRecipients(): Promise<DigestRecipient[]> {
  const rows = (await (await getDb()).all(
      `SELECT m.venue_id, (v.config::jsonb->>'name') AS venue_name, u.id AS user_id, u.email, u.name
         FROM venue_members m
         JOIN users u ON u.id = m.user_id
         JOIN venues v ON v.id = m.venue_id
         LEFT JOIN notification_prefs p ON p.user_id = u.id AND p.venue_id = m.venue_id
        WHERE m.role = 'owner' AND u.email_verified_at IS NOT NULL AND v.status = 'active'
          AND v.created_at <= now() + INTERVAL '-2 days'
          AND COALESCE(p.weekly_digest, 1) = 1`,
    )) as { venue_id: string; venue_name: string; user_id: string; email: string; name: string }[];
  return rows.map((row) => ({ venueId: row.venue_id, venueName: row.venue_name, userId: row.user_id, email: row.email, name: row.name }));
}

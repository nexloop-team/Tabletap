import "server-only";
import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db";
import { newToken } from "../ids";

// ─── Refer-a-friend ──────────────────────────────────────────────────────────

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(length = 8): string {
  return Array.from(randomBytes(length), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** The member's invite code, created the first time they look at their card. */
export function ensureReferralCode(cardId: string): string {
  const db = getDb();
  const existing = db.prepare("SELECT referral_code FROM loyalty_cards WHERE id = ?").get(cardId) as { referral_code: string | null } | undefined;
  if (existing?.referral_code) return existing.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const result = db.prepare("UPDATE loyalty_cards SET referral_code = ? WHERE id = ? AND referral_code IS NULL").run(code, cardId);
      if (result.changes === 1) return code;
      return (db.prepare("SELECT referral_code FROM loyalty_cards WHERE id = ?").get(cardId) as { referral_code: string }).referral_code;
    } catch {
      /* code already taken by another card: try another */
    }
  }
  throw new Error("Couldn't allocate a referral code");
}

export function findReferrerCard(db: DatabaseSync, venueId: string, code: string): { id: string; customer_id: string } | null {
  return (
    (db.prepare("SELECT id, customer_id FROM loyalty_cards WHERE venue_id = ? AND referral_code = ?").get(venueId, code.toLowerCase()) as
      | { id: string; customer_id: string }
      | undefined) ?? null
  );
}

export function attachReferral(db: DatabaseSync, cardId: string, referrerCardId: string) {
  db.prepare("UPDATE loyalty_cards SET referred_by_card_id = ? WHERE id = ?").run(referrerCardId, cardId);
}

/** Claims the one-time referral reward for this (friend's) card; false if already claimed or not referred. */
export function claimReferralReward(db: DatabaseSync, cardId: string): string | null {
  const row = db.prepare("SELECT referred_by_card_id FROM loyalty_cards WHERE id = ? AND referred_by_card_id IS NOT NULL AND referral_rewarded_at IS NULL").get(cardId) as
    | { referred_by_card_id: string }
    | undefined;
  if (!row) return null;
  db.prepare("UPDATE loyalty_cards SET referral_rewarded_at = datetime('now') WHERE id = ?").run(cardId);
  return row.referred_by_card_id;
}

export function referralRewardsInLast(db: DatabaseSync, referrerCardId: string, days: number): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ? AND kind = 'referral' AND undone_at IS NULL AND created_at >= datetime('now', ?)")
      .get(referrerCardId, `-${days} days`) as { n: number }
  ).n;
}

/** For the owner: friends who joined through an invite, and how many of those have visited. */
export function referralStats(venueId: string): { joined: number; visited: number } {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS joined, COUNT(referral_rewarded_at) AS visited
         FROM loyalty_cards WHERE venue_id = ? AND referred_by_card_id IS NOT NULL`,
    )
    .get(venueId) as { joined: number; visited: number };
  // node:sqlite rows have a null prototype, which React won't pass to client components.
  return { joined: row.joined, visited: row.visited };
}

// ─── Guest emails ────────────────────────────────────────────────────────────

/** Records that an email went out; false means it was already sent for this key. */
export function claimGuestEmail(customerId: string, kind: string, key: string): boolean {
  return getDb().prepare("INSERT OR IGNORE INTO guest_emails (customer_id, kind, key) VALUES (?, ?, ?)").run(customerId, kind, key).changes === 1;
}

export function releaseGuestEmail(customerId: string, kind: string, key: string) {
  getDb().prepare("DELETE FROM guest_emails WHERE customer_id = ? AND kind = ? AND key = ?").run(customerId, kind, key);
}

export function ensureUnsubscribeToken(customerId: string): string {
  const db = getDb();
  const row = db.prepare("SELECT unsubscribe_token FROM customers WHERE id = ?").get(customerId) as { unsubscribe_token: string | null } | undefined;
  if (row?.unsubscribe_token) return row.unsubscribe_token;
  const token = newToken();
  db.prepare("UPDATE customers SET unsubscribe_token = ? WHERE id = ? AND unsubscribe_token IS NULL").run(token, customerId);
  return (db.prepare("SELECT unsubscribe_token FROM customers WHERE id = ?").get(customerId) as { unsubscribe_token: string }).unsubscribe_token;
}

export function findByUnsubscribeToken(token: string): { customerId: string; venueId: string; consent: string } | null {
  const row = getDb().prepare("SELECT id, venue_id, marketing_consent FROM customers WHERE unsubscribe_token = ?").get(token) as
    | { id: string; venue_id: string; marketing_consent: string }
    | undefined;
  return row ? { customerId: row.id, venueId: row.venue_id, consent: row.marketing_consent } : null;
}

export function unsubscribe(customerId: string) {
  getDb().prepare("UPDATE customers SET marketing_consent = 'declined', consent_updated_at = datetime('now') WHERE id = ?").run(customerId);
}

export interface EmailableGuest {
  id: string;
  email: string;
  firstName: string | null;
}

/** Opted-in guests whose birthday is on this month/day. */
export function birthdayGuests(venueId: string, month: number, days: number[]): EmailableGuest[] {
  const rows = getDb()
    .prepare(
      `SELECT id, email, first_name FROM customers
        WHERE venue_id = ? AND marketing_consent = 'granted' AND birthday_month = ?
          AND birthday_day IN (${days.map(() => "?").join(", ")})`,
    )
    .all(venueId, month, ...days) as { id: string; email: string; first_name: string | null }[];
  return rows.map((row) => ({ id: row.id, email: row.email, firstName: row.first_name }));
}

/**
 * Opted-in guests not seen for `days` days. "Seen" is the latest stamp,
 * redemption or Wi-Fi visit, falling back to when they joined.
 */
export function lapsedGuests(venueId: string, days: number, limit = 200): (EmailableGuest & { lastSeen: string })[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM (
         SELECT c.id, c.email, c.first_name,
                MAX(
                  c.created_at,
                  COALESCE((SELECT MAX(s.created_at) FROM stamp_events s JOIN loyalty_cards l ON l.id = s.card_id
                             WHERE l.customer_id = c.id AND s.kind IN ('stamp', 'redeem') AND s.undone_at IS NULL), c.created_at),
                  COALESCE((SELECT MAX(v.created_at) FROM visits v WHERE v.customer_id = c.id), c.created_at)
                ) AS last_seen
           FROM customers c
          WHERE c.venue_id = ? AND c.marketing_consent = 'granted'
       ) WHERE last_seen < datetime('now', ?)
       LIMIT ?`,
    )
    .all(venueId, `-${days} days`, limit) as { id: string; email: string; first_name: string | null; last_seen: string }[];
  return rows.map((row) => ({ id: row.id, email: row.email, firstName: row.first_name, lastSeen: row.last_seen }));
}

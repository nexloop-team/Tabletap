import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db";
import { newId, newToken } from "../ids";

export interface LoyaltyCardRow {
  id: string;
  venue_id: string;
  customer_id: string;
  access_token: string;
  stamps: number;
  last_pass_email_at: string | null;
  last_feedback_stamp_at: string | null;
  created_at: string;
}

export function findCardByCustomer(db: DatabaseSync, customerId: string): LoyaltyCardRow | null {
  return (db.prepare("SELECT * FROM loyalty_cards WHERE customer_id = ?").get(customerId) as LoyaltyCardRow | undefined) ?? null;
}

export function createCard(db: DatabaseSync, venueId: string, customerId: string, initialStamps: number): LoyaltyCardRow {
  const id = newId("crd");
  db.prepare("INSERT INTO loyalty_cards (id, venue_id, customer_id, access_token, stamps) VALUES (?, ?, ?, ?, ?)").run(
    id,
    venueId,
    customerId,
    newToken(),
    initialStamps,
  );
  return db.prepare("SELECT * FROM loyalty_cards WHERE id = ?").get(id) as unknown as LoyaltyCardRow;
}

export function addFeedbackStamp(db: DatabaseSync, cardId: string): number {
  db.prepare("UPDATE loyalty_cards SET stamps = stamps + 1, last_feedback_stamp_at = datetime('now') WHERE id = ?").run(cardId);
  return (db.prepare("SELECT stamps FROM loyalty_cards WHERE id = ?").get(cardId) as { stamps: number }).stamps;
}

export function markPassEmailed(db: DatabaseSync, cardId: string) {
  db.prepare("UPDATE loyalty_cards SET last_pass_email_at = datetime('now') WHERE id = ?").run(cardId);
}

/** For the public card page: the id alone is not enough, the emailed token is required. */
export function findCardForViewer(cardId: string, token: string) {
  return (
    (getDb()
      .prepare(
        `SELECT c.id, c.stamps, c.created_at, c.venue_id, cu.first_name, cu.name
           FROM loyalty_cards c JOIN customers cu ON cu.id = c.customer_id
          WHERE c.id = ? AND c.access_token = ?`,
      )
      .get(cardId, token) as
      | { id: string; stamps: number; created_at: string; venue_id: string; first_name: string | null; name: string | null }
      | undefined) ?? null
  );
}

/** SQLite datetime('now') strings are UTC without a zone marker. */
export function hoursSince(sqliteUtc: string | null): number {
  if (!sqliteUtc) return Infinity;
  return (Date.now() - new Date(`${sqliteUtc.replace(" ", "T")}Z`).getTime()) / 3_600_000;
}

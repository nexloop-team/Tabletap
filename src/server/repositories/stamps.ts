import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db";

/**
 * The stamp ledger: every change to a card's stamp count, who made it and
 * when. Undo marks the original event and records a compensating one, so the
 * history always adds up to the card's balance.
 */

export type StampEventKind = "stamp" | "redeem" | "undo" | "feedback" | "bonus" | "referral";

export interface StampEvent {
  id: number;
  venue_id: string;
  card_id: string;
  kind: StampEventKind;
  delta: number;
  reward_name: string | null;
  device_id: string | null;
  undone_at: string | null;
  created_at: string;
}

export function recordStampEvent(
  db: DatabaseSync,
  input: { venueId: string; cardId: string; kind: StampEventKind; delta: number; rewardName?: string | null; deviceId?: string | null },
): number {
  const result = db
    .prepare("INSERT INTO stamp_events (venue_id, card_id, kind, delta, reward_name, device_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.venueId, input.cardId, input.kind, input.delta, input.rewardName ?? null, input.deviceId ?? null);
  return Number(result.lastInsertRowid);
}

/** The most recent staff action on a card that can still be undone. */
export function lastUndoableEvent(db: DatabaseSync, cardId: string, withinMinutes: number): StampEvent | null {
  return (
    (db
      .prepare(
        `SELECT * FROM stamp_events
          WHERE card_id = ? AND kind IN ('stamp', 'redeem') AND undone_at IS NULL
            AND created_at >= datetime('now', ?)
          ORDER BY id DESC LIMIT 1`,
      )
      .get(cardId, `-${withinMinutes} minutes`) as StampEvent | undefined) ?? null
  );
}

/** When staff last stamped this card (ignoring undone stamps), for the cooldown. */
export function lastStaffStampAt(db: DatabaseSync, cardId: string): string | null {
  const row = db
    .prepare("SELECT created_at FROM stamp_events WHERE card_id = ? AND kind = 'stamp' AND undone_at IS NULL ORDER BY id DESC LIMIT 1")
    .get(cardId) as { created_at: string } | undefined;
  return row?.created_at ?? null;
}

export function markUndone(db: DatabaseSync, eventId: number) {
  db.prepare("UPDATE stamp_events SET undone_at = datetime('now') WHERE id = ?").run(eventId);
}

export function recentEvents(cardId: string, limit = 5): StampEvent[] {
  return getDb().prepare("SELECT * FROM stamp_events WHERE card_id = ? ORDER BY id DESC LIMIT ?").all(cardId, limit) as unknown as StampEvent[];
}

/** Stamps given by staff and rewards handed out over the last `days` days. */
export function stampActivity(venueId: string, days: number): { stampsGiven: number; rewardsRedeemed: number } {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'stamp' THEN delta END), 0) AS stamps,
              COUNT(CASE WHEN kind = 'redeem' THEN 1 END) AS redeemed
         FROM stamp_events
        WHERE venue_id = ? AND undone_at IS NULL AND created_at >= datetime('now', ?)`,
    )
    .get(venueId, `-${days} days`) as { stamps: number; redeemed: number };
  return { stampsGiven: row.stamps, rewardsRedeemed: row.redeemed };
}

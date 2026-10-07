import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { StaffCardView } from "@/lib/api/staff-contracts";
import { maskEmail } from "@/lib/validation";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import { hasLoyaltyProgram } from "@/lib/venue/features";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { newToken } from "../ids";
import { findCardById, setCardStamps, type LoyaltyCardRow } from "../repositories/loyalty-cards";
import { lastStaffStampAt, lastUndoableEvent, markUndone, recordStampEvent } from "../repositories/stamps";
import { findVenue, getVenueSettings } from "../repositories/venues";
import { onStaffStamp } from "./retention";

/**
 * Staff stamping without staff accounts: the owner pairs a till phone or
 * tablet with a one-time link, which leaves a long-lived device cookie. The
 * guest shows the QR on their card; staff scan it with the normal camera and
 * land on the stamp page for that card. Security rests on the device pairing,
 * so the QR only needs to name the card.
 */

export const STAFF_COOKIE = "tt_staff";
const PAIRING_MINUTES = 15;
const DEVICE_DAYS = 365;
const UNDO_MINUTES = 10;
const MAX_STAMPS_PER_ACTION = 5;

const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

export interface StaffDevice {
  id: string;
  venueId: string;
  label: string;
}

export interface StaffDeviceRow {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── Pairing (owner side) ────────────────────────────────────────────────────

/** A one-time link the owner opens on the device that should become a till device. */
export function createPairing(venueId: string, label: string, userId: string | null = null): { token: string; expiresAt: string } {
  const token = newToken();
  const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000).toISOString();
  getDb()
    .prepare("INSERT INTO staff_pairings (id, venue_id, label, expires_at, user_id) VALUES (?, ?, ?, ?, ?)")
    .run(digest(token), venueId, label, expiresAt, userId);
  return { token, expiresAt };
}

/** Turns a pairing link into a device cookie. Returns false for a used, expired or unknown link. */
export async function completePairing(token: string): Promise<boolean> {
  const deviceToken = newToken();
  const paired = transaction((db) => {
    const pairing = db.prepare("SELECT venue_id, label, expires_at, used_at, user_id FROM staff_pairings WHERE id = ?").get(digest(token)) as
      | { venue_id: string; label: string; expires_at: string; used_at: string | null; user_id: string | null }
      | undefined;
    if (!pairing || pairing.used_at || Date.parse(pairing.expires_at) <= Date.now()) return false;
    db.prepare("UPDATE staff_pairings SET used_at = datetime('now') WHERE id = ?").run(digest(token));
    db.prepare("INSERT INTO staff_devices (id, venue_id, label, user_id) VALUES (?, ?, ?, ?)").run(digest(deviceToken), pairing.venue_id, pairing.label, pairing.user_id);
    return true;
  });
  if (!paired) return false;
  (await cookies()).set(STAFF_COOKIE, deviceToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + DEVICE_DAYS * 86_400_000),
  });
  return true;
}

export function listStaffDevices(venueId: string): StaffDeviceRow[] {
  const rows = getDb()
    .prepare("SELECT id, label, created_at, last_used_at FROM staff_devices WHERE venue_id = ? AND revoked_at IS NULL ORDER BY created_at")
    .all(venueId) as { id: string; label: string; created_at: string; last_used_at: string | null }[];
  return rows.map((row) => ({ id: row.id, label: row.label, createdAt: row.created_at, lastUsedAt: row.last_used_at }));
}

export function revokeStaffDevice(venueId: string, deviceId: string) {
  const result = getDb().prepare("UPDATE staff_devices SET revoked_at = datetime('now') WHERE id = ? AND venue_id = ? AND revoked_at IS NULL").run(deviceId, venueId);
  if (result.changes === 0) throw new ServiceError(404, "Device not found");
}

// ─── The device itself ───────────────────────────────────────────────────────

/** The paired device making this request, or null. */
export const currentStaffDevice = cache(async (): Promise<StaffDevice | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const row = getDb().prepare("SELECT id, venue_id, label FROM staff_devices WHERE id = ? AND revoked_at IS NULL").get(digest(token)) as
    | { id: string; venue_id: string; label: string }
    | undefined;
  return row ? { id: row.id, venueId: row.venue_id, label: row.label } : null;
});

export async function requireStaffDevice(): Promise<StaffDevice> {
  const device = await currentStaffDevice();
  if (!device) throw new ServiceError(401, "This device isn't paired for stamping. Ask the owner to add it in the dashboard.");
  return device;
}

// ─── Stamping ────────────────────────────────────────────────────────────────

function stampVenue(device: StaffDevice): PublicVenue {
  // findVenue applies the plan, so a lapsed Pro venue can't keep stamping.
  const venue = findVenue(device.venueId);
  if (!venue || !hasLoyaltyProgram(venue)) throw new ServiceError(400, "This venue has no active stamp card");
  return venue;
}

function requireCard(device: StaffDevice, cardId: string): LoyaltyCardRow {
  const card = findCardById(getDb(), cardId);
  if (!card || card.venue_id !== device.venueId) throw new ServiceError(404, "We couldn't find that card at this venue");
  return card;
}

function touchDevice(deviceId: string) {
  getDb().prepare("UPDATE staff_devices SET last_used_at = datetime('now') WHERE id = ?").run(deviceId);
}

export function viewCard(device: StaffDevice, cardId: string): StaffCardView {
  const venue = stampVenue(device);
  const card = requireCard(device, cardId);
  const customer = getDb().prepare("SELECT email, first_name, name FROM customers WHERE id = ?").get(card.customer_id) as {
    email: string;
    first_name: string | null;
    name: string | null;
  };
  const tiers = programTiers(venue.loyaltyProgram);
  const undoable = lastUndoableEvent(getDb(), card.id, UNDO_MINUTES);
  return {
    cardId: card.id,
    venueName: venue.name,
    guestName: customer.first_name || customer.name,
    guestEmail: maskEmail(customer.email),
    stamps: card.stamps,
    goal: stampGoal(tiers),
    tiers: tiers.map((tier, index) => ({ index, rewardName: tier.rewardName, stampsRequired: tier.stampsRequired, unlocked: card.stamps >= tier.stampsRequired })),
    undoable: undoable ? { kind: undoable.kind, delta: undoable.delta, rewardName: undoable.reward_name } : null,
  };
}

/** Minutes since the last staff stamp, if inside the venue's cooldown. */
function cooldownMinutesLeft(venueId: string, cardId: string): number | null {
  const { cooldownMinutes } = getVenueSettings(venueId).stampPolicy;
  if (cooldownMinutes === 0) return null;
  const last = lastStaffStampAt(getDb(), cardId);
  if (!last) return null;
  const minutesAgo = (Date.now() - Date.parse(`${last.replace(" ", "T")}Z`)) / 60_000;
  return minutesAgo < cooldownMinutes ? Math.max(0, Math.floor(minutesAgo)) : null;
}

/**
 * Adds stamps, capped at the top reward. Inside the cooldown it refuses with
 * 409 so the till can ask "add another anyway?" and retry with `force`.
 */
export function stampCard(device: StaffDevice, cardId: string, count: number, force: boolean): StaffCardView {
  const venue = stampVenue(device);
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  const requested = Math.min(Math.max(1, Math.floor(count)), MAX_STAMPS_PER_ACTION);
  if (!force) {
    const minutesAgo = cooldownMinutesLeft(device.venueId, cardId);
    if (minutesAgo !== null) throw new ServiceError(409, `This card was stamped ${minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`}. Add another anyway?`);
  }
  const { before, after } = transaction((db) => {
    const card = requireCard(device, cardId);
    const next = Math.min(card.stamps + requested, goal);
    if (next === card.stamps) throw new ServiceError(400, "This card is full. Redeem the reward first.");
    setCardStamps(db, card.id, next);
    recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "stamp", delta: next - card.stamps, deviceId: device.id });
    return { before: card.stamps, after: next };
  });
  touchDevice(device.id);
  onStaffStamp({ venue, cardId, before, after });
  return viewCard(device, cardId);
}

export function redeemReward(device: StaffDevice, cardId: string, tierIndex: number): StaffCardView {
  const venue = stampVenue(device);
  const tier = programTiers(venue.loyaltyProgram)[tierIndex];
  if (!tier) throw new ServiceError(400, "That reward doesn't exist any more. Refresh and try again.");
  transaction((db) => {
    const card = requireCard(device, cardId);
    if (card.stamps < tier.stampsRequired) throw new ServiceError(400, `Not enough stamps for ${tier.rewardName} yet`);
    setCardStamps(db, card.id, card.stamps - tier.stampsRequired);
    recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "redeem", delta: -tier.stampsRequired, rewardName: tier.rewardName, deviceId: device.id });
  });
  touchDevice(device.id);
  return viewCard(device, cardId);
}

/** Reverses the last stamp or redemption on this card, if made in the last few minutes. */
export function undoLast(device: StaffDevice, cardId: string): StaffCardView {
  const venue = stampVenue(device);
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  transaction((db) => {
    const card = requireCard(device, cardId);
    const event = lastUndoableEvent(db, card.id, UNDO_MINUTES);
    if (!event) throw new ServiceError(400, `Nothing to undo. Only the last ${UNDO_MINUTES} minutes can be undone.`);
    const next = Math.min(Math.max(card.stamps - event.delta, 0), Math.max(goal, card.stamps));
    setCardStamps(db, card.id, next);
    markUndone(db, event.id);
    recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "undo", delta: next - card.stamps, rewardName: event.reward_name, deviceId: device.id });
  });
  touchDevice(device.id);
  return viewCard(device, cardId);
}

export interface MemberMatch {
  cardId: string;
  name: string | null;
  email: string;
  stamps: number;
}

/** Fallback for guests without their card to hand: find them by name or email. */
export function searchMembers(device: StaffDevice, query: string): MemberMatch[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = getDb()
    .prepare(
      `SELECT l.id, l.stamps, c.email, c.first_name, c.name
         FROM loyalty_cards l JOIN customers c ON c.id = l.customer_id
        WHERE l.venue_id = ? AND (c.email LIKE ? OR LOWER(COALESCE(c.first_name, '') || ' ' || COALESCE(c.name, '')) LIKE ?)
        ORDER BY c.created_at DESC LIMIT 20`,
    )
    .all(device.venueId, like, like) as { id: string; stamps: number; email: string; first_name: string | null; name: string | null }[];
  return rows.map((row) => ({ cardId: row.id, name: row.first_name || row.name, email: maskEmail(row.email), stamps: row.stamps }));
}

export interface TillActivity {
  cardId: string;
  name: string | null;
  kind: "stamp" | "redeem";
  delta: number;
  rewardName: string | null;
  undone: boolean;
  /** SQLite UTC timestamp. */
  at: string;
  deviceLabel: string | null;
}

/** The latest stamps and rewards at this venue, from any till, newest first: "did we already stamp them?" */
export function recentTillActivity(device: StaffDevice, limit = 5): TillActivity[] {
  const rows = getDb()
    .prepare(
      `SELECT e.card_id, e.kind, e.delta, e.reward_name, e.undone_at, e.created_at, c.first_name, c.name, d.label AS device_label
         FROM stamp_events e
         JOIN loyalty_cards l ON l.id = e.card_id
         JOIN customers c ON c.id = l.customer_id
         LEFT JOIN staff_devices d ON d.id = e.device_id
        WHERE e.venue_id = ? AND e.kind IN ('stamp', 'redeem')
        ORDER BY e.id DESC LIMIT ?`,
    )
    .all(device.venueId, limit) as {
    card_id: string;
    kind: "stamp" | "redeem";
    delta: number;
    reward_name: string | null;
    undone_at: string | null;
    created_at: string;
    first_name: string | null;
    name: string | null;
    device_label: string | null;
  }[];
  return rows.map((row) => ({
    cardId: row.card_id,
    name: row.first_name || row.name,
    kind: row.kind,
    delta: row.delta,
    rewardName: row.reward_name,
    undone: !!row.undone_at,
    at: row.created_at,
    deviceLabel: row.device_label,
  }));
}

import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PlanId } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/plans";
import { applyEntitlements } from "@/lib/venue/entitlements";
import { liveAnnouncement } from "@/lib/venue/features";
import { localDate } from "../jobs/time";
import type { VenueConfig } from "@/lib/venue/schema";
import { resolveSettings, type VenueSettings } from "@/lib/venue/settings";
import type { PublicVenue } from "@/lib/venue/types";
import { DATA_DIR, getDb, transaction } from "../db";
import { entitlementsFor, startTrial } from "./subscriptions";

export type VenueStatus = "active" | "suspended";

interface VenueRow {
  id: string;
  short_code: string;
  config: string;
  status: VenueStatus;
  created_at: string;
  updated_at: string | null;
}

function toVenue(row: VenueRow): PublicVenue {
  const config = JSON.parse(row.config) as Omit<PublicVenue, "id" | "shortCode">;
  return {
    ...config,
    id: row.id,
    shortCode: row.short_code,
    socialLinks: config.socialLinks ?? {},
    menus: config.menus ?? [],
    externalLinks: config.externalLinks ?? [],
    branding: config.branding ?? {},
    crm: {
      enabled: !!config.crm?.enabled,
      consentAsk: !!config.crm?.consentAsk,
      wifiCapture: !!config.crm?.wifiCapture,
      feedbackCapture: !!config.crm?.feedbackCapture,
      birthdayAsk: !!config.crm?.birthdayAsk,
    },
  };
}

/**
 * Accepts the canonical id or the short code printed in QR codes. This is the
 * guest-facing lookup: suspended venues don't resolve, and features the plan
 * doesn't include are switched off.
 */
export function findVenue(idOrCode: string): PublicVenue | null {
  const row = getDb()
    .prepare("SELECT * FROM venues WHERE (id = ? OR short_code = ?) AND status = 'active' LIMIT 1")
    .get(idOrCode, idOrCode) as VenueRow | undefined;
  if (!row) return null;
  const venue = applyEntitlements(toVenue(row), entitlementsFor(row.id).can);
  return { ...venue, announcement: liveAnnouncement(venue.announcement, localDate(new Date())) };
}

/** The merchant's own view: the saved configuration, whatever the plan. */
export interface VenueRecord {
  id: string;
  shortCode: string;
  status: VenueStatus;
  config: VenueConfig;
  createdAt: string;
  updatedAt: string | null;
}

function toRecord(row: VenueRow): VenueRecord {
  const { id, shortCode, ...config } = toVenue(row);
  return { id, shortCode, status: row.status, config: config as VenueConfig, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function getVenueRecord(venueId: string): VenueRecord | null {
  const row = getDb().prepare("SELECT * FROM venues WHERE id = ?").get(venueId) as VenueRow | undefined;
  return row ? toRecord(row) : null;
}

export function listVenuesForUser(userId: string): VenueRecord[] {
  const rows = getDb()
    .prepare("SELECT v.* FROM venues v JOIN venue_members m ON m.venue_id = v.id WHERE m.user_id = ? ORDER BY v.created_at")
    .all(userId) as unknown as VenueRow[];
  return rows.map(toRecord);
}

export function venueRole(userId: string, venueId: string): string | null {
  const row = getDb().prepare("SELECT role FROM venue_members WHERE user_id = ? AND venue_id = ?").get(userId, venueId) as { role: string } | undefined;
  return row?.role ?? null;
}

export function shortCodeTaken(code: string, exceptVenueId = ""): boolean {
  return !!getDb().prepare("SELECT 1 FROM venues WHERE (short_code = ? OR id = ?) AND id != ?").get(code, code, exceptVenueId);
}

export function createVenue(input: { id: string; shortCode: string; ownerId: string; config: VenueConfig }) {
  transaction((db) => {
    db.prepare("INSERT INTO venues (id, short_code, config, updated_at) VALUES (?, ?, ?, datetime('now'))").run(
      input.id,
      input.shortCode,
      JSON.stringify(input.config),
    );
    db.prepare("INSERT INTO venue_members (venue_id, user_id, role) VALUES (?, ?, 'owner')").run(input.id, input.ownerId);
    startTrial(db, input.id, TRIAL_DAYS);
  });
}

/** Saves a new config and keeps the one it replaces, so the last save can be undone. */
export function updateVenueConfig(venueId: string, config: VenueConfig) {
  getDb()
    .prepare("UPDATE venues SET previous_config = config, config = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(config), venueId);
}

/**
 * Swaps the config with the one before the last save. Doing it twice redoes
 * the save. Returns false when there's nothing to go back to.
 */
export function restorePreviousConfig(venueId: string): boolean {
  const result = getDb()
    .prepare("UPDATE venues SET config = previous_config, previous_config = config, updated_at = datetime('now') WHERE id = ? AND previous_config IS NOT NULL")
    .run(venueId);
  return Number(result.changes) > 0;
}

export function updateShortCode(venueId: string, shortCode: string) {
  getDb().prepare("UPDATE venues SET short_code = ?, updated_at = datetime('now') WHERE id = ?").run(shortCode, venueId);
}

/** Owner-only settings (stamp policy, automations), with defaults filled in. */
export function getVenueSettings(venueId: string): VenueSettings {
  const row = getDb().prepare("SELECT settings FROM venues WHERE id = ?").get(venueId) as { settings: string | null } | undefined;
  return resolveSettings(row?.settings ? JSON.parse(row.settings) : null);
}

export function saveVenueSettings(venueId: string, settings: VenueSettings) {
  getDb().prepare("UPDATE venues SET settings = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(settings), venueId);
}

export function setVenueStatus(venueId: string, status: VenueStatus) {
  getDb().prepare("UPDATE venues SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, venueId);
}

/** Removes the venue and everything its guests gave it: data, photos and media. */
export function deleteVenue(venueId: string) {
  const photos = getDb().prepare("SELECT image_path FROM feedback WHERE venue_id = ? AND image_path IS NOT NULL").all(venueId) as { image_path: string }[];
  transaction((db) => {
    db.prepare("DELETE FROM guest_emails WHERE customer_id IN (SELECT id FROM customers WHERE venue_id = ?)").run(venueId);
    for (const table of ["visits", "stamp_events", "loyalty_cards", "customers", "feedback", "events", "ai_usage", "venue_members", "subscriptions"]) {
      db.prepare(`DELETE FROM ${table} WHERE venue_id = ?`).run(venueId);
    }
    db.prepare("DELETE FROM venues WHERE id = ?").run(venueId);
  });
  for (const photo of photos) fs.rmSync(path.join(DATA_DIR, photo.image_path), { force: true });
  fs.rmSync(path.join(DATA_DIR, "media", venueId), { recursive: true, force: true });
}

/** Venues where this user is the only owner, which go with the account. */
export function venuesOwnedSolelyBy(userId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT m.venue_id FROM venue_members m
       WHERE m.user_id = ? AND m.role = 'owner'
         AND NOT EXISTS (SELECT 1 FROM venue_members o WHERE o.venue_id = m.venue_id AND o.user_id != m.user_id AND o.role = 'owner')`,
    )
    .all(userId) as { venue_id: string }[];
  return rows.map((row) => row.venue_id);
}

export interface AdminVenueRow {
  id: string;
  shortCode: string;
  name: string;
  status: VenueStatus;
  createdAt: string;
  ownerEmail: string | null;
  plan: PlanId;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  guests: number;
}

export function listVenuesForAdmin(limit = 500): AdminVenueRow[] {
  const rows = getDb()
    .prepare(
      `SELECT v.id, v.short_code, json_extract(v.config, '$.name') AS name, v.status, v.created_at,
              (SELECT u.email FROM venue_members m JOIN users u ON u.id = m.user_id WHERE m.venue_id = v.id AND m.role = 'owner' LIMIT 1) AS owner_email,
              s.plan, s.status AS sub_status, s.trial_ends_at,
              (SELECT COUNT(*) FROM customers c WHERE c.venue_id = v.id) AS guests
       FROM venues v LEFT JOIN subscriptions s ON s.venue_id = v.id
       ORDER BY v.created_at DESC LIMIT ?`,
    )
    .all(limit) as {
    id: string;
    short_code: string;
    name: string;
    status: VenueStatus;
    created_at: string;
    owner_email: string | null;
    plan: PlanId | null;
    sub_status: string | null;
    trial_ends_at: string | null;
    guests: number;
  }[];
  return rows.map((row) => ({
    id: row.id,
    shortCode: row.short_code,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    ownerEmail: row.owner_email,
    plan: row.plan ?? "free",
    subscriptionStatus: row.sub_status,
    trialEndsAt: row.trial_ends_at,
    guests: row.guests,
  }));
}

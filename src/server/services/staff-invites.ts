import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { BRAND } from "@/config/brand";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import type { User } from "../repositories/users";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { addStaffMember, isManagerRole, venueRole, type VenueRecord } from "../repositories/venues";
import { sendMail } from "./mailer";
import { completePairing, createPairing, currentStaffDevice } from "./staff";

/**
 * Staff logins. An owner invites someone by email; the link adds them to the
 * venue as "staff" once they've signed in (or signed up). Staff can't open the
 * dashboard: signing in just lets them turn the phone they're holding into a
 * till device, the same as the owner's pairing link.
 */

const INVITE_DAYS = 7;
const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

export function createStaffInvite(venue: VenueRecord, inviter: User, rawEmail: string, origin: string): { url: string } {
  const email = normaliseEmail(rawEmail);
  if (!isPlausibleEmail(email)) throw new ServiceError(400, "Enter the staff member's email address");
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  getDb()
    .prepare("INSERT INTO staff_invites (id, venue_id, email, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(digest(token), venue.id, email, inviter.id, expiresAt);
  const url = `${origin}/staff/join?t=${encodeURIComponent(token)}`;
  sendMail({
    to: email,
    subject: `${inviter.name || venue.config.name} invited you to stamp cards at ${venue.config.name}`,
    text: [
      `You've been invited to use the till at ${venue.config.name} on ${BRAND.name}.`,
      "",
      "Open this link on the phone or tablet you'll use behind the counter, then sign in or create a free account:",
      url,
      "",
      `The link works for ${INVITE_DAYS} days. Staff accounts can stamp cards and give out rewards, nothing else.`,
    ].join("\n"),
  });
  return { url };
}

/** Uses an invite for this signed-in user. Returns the venue id, or null for a used, expired or unknown link. */
export function acceptStaffInvite(token: string, user: User): string | null {
  return transaction((db) => {
    const invite = db.prepare("SELECT venue_id, expires_at, used_at FROM staff_invites WHERE id = ?").get(digest(token)) as
      | { venue_id: string; expires_at: string; used_at: string | null }
      | undefined;
    if (!invite || invite.used_at || Date.parse(invite.expires_at) <= Date.now()) return null;
    db.prepare("UPDATE staff_invites SET used_at = datetime('now') WHERE id = ?").run(digest(token));
    addStaffMember(invite.venue_id, user.id);
    return invite.venue_id;
  });
}

/**
 * Turns the browser a staff member (or owner) is signed in on into a till
 * device for the venue. Throws for anyone without a membership there.
 */
export async function openTillForUser(user: User, venueId: string): Promise<void> {
  const role = venueRole(user.id, venueId);
  if (role !== "staff" && !isManagerRole(role)) throw new ServiceError(404, "Venue not found");
  // Already a till for this venue: don't add a duplicate to the owner's device list.
  if ((await currentStaffDevice())?.venueId === venueId) return;
  const { token } = createPairing(venueId, `${user.name || user.email.split("@")[0]}'s login`, user.id);
  if (!(await completePairing(token))) throw new ServiceError(500, "Couldn't open the till, please try again");
}

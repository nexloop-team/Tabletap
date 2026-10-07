import "server-only";
import { randomBytes } from "node:crypto";
import type { z } from "zod";
import type { updateVenueRequest } from "@/lib/api/account-contracts";
import { createVenueRequest, initialVenueConfig, slugify, venueConfigSchema, type VenueConfig } from "@/lib/venue/schema";
import { isAdmin } from "../auth/session";
import { ServiceError } from "../http";
import { newId } from "../ids";
import type { User } from "../repositories/users";
import { createVenue, deleteVenue, getVenueRecord, isManagerRole, listVenuesForUser, shortCodeTaken, type VenueRecord, updateShortCode, updateVenueConfig, venueRole } from "../repositories/venues";

const MAX_VENUES_PER_ACCOUNT = 20;

/** Paths and words a venue code must not shadow or impersonate. */
const RESERVED_CODES = new Set(["admin", "api", "app", "dashboard", "login", "signup", "support", "help", "billing", "media", "preview", "www", "demo"]);

/** Owners (and operators) only; anyone else gets the same 404 as a missing venue. */
export function requireVenueAccess(user: User, venueId: string): VenueRecord {
  const venue = getVenueRecord(venueId);
  if (!venue || (!isManagerRole(venueRole(user.id, venueId)) && !isAdmin(user))) throw new ServiceError(404, "Venue not found");
  return venue;
}

function availableShortCode(name: string): string {
  const base = slugify(name) || "venue";
  const padded = base.length >= 3 ? base : `${base}-venue`;
  if (!RESERVED_CODES.has(padded) && !shortCodeTaken(padded)) return padded;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${padded.slice(0, 33)}-${randomBytes(3).toString("hex")}`;
    if (!shortCodeTaken(candidate)) return candidate;
  }
  throw new ServiceError(500, "Couldn't find a free venue code, please try again");
}

export function createVenueForUser(user: User, input: z.output<typeof createVenueRequest>): VenueRecord {
  if (listVenuesForUser(user.id).length >= MAX_VENUES_PER_ACCOUNT) {
    throw new ServiceError(400, `An account can hold up to ${MAX_VENUES_PER_ACCOUNT} venues. Contact us for more.`);
  }
  const id = newId("ven");
  const config = venueConfigSchema.parse(initialVenueConfig(input, newId));
  createVenue({ id, shortCode: availableShortCode(input.name), ownerId: user.id, config });
  return getVenueRecord(id)!;
}

/** Applies whole top-level sections over the saved config, then validates the result as one. */
export function updateVenue(venue: VenueRecord, input: z.output<typeof updateVenueRequest>): VenueRecord {
  if (input.config) {
    const merged = { ...venue.config, ...stripUndefined(input.config) };
    const result = venueConfigSchema.safeParse(merged);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new ServiceError(400, issue ? `${issue.message}${issue.path.length ? ` (${issue.path.join(" › ")})` : ""}` : "Invalid settings");
    }
    updateVenueConfig(venue.id, result.data as VenueConfig);
  }
  if (input.shortCode && input.shortCode !== venue.shortCode) {
    if (RESERVED_CODES.has(input.shortCode) || input.shortCode.startsWith("demo")) throw new ServiceError(400, "That code is reserved, please pick another");
    if (shortCodeTaken(input.shortCode, venue.id)) throw new ServiceError(409, "Another venue already uses that code");
    updateShortCode(venue.id, input.shortCode);
  }
  return getVenueRecord(venue.id)!;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function removeVenue(venue: VenueRecord, confirmName: string) {
  if (confirmName.trim() !== venue.config.name.trim()) throw new ServiceError(400, "Type the venue name exactly to confirm");
  deleteVenue(venue.id);
}

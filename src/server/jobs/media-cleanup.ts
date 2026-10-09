import "server-only";
import { getDb } from "../db";
import { storage } from "../storage";
import { claimJob } from "./claims";

/** An upload the owner hasn't saved yet is left alone for this long. */
const GRACE_MS = 24 * 60 * 60_000;

/** "/media/ven_x/img_y.jpg" anywhere in a saved config. */
const MEDIA_URL = /\/media\/(ven_[A-Za-z0-9]+)\/(img_[A-Za-z0-9]+\.(?:jpg|png|webp|gif))/g;

/** The image keys a venue still uses: its saved page, and the version before it (so Undo keeps working). */
export function referencedMedia(venueId: string, ...configs: (string | null)[]): Set<string> {
  const keys = new Set<string>();
  for (const config of configs) {
    for (const m of (config ?? "").matchAll(MEDIA_URL)) {
      if (m[1] === venueId) keys.add(`media/${m[1]}/${m[2]}`);
    }
  }
  return keys;
}

/**
 * Deletes images nothing points to any more: a logo or dish photo that was
 * replaced, or an upload that was never saved. Runs once a day; returns how
 * many files it removed.
 */
export async function runMediaCleanup(now = new Date()): Promise<number> {
  if (!(await claimJob("mediaCleanup", now.toISOString().slice(0, 10)))) return 0;
  const venues = await (await getDb()).all<{ id: string; config: string; previous_config: string | null }>("SELECT id, config, previous_config FROM venues");
  let removed = 0;
  for (const venue of venues) {
    const keep = referencedMedia(venue.id, venue.config, venue.previous_config);
    for (const file of await storage().list(`media/${venue.id}/`)) {
      if (keep.has(file.key) || now.getTime() - file.modified < GRACE_MS) continue;
      await storage().remove(file.key);
      removed += 1;
    }
  }
  return removed;
}

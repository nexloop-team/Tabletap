import "server-only";
import { ServiceError } from "../http";
import { newId } from "../ids";
import { storage } from "../storage";

/**
 * Merchant images (logo, cover, menu photos), kept in storage under
 * media/<venue>/ (disk or an S3-compatible bucket, see ../storage) and
 * served publicly from /media/<venue>/<file>. The type is decided from the
 * file's bytes, never its name or the browser's claim, and SVG is refused
 * because it can carry script.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_VENUE = 500;

export const MEDIA_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export function sniff(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  return null;
}

export async function saveVenueMedia(venueId: string, file: File): Promise<string> {
  if (file.size === 0) throw new ServiceError(400, "That file is empty");
  if (file.size > MAX_BYTES) throw new ServiceError(400, "Images must be under 5 MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) throw new ServiceError(400, "Upload a JPEG, PNG, WebP or GIF image");
  if ((await storage().count(`media/${venueId}/`, MAX_FILES_PER_VENUE)) >= MAX_FILES_PER_VENUE) throw new ServiceError(400, "This venue has reached its image limit");
  const name = `${newId("img")}.${ext}`;
  await storage().put(`media/${venueId}/${name}`, bytes, MEDIA_TYPES[ext]);
  return `/media/${venueId}/${name}`;
}

/** Reads a public media file, or null for anything that isn't one. */
export async function readMedia(venueId: string, file: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!/^ven_[A-Za-z0-9]+$/.test(venueId) || !/^img_[A-Za-z0-9]+\.(jpg|png|webp|gif)$/.test(file)) return null;
  const bytes = await storage().get(`media/${venueId}/${file}`);
  return bytes ? { bytes, contentType: MEDIA_TYPES[file.split(".").pop()!] } : null;
}

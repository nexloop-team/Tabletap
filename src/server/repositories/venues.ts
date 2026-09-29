import "server-only";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb } from "../db";

interface VenueRow {
  id: string;
  short_code: string;
  config: string;
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

/** Accepts the canonical id or the short code printed in QR codes. */
export function findVenue(idOrCode: string): PublicVenue | null {
  const row = getDb()
    .prepare("SELECT id, short_code, config FROM venues WHERE id = ? OR short_code = ? LIMIT 1")
    .get(idOrCode, idOrCode) as VenueRow | undefined;
  return row ? toVenue(row) : null;
}

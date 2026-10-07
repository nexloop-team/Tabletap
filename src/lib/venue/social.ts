import type { SocialLinks } from "./types";

type Platform = Exclude<keyof SocialLinks, "google">;

const PROFILE_URL: Record<Platform, ((handle: string) => string) | null> = {
  instagram: (handle) => `https://instagram.com/${handle}`,
  facebook: (handle) => `https://facebook.com/${handle}`,
  youtube: (handle) => `https://youtube.com/@${handle}`,
  // Tripadvisor pages have no handle; owners paste the full link.
  tripAdvisor: null,
};

/**
 * What an owner typed in a social field, as a link: "@junipercoffee" or
 * "junipercoffee" becomes the profile URL, "instagram.com/x" gains https://,
 * and full links are left alone. Anything else comes back unchanged so the
 * normal validation can explain what's wrong.
 */
export function expandSocialLink(platform: Platform, value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\.[a-z]{2})?\//i.test(raw)) return `https://${raw}`;
  const handle = raw.replace(/^@/, "");
  const build = PROFILE_URL[platform];
  if (build && /^[A-Za-z0-9._-]{1,60}$/.test(handle)) return build(handle);
  return raw;
}

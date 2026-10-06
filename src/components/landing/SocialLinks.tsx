"use client";

import { sanitiseExternalUrl } from "@/lib/venue/features";
import type { SocialLinks as Links } from "@/lib/venue/types";
import type { SocialPlatform } from "../icons";
import { useLanding } from "./LandingContext";

const ORDER: { platform: SocialPlatform; key: keyof Links; label: string }[] = [
  { platform: "facebook", key: "facebook", label: "Facebook" },
  { platform: "instagram", key: "instagram", label: "Instagram" },
  { platform: "tripadvisor", key: "tripAdvisor", label: "Tripadvisor" },
  { platform: "youtube", key: "youtube", label: "YouTube" },
];

/** Single-colour glyphs: they take the page's text colour, so they suit any venue colour. */
function SocialGlyph({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M13.4 21v-7.6H16l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" />
        </svg>
      );
    case "tripadvisor":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <circle cx="7.5" cy="13" r="3.5" />
          <circle cx="16.5" cy="13" r="3.5" />
          <path d="M4 8.5c4.5-3 11.5-3 16 0" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="4" />
          <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" />
        </svg>
      );
  }
}

export function hasSocialLinks(links: Links): boolean {
  return ORDER.some(({ key }) => !!sanitiseExternalUrl(links[key]));
}

/** Facebook → Instagram → Tripadvisor → YouTube, each only with a safe http(s) URL. */
export function SocialLinks({ context, className = "" }: { context: "landing" | "thankyou"; className?: string }) {
  const { venue, track } = useLanding();
  const items = ORDER.map((item) => ({ ...item, url: sanitiseExternalUrl(venue.socialLinks[item.key]) })).filter((item) => item.url);
  if (items.length === 0) return null;
  return (
    <div className={`social-links ${className}`}>
      {items.map((item) => (
        <a
          key={item.platform}
          href={item.url!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.label}
          onClick={() => track("social_link_tapped", { social_platform: item.platform, from_context: context })}
        >
          <SocialGlyph platform={item.platform} />
        </a>
      ))}
    </div>
  );
}

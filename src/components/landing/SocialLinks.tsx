"use client";

import { sanitiseExternalUrl } from "@/lib/venue/features";
import type { SocialLinks as Links } from "@/lib/venue/types";
import { SocialTile, type SocialPlatform } from "../icons";
import { useLanding } from "./LandingContext";

const ORDER: { platform: SocialPlatform; key: keyof Links; label: string }[] = [
  { platform: "facebook", key: "facebook", label: "Facebook" },
  { platform: "instagram", key: "instagram", label: "Instagram" },
  { platform: "tripadvisor", key: "tripAdvisor", label: "Tripadvisor" },
  { platform: "youtube", key: "youtube", label: "YouTube" },
];

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
          <SocialTile platform={item.platform} />
        </a>
      ))}
    </div>
  );
}

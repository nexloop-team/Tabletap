import type { ReactNode } from "react";
import { resolvedTagline, resolvedTitle, safeImageUrl } from "@/lib/venue/features";
import type { VenueBranding } from "@/lib/venue/types";

/**
 * The venue's cover, logo, name and tagline: the top of the guest page and
 * the hosted menu. `overlay` sits on top of the cover (the menu's back link).
 */
export function VenueHeader({ branding, name, tagline = true, overlay }: { branding: VenueBranding; name: string; tagline?: boolean; overlay?: ReactNode }) {
  const cover = safeImageUrl(branding.coverImageUrl);
  const logo = safeImageUrl(branding.logoUrl);
  const title = resolvedTitle(branding, name);
  const line = tagline ? resolvedTagline(branding) : null;
  const showRow = !!(logo || title || line);
  const rowClass = ["header-row", logo ? "" : "no-logo", cover ? "" : "no-cover"].filter(Boolean).join(" ");

  return (
    <header className="venue-header">
      {cover && (
        <div className="cover">
          {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
          <img src={cover} alt="" fetchPriority="high" />
        </div>
      )}
      {overlay}
      {showRow && (
        <div className={rowClass}>
          {logo && (
            <div className={`logo-circle${cover ? "" : " no-cover"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
              <img src={logo} alt="" />
            </div>
          )}
          {(title || line) && (
            <div className="header-text">
              {title && <h1>{title}</h1>}
              {line && <p className="tagline">{line}</p>}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

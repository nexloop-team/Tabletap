import { Heart, RotateCw } from "lucide-react";
import { ThemeStyle } from "@/components/ThemeStyle";
import { createTranslator, type Locale } from "@/lib/i18n";
import { safeImageUrl } from "@/lib/venue/features";
import type { VenueBranding } from "@/lib/venue/types";

/**
 * What guests see when a venue's page is switched off (trial or subscription
 * lapsed, or suspended): a calm "Back soon" in the venue's own colours, never
 * a technical error. Saved stamps are untouched, so the page says so.
 */
export function PausedPage({ locale, name, branding, retryHref }: { locale: Locale; name: string; branding: VenueBranding; retryHref: string }) {
  const { t } = createTranslator(locale);
  const logo = safeImageUrl(branding.logoUrl);
  return (
    <>
      <ThemeStyle branding={branding} />
      <main className="paused-page" role="status">
        <div className="paused-venue">
          {logo && (
            <span className="paused-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
              <img src={logo} alt="" />
            </span>
          )}
          <span>{name}</span>
        </div>
        <h1>{t("paused_title")}</h1>
        <p className="paused-body">{t("paused_body")}</p>
        <p className="paused-chip">
          <Heart aria-hidden />
          {t("paused_stamps_safe")}
        </p>
        <a className="paused-retry" href={retryHref}>
          <RotateCw aria-hidden />
          {t("paused_retry")}
        </a>
        <svg className="paused-art" viewBox="0 0 200 220" aria-hidden>
          <path d="M40 20v40M80 20v40M120 20v40" />
          <rect x="20" y="90" width="160" height="140" rx="26" />
        </svg>
      </main>
    </>
  );
}

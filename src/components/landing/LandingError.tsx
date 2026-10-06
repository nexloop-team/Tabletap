"use client";

import { Frown } from "lucide-react";
import { useEffect, useMemo } from "react";
import { BRAND } from "@/config/brand";
import { createTracker } from "@/lib/analytics";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";

/** The page-level failure: a missing venue code, or a code that resolves to nothing (or a paused venue). */
export function LandingError({ locale, message, source, failedCode }: { locale: Locale; message: MessageKey; source: string; failedCode?: string }) {
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    if (!failedCode) return;
    createTracker({ venueId: null, source, page: "s" })("short_code_resolution_failed", { code: failedCode });
  }, [failedCode, source]);

  return (
    <main className="page-wrapper page-unavailable" role="alert">
      <span className="page-unavailable-icon" aria-hidden>
        <Frown strokeWidth={1.8} />
      </span>
      <h1>{t("page_unavailable")}</h1>
      <p>{t(message)}</p>
      <p className="page-unavailable-foot">{tf("powered_by", { brand: BRAND.name })}</p>
    </main>
  );
}

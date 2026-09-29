"use client";

import { useEffect, useMemo } from "react";
import { createTracker } from "@/lib/analytics";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";

/** The page-level failure: a missing venue code, or a code that resolves to nothing. */
export function LandingError({ locale, message, source, failedCode }: { locale: Locale; message: MessageKey; source: string; failedCode?: string }) {
  const { t } = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    if (!failedCode) return;
    createTracker({ venueId: null, source, page: "s" })("short_code_resolution_failed", { code: failedCode });
  }, [failedCode, source]);

  return (
    <main className="page-wrapper">
      <div className="error-container">
        <div className="error-box" role="alert">
          {t(message)}
        </div>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          {t("try_again")}
        </button>
      </div>
    </main>
  );
}

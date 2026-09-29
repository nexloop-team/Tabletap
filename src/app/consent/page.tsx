import type { Metadata } from "next";
import { CheckCircle } from "@/components/icons";
import { createTranslator } from "@/lib/i18n";
import { firstParam, requestLocale } from "@/server/request";
import "@/styles/landing.css";
import "@/styles/pages.css";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/** Where /api/consent/confirm lands after the double-opt-in link is tapped. */
export default async function ConsentPage({ searchParams }: PageProps<"/consent">) {
  const confirmed = firstParam((await searchParams).status) === "confirmed";
  const { t } = createTranslator(await requestLocale());

  return (
    <main className="page-wrapper simple-page">
      <div className="simple-card">
        {confirmed ? (
          <>
            <div className="simple-icon ok">
              <CheckCircle />
            </div>
            <h1>{t("consent_confirmed_title")}</h1>
            <p>{t("consent_confirmed_body")}</p>
          </>
        ) : (
          <>
            <h1>{t("consent_invalid_title")}</h1>
            <p>{t("consent_invalid_body")}</p>
          </>
        )}
      </div>
    </main>
  );
}

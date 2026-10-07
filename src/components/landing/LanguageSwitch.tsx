"use client";

import { useRouter } from "next/navigation";
import { LANGUAGE_CHOICES, LANGUAGE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * "English · Español" at the foot of the guest page and menu, for visitors
 * whose phone language isn't the one they read best. The choice is kept for
 * a year and applies to every venue.
 */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  return (
    <nav className="language-switch" aria-label="Language">
      {LANGUAGE_CHOICES.map((choice) => (
        <button
          key={choice.locale}
          type="button"
          lang={choice.locale}
          aria-current={choice.locale === locale ? "true" : undefined}
          onClick={() => {
            if (choice.locale === locale) return;
            document.cookie = `${LANGUAGE_COOKIE}=${choice.locale}; path=/; max-age=31536000; SameSite=Lax`;
            router.refresh();
          }}
        >
          {choice.label}
        </button>
      ))}
    </nav>
  );
}

import { en, type MessageKey, type Messages } from "./messages/en";
import { es } from "./messages/es";

export type { MessageKey };

const DICTIONARIES: Record<string, Partial<Messages>> = { en, es };

/** Locales rendered right-to-left. Add "ar", "he" etc. here with their dictionaries. */
const RTL_LOCALES = new Set<string>(["ar", "he", "fa", "ur"]);

export type Locale = keyof typeof DICTIONARIES | string;

/**
 * Best match for an Accept-Language header or navigator.language: exact tag,
 * then the primary subtag, then English.
 */
export function detectLocale(input: string | null | undefined): Locale {
  const tags = String(input || "en")
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    if (DICTIONARIES[tag]) return tag;
    const primary = tag.split("-")[0];
    if (DICTIONARIES[primary]) return primary;
  }
  return "en";
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

export type Translate = (key: MessageKey) => string;
export type TranslateFormat = (key: MessageKey, vars: Record<string, string | number>) => string;

export function createTranslator(locale: Locale): { t: Translate; tf: TranslateFormat } {
  const dict = DICTIONARIES[locale] ?? en;
  const t: Translate = (key) => dict[key] ?? en[key] ?? key;
  const tf: TranslateFormat = (key, vars) =>
    t(key).replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  return { t, tf };
}

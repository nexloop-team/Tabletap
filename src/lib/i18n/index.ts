import { en, type MessageKey } from "./messages/en";

export type { MessageKey };

/**
 * Guest pages are in English only. The locale still travels through the
 * pages so dates and prices are formatted the Indian way ("9 Oct",
 * ₹1,00,000) in one place.
 */
export type Locale = "en-IN";
export const LOCALE: Locale = "en-IN";

export type Translate = (key: MessageKey) => string;
export type TranslateFormat = (key: MessageKey, vars: Record<string, string | number>) => string;

export function createTranslator(locale: Locale = LOCALE): { t: Translate; tf: TranslateFormat } {
  void locale;
  const t: Translate = (key) => en[key] ?? key;
  const tf: TranslateFormat = (key, vars) =>
    t(key).replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  return { t, tf };
}

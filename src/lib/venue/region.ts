/**
 * Indian menus follow Indian conventions: every dish carries the veg / non-veg
 * mark (as FSSAI and the delivery apps expect), popular dishes are
 * "Bestsellers", and the EU's list of 14 allergens isn't used.
 */
export function isIndianMenu(currencyCode: string | null | undefined): boolean {
  return currencyCode === "INR";
}

/** A typical time zone for each currency, for grouping stats into the venue's own days. */
const CURRENCY_ZONES: Record<string, string> = {
  GBP: "Europe/London",
  EUR: "Europe/Berlin",
  USD: "America/New_York",
  INR: "Asia/Kolkata",
  AUD: "Australia/Sydney",
  CAD: "America/Toronto",
  NZD: "Pacific/Auckland",
  AED: "Asia/Dubai",
  SGD: "Asia/Singapore",
  ZAR: "Africa/Johannesburg",
};

/** Where we sell first; venues whose currency has no zone of its own use it too. */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/** The venue's time zone, from its currency: its days, its office hours, its "today". */
export function venueTimeZone(currencyCode: string | null | undefined): string {
  return (currencyCode && CURRENCY_ZONES[currencyCode]) || DEFAULT_TIME_ZONE;
}

/** Minutes the venue's clock is ahead of UTC right now (India: 330), so "today" means the venue's today. */
export function venueUtcOffsetMinutes(currencyCode: string, at = new Date()): number {
  const zone = venueTimeZone(currencyCode);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at).find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Menu prices as diners expect them: whole rupees (₹140), two decimals elsewhere (£9.50). */
export function menuPriceFormat(locale: string | undefined, currencyCode: string): Intl.NumberFormat {
  const whole = isIndianMenu(currencyCode) ? { minimumFractionDigits: 0, maximumFractionDigits: 2 } : {};
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode, ...whole });
}

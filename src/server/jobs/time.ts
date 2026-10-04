/** Calendar maths in the venue owners' time zone (the UK for now). */

export const BUSINESS_TZ = "Europe/London";

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localParts(now: Date, timeZone = BUSINESS_TZ): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), weekday: WEEKDAYS[parts.weekday] };
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** The local calendar date, e.g. "2026-10-05". */
export function localDate(now: Date, timeZone = BUSINESS_TZ): string {
  const p = localParts(now, timeZone);
  return isoDate(p.year, p.month, p.day);
}

/**
 * The Monday (local date) of the digest week `now` falls in, or null before
 * 08:00 on Monday, when the new week's digest isn't due yet.
 */
export function digestWeek(now: Date, timeZone = BUSINESS_TZ): string | null {
  const p = localParts(now, timeZone);
  if (p.weekday === 1 && p.hour < 8) return null;
  return isoDate(p.year, p.month, p.day - (p.weekday - 1));
}

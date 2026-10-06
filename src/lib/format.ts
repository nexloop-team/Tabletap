import { parseDbDate } from "./plans";

const DAY = 86_400_000;

/** "4 Oct 2026" for a DB or ISO timestamp; "–" when missing. */
export function formatDate(value: string | null | undefined): string {
  const time = parseDbDate(value);
  if (time === null) return "–";
  return new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Midnight UTC of the day containing `time`. */
function utcDay(time: number): number {
  return Math.floor(time / DAY) * DAY;
}

/** "Today", "Yesterday", "5 days ago", then the date once it's over a month old. */
export function formatAgo(value: string | null | undefined, now = Date.now()): string {
  const time = parseDbDate(value);
  if (time === null) return "–";
  const days = Math.round((utcDay(now) - utcDay(time)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 31) return `${days} days ago`;
  return formatDate(value);
}

/** Counts per UTC day for the last `days` days (oldest first), from a list of timestamps. */
export function dailyCounts(values: (string | null | undefined)[], days: number, now = Date.now()): { day: string; count: number }[] {
  const today = utcDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({ day: new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10), count: 0 }));
  const first = today - (days - 1) * DAY;
  for (const value of values) {
    const time = parseDbDate(value);
    if (time === null || time < first) continue;
    const index = Math.floor((time - first) / DAY);
    if (index >= 0 && index < days) buckets[index].count++;
  }
  return buckets;
}

/** Up to two initials for an avatar: "Ada Lovelace" → "AL", "ada@x.com" → "A". */
export function initials(name: string | null | undefined, fallback = "?"): string {
  const words = (name ?? "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? fallback);
  return letters.toUpperCase();
}

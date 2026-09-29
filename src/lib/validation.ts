/**
 * Deliberately permissive: one "@", a non-empty local part, and a dotted
 * domain. Real validation is the confirmation email, not a regex.
 */
export function isPlausibleEmail(raw: string): boolean {
  const parts = String(raw).trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain.indexOf(".") > 0 && !domain.startsWith(".") && !domain.endsWith(".");
}

export function normaliseEmail(raw: string): string {
  return String(raw).trim().toLowerCase();
}

/** a•••e@gmail.com — enough to recognise, not enough to disclose over a shoulder. */
export function maskEmail(raw: string): string {
  const value = String(raw || "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return value;
  const name = value.slice(0, at);
  const domain = value.slice(at);
  if (name.length <= 2) return `${name.charAt(0)}•••${domain}`;
  return `${name.charAt(0)}•••${name.charAt(name.length - 1)}${domain}`;
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(month: number): number {
  return month >= 1 && month <= 12 ? DAYS_IN_MONTH[month - 1] : 31;
}

/** Month and day only; there is deliberately no year. */
export function isValidBirthday(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month);
}

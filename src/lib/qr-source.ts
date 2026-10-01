/** A QR code's `s` param: URL-safe and readable in the scan stats ("Table 4" → "table-4"). */
export function sourceSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

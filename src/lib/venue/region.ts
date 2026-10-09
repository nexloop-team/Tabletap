/**
 * Indian menus follow Indian conventions: every dish carries the veg / non-veg
 * mark (as FSSAI and the delivery apps expect), popular dishes are
 * "Bestsellers", and the EU's list of 14 allergens isn't used.
 */
export function isIndianMenu(currencyCode: string | null | undefined): boolean {
  return currencyCode === "INR";
}

/** Menu prices as diners expect them: whole rupees (₹140), two decimals elsewhere (£9.50). */
export function menuPriceFormat(locale: string | undefined, currencyCode: string): Intl.NumberFormat {
  const whole = isIndianMenu(currencyCode) ? { minimumFractionDigits: 0, maximumFractionDigits: 2 } : {};
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode, ...whole });
}

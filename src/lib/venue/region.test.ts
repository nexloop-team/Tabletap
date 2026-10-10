import { describe, expect, it } from "vitest";
import { isIndianMenu, menuPriceFormat, venueUtcOffsetMinutes } from "./region";

describe("venue region", () => {
  it("counts days in the venue's own time zone", () => {
    expect(venueUtcOffsetMinutes("INR")).toBe(330);
    expect(venueUtcOffsetMinutes("AED")).toBe(240);
    expect(venueUtcOffsetMinutes("GBP", new Date("2026-01-15T12:00:00Z"))).toBe(0);
    expect(venueUtcOffsetMinutes("GBP", new Date("2026-07-15T12:00:00Z"))).toBe(60);
    // A currency without a zone of its own counts days in India, where we sell first.
    expect(venueUtcOffsetMinutes("XXX")).toBe(330);
  });

  it("prices Indian menus in whole rupees", () => {
    expect(isIndianMenu("INR")).toBe(true);
    expect(menuPriceFormat("en-IN", "INR").format(140)).toBe("₹140");
    expect(menuPriceFormat("en-GB", "GBP").format(9.5)).toBe("£9.50");
  });
});

import { describe, expect, it } from "vitest";
import { DEMO_VENUES } from "@/server/seed";
import { accessBadge, accessState, formatInr, parseDbDate, PRICE_WITH_GST_INR, trialDaysLeft, type SubscriptionState } from "./plans";
import { sourceSlug } from "./qr-source";
import { safeNext } from "./safe-next";
import { createVenueRequest, initialVenueConfig, slugify, venueConfigPatch, venueConfigSchema } from "./venue/schema";

const DAY = 86_400_000;
const sub = (patch: Partial<SubscriptionState>): SubscriptionState => ({ paid: false, status: "active", trialEndsAt: null, currentPeriodEnd: null, ...patch });

describe("plans", () => {
  it("is paid while live, through a failed renewal, and on trial until it ends", () => {
    expect(accessState(null)).toBe("unpaid");
    expect(accessState(sub({ paid: true }))).toBe("paid");
    expect(accessState(sub({ paid: true, status: "past_due" }))).toBe("paid");
    expect(accessState(sub({ paid: true, status: "canceled" }))).toBe("unpaid");
    expect(accessState(sub({ trialEndsAt: new Date(Date.now() + DAY).toISOString() }))).toBe("trial");
    expect(accessState(sub({ trialEndsAt: new Date(Date.now() - DAY).toISOString() }))).toBe("unpaid");
  });

  it("lapses a few days after the paid period ends without a renewal", () => {
    expect(accessState(sub({ paid: true, currentPeriodEnd: new Date(Date.now() - DAY).toISOString() }))).toBe("paid");
    expect(accessState(sub({ paid: true, currentPeriodEnd: new Date(Date.now() - 5 * DAY).toISOString() }))).toBe("unpaid");
  });

  it("counts trial days only while on the trial", () => {
    const trialEndsAt = new Date(Date.now() + 3.5 * DAY).toISOString();
    expect(trialDaysLeft(sub({ trialEndsAt }))).toBe(4);
    expect(trialDaysLeft(sub({ paid: true, trialEndsAt }))).toBeNull();
    expect(trialDaysLeft(sub({ trialEndsAt: new Date(Date.now() - DAY).toISOString() }))).toBeNull();
    expect(accessBadge(sub({ trialEndsAt })).label).toBe("Trial · 4 days left");
    expect(accessBadge(sub({})).label).toBe("Unpaid");
  });

  it("prices in rupees with GST on top", () => {
    expect(PRICE_WITH_GST_INR).toBe(1178.82);
    expect(formatInr(999)).toBe("₹999");
    expect(formatInr(1178.82)).toBe("₹1,178.82");
  });

  it("reads SQLite timestamps as UTC", () => {
    expect(parseDbDate("2026-01-02 03:04:05")).toBe(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(parseDbDate("2026-01-02T03:04:05.000Z")).toBe(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(parseDbDate(null)).toBeNull();
  });
});

describe("venue config schema", () => {
  it("accepts every demo venue", () => {
    for (const venue of DEMO_VENUES) {
      // id and short code live in their own columns, not in the config.
      const result = venueConfigSchema.safeParse({ ...venue, id: undefined, shortCode: undefined });
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it("refuses script URLs and odd image sources", () => {
    const patch = (value: unknown) => venueConfigPatch.safeParse(value).success;
    expect(patch({ socialLinks: { google: "javascript:alert(1)" } })).toBe(false);
    expect(patch({ externalLinks: [{ id: "a", url: "data:text/html,hi" }] })).toBe(false);
    expect(patch({ branding: { logoUrl: "//evil.example/x.png" } })).toBe(false);
    expect(patch({ branding: { logoUrl: "/media/ven_abc/img_1.png" } })).toBe(true);
    expect(patch({ branding: { backgroundColorHex: "red;}body{display:none" } })).toBe(false);
  });

  it("insists a stamp card names its reward", () => {
    const base = { ...DEMO_VENUES[0] };
    expect(venueConfigSchema.safeParse({ ...base, loyaltyProgram: { rewardName: "", stampsRequired: 8 } }).success).toBe(false);
    expect(venueConfigSchema.safeParse({ ...base, loyaltyProgram: { rewardName: "", stampsRequired: 0, stampsEnabled: false } }).success).toBe(true);
  });

  it("builds a valid starting config from onboarding answers", () => {
    let n = 0;
    const input = createVenueRequest.parse({
      name: "Café Olé",
      venueType: "cafe",
      currencyCode: "EUR",
      wifi: { ssid: "Ole-Guest", password: "beans" },
      googleReviewUrl: "https://g.page/r/abc/review",
      loyalty: { rewardName: "Free coffee", stampsRequired: 9 },
    });
    const config = initialVenueConfig(input, (prefix) => `${prefix}_${++n}`);
    expect(venueConfigSchema.safeParse(config).success).toBe(true);
    expect(config.branding.showGoogleReviewButton).toBe(true);
    expect(config.loyaltyProgram?.stampsRequired).toBe(9);
  });

  it("slugs names into QR-friendly codes", () => {
    expect(slugify("Café Olé & Co.")).toBe("cafe-ole-and-co");
    expect(slugify("  ---  ")).toBe("");
    expect(slugify("x".repeat(80)).length).toBeLessThanOrEqual(32);
  });
});

describe("small helpers", () => {
  it("only follows same-site next= paths", () => {
    expect(safeNext("/dashboard/ven_1")).toBe("/dashboard/ven_1");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });

  it("turns QR labels into scan sources", () => {
    expect(sourceSlug("Table 4")).toBe("table-4");
    expect(sourceSlug("  Patio / Garden! ")).toBe("patio-garden");
  });
});

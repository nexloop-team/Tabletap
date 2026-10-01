import { describe, expect, it } from "vitest";
import { DEMO_VENUES } from "@/server/seed";
import { ENTITLEMENTS, effectivePlan, parseDbDate, trialDaysLeft, type SubscriptionState } from "./plans";
import { sourceSlug } from "./qr-source";
import { safeNext } from "./safe-next";
import { applyEntitlements } from "./venue/entitlements";
import { createVenueRequest, initialVenueConfig, slugify, venueConfigPatch, venueConfigSchema } from "./venue/schema";

const DAY = 86_400_000;
const sub = (patch: Partial<SubscriptionState>): SubscriptionState => ({ plan: "free", status: "active", trialEndsAt: null, currentPeriodEnd: null, ...patch });

describe("plans", () => {
  it("is Pro while paid, through a failed renewal, and during the trial", () => {
    expect(effectivePlan(null)).toBe("free");
    expect(effectivePlan(sub({ plan: "pro" }))).toBe("pro");
    expect(effectivePlan(sub({ plan: "pro", status: "past_due" }))).toBe("pro");
    expect(effectivePlan(sub({ plan: "pro", status: "canceled" }))).toBe("free");
    expect(effectivePlan(sub({ trialEndsAt: new Date(Date.now() + DAY).toISOString() }))).toBe("pro");
    expect(effectivePlan(sub({ trialEndsAt: new Date(Date.now() - DAY).toISOString() }))).toBe("free");
  });

  it("counts trial days only for unpaid venues", () => {
    const trialEndsAt = new Date(Date.now() + 3.5 * DAY).toISOString();
    expect(trialDaysLeft(sub({ trialEndsAt }))).toBe(4);
    expect(trialDaysLeft(sub({ plan: "pro", trialEndsAt }))).toBeNull();
    expect(trialDaysLeft(sub({ trialEndsAt: new Date(Date.now() - DAY).toISOString() }))).toBeNull();
  });

  it("reads SQLite timestamps as UTC", () => {
    expect(parseDbDate("2026-01-02 03:04:05")).toBe(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(parseDbDate("2026-01-02T03:04:05.000Z")).toBe(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(parseDbDate(null)).toBeNull();
  });
});

describe("entitlements", () => {
  const venue = { ...DEMO_VENUES[1] };

  it("switches paid features off on Free without losing the rest", () => {
    const free = applyEntitlements(venue, ENTITLEMENTS.free);
    expect(free.loyaltyProgram).toBeNull();
    expect(free.crm.enabled).toBe(false);
    expect(free.crm.wifiCapture).toBe(false);
    expect(free.branding.style).toBeNull();
    expect(free.showPoweredBy).toBe(true);
    expect(free.wifi).toEqual(venue.wifi);
    expect(free.menus).toBe(venue.menus);
  });

  it("leaves everything on for Pro", () => {
    const pro = applyEntitlements(venue, ENTITLEMENTS.pro);
    expect(pro.loyaltyProgram).toEqual(venue.loyaltyProgram);
    expect(pro.crm).toEqual(venue.crm);
    expect(pro.showPoweredBy).toBe(false);
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

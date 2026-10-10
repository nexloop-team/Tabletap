import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stampRequest } from "@/lib/api/contracts";

// db.ts reads DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-audit-"));
process.env.DATA_DIR = dataDir;

type M = {
  db: typeof import("./db");
  users: typeof import("./repositories/users");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  venues: typeof import("./repositories/venues");
  loyalty: typeof import("./services/loyalty");
  feedback: typeof import("./services/feedback");
  guests: typeof import("./services/guests");
  customers: typeof import("./repositories/customers");
  staff: typeof import("./services/staff");
  cards: typeof import("./repositories/loyalty-cards");
  housekeeping: typeof import("./jobs/housekeeping");
  mailer: typeof import("./services/mailer");
  http: typeof import("./http");
  features: typeof import("@/lib/venue/features");
  settings: typeof import("@/lib/venue/settings");
};
let m: M;

beforeAll(async () => {
  m = {
    db: await import("./db"),
    users: await import("./repositories/users"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    venues: await import("./repositories/venues"),
    loyalty: await import("./services/loyalty"),
    feedback: await import("./services/feedback"),
    guests: await import("./services/guests"),
    customers: await import("./repositories/customers"),
    staff: await import("./services/staff"),
    cards: await import("./repositories/loyalty-cards"),
    housekeeping: await import("./jobs/housekeeping"),
    mailer: await import("./services/mailer"),
    http: await import("./http"),
    features: await import("@/lib/venue/features"),
    settings: await import("@/lib/venue/settings"),
  };
});

afterAll(async () => {
  await m.db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
async function stampVenue(extra: NonNullable<Parameters<typeof import("./services/venue-admin").updateVenue>[1]["config"]> = {}) {
  seq += 1;
  const owner = await m.users.insertUser({ email: `audit-owner${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Audit Cafe ${seq}`, venueType: "cafe", currencyCode: "INR", loyalty: { rewardName: "Free chai", stampsRequired: 5 } }));
  return extra && Object.keys(extra).length ? await m.admin.updateVenue(venue, { config: extra }) : venue;
}

const ORIGIN = "https://tapmore.test";

describe("feedback stamps", () => {
  it("need a receipt from real feedback, once, and never by email alone", async () => {
    const venue = await stampVenue();
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "fb@example.com", firstName: "Fe" }, ORIGIN);
    // No receipt: the old "email only" request is refused by the contract itself.
    expect(stampRequest.safeParse({ venueId: venue.id, email: "fb@example.com" }).success).toBe(false);

    const posted = await m.feedback.submitFeedback({ venueId: venue.id, text: "Lovely chai" });
    expect(posted.stampReceipt).not.toBeNull();
    const receipt = posted.stampReceipt!;
    const wrong = await m.loyalty.stampForFeedback({ venueId: venue.id, email: "fb@example.com", feedbackReceipt: { ...receipt, token: "x".repeat(32) } });
    expect(wrong.stamped).toBe(false);
    const first = await m.loyalty.stampForFeedback({ venueId: venue.id, email: "fb@example.com", feedbackReceipt: receipt });
    expect(first).toEqual({ stamped: true, currentStamps: 1 });
    // The same receipt can't be used again, even for another member.
    await m.loyalty.enroll({ venueId: venue.id, email: "other@example.com" }, ORIGIN);
    expect((await m.loyalty.stampForFeedback({ venueId: venue.id, email: "other@example.com", feedbackReceipt: receipt })).stamped).toBe(false);
    expect(joined.cardId).toBeTruthy();
  });

  it("are off when the owner switches them off", async () => {
    const venue = await stampVenue();
    await m.venues.saveVenueSettings(venue.id, { ...(await m.venues.getVenueSettings(venue.id)), stampPolicy: { cooldownMinutes: 30, feedbackStamp: false } });
    expect((await m.feedback.submitFeedback({ venueId: venue.id, text: "Fine" })).stampReceipt).toBeNull();
  });

  it("a join only gets its stamp from a feedback receipt", async () => {
    const venue = await stampVenue();
    const plain = await m.loyalty.enroll({ venueId: venue.id, email: "free@example.com", initialStamps: 1, captureSource: "landing" }, ORIGIN);
    const noReceipt = await m.loyalty.enroll({ venueId: venue.id, email: "fb2@example.com", initialStamps: 1, captureSource: "feedback" }, ORIGIN);
    const { stampReceipt } = await m.feedback.submitFeedback({ venueId: venue.id, text: "Good" });
    const withReceipt = await m.loyalty.enroll({ venueId: venue.id, email: "fb3@example.com", initialStamps: 1, captureSource: "feedback", feedbackReceipt: stampReceipt! }, ORIGIN);
    const db = await m.db.getDb();
    const stamps = async (cardId: string) => (await m.cards.findCardById(db, cardId))!.stamps;
    expect(await stamps(plain.cardId)).toBe(0);
    expect(await stamps(noReceipt.cardId)).toBe(0);
    expect(await stamps(withReceipt.cardId)).toBe(1);
  });
});

describe("returning members", () => {
  it("are emailed their card instead of being shown it", async () => {
    const venue = await stampVenue();
    const first = await m.loyalty.enroll({ venueId: venue.id, email: "back@example.com" }, ORIGIN);
    expect(first.cardUrl).toContain("/card/");
    const again = await m.loyalty.enroll({ venueId: venue.id, email: "back@example.com" }, ORIGIN);
    expect(again.wasExisting).toBe(true);
    expect(again.cardUrl).toBeNull();
  });

  it("keep the birthday they gave first", async () => {
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const { customer } = await m.customers.upsertCustomer(db, { venueId: venue.id, email: "bday@example.com", captureSource: "landing" });
    await m.customers.setBirthday(db, customer.id, 3, 14);
    await m.customers.setBirthday(db, customer.id, 12, 1);
    const row = (await m.customers.findCustomerById(db, venue.id, customer.id))!;
    expect([row.birthday_month, row.birthday_day]).toEqual([3, 14]);
  });
});

describe("guest erasure", () => {
  it("removes the guest, card, stamps and visits", async () => {
    const venue = await stampVenue();
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "gone@example.com" }, ORIGIN);
    const ok = await m.db.transaction((db) => m.customers.deleteGuest(db, venue.id, joined.customerId));
    expect(ok).toBe(true);
    const db = await m.db.getDb();
    expect(await m.customers.findCustomerById(db, venue.id, joined.customerId)).toBeNull();
    expect(await m.cards.findCardById(db, joined.cardId)).toBeNull();
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ?", joined.cardId))!.n).toBe(0);
  });
});

describe("Wi-Fi gate", () => {
  it("is off unless the owner switches it on: everyone sees the password", async () => {
    const venue = await stampVenue({ wifi: { ssid: "Cafe", password: "open-sesame", security: "WPA2" } });
    const live = (await m.venues.findVenue(venue.id))!;
    expect(m.features.wifiGateActive(live)).toBe(false);
    expect(m.features.guestSafeVenue(live).wifi?.password).toBe("open-sesame");
    await expect(m.guests.captureGuest({ venueId: venue.id, email: "no-gate@example.com", marketingConsent: false, ageAttested: false }, ORIGIN)).rejects.toThrow(/doesn't ask/);
  });

  it("keeps the password out of the page until the guest has given an email", async () => {
    const venue = await stampVenue({
      wifi: { ssid: "Cafe", password: "s3cret-pass", security: "WPA2" },
      crm: { enabled: true, consentAsk: false, wifiCapture: true, feedbackCapture: false, birthdayAsk: false },
    });
    const live = (await m.venues.findVenue(venue.id))!;
    expect(m.features.guestSafeVenue(live).wifi?.password).toBeNull();
    const captured = await m.guests.captureGuest({ venueId: venue.id, email: "wifi-guest@example.com", marketingConsent: false, ageAttested: false }, ORIGIN);
    expect((await m.guests.wifiPassword({ venueId: venue.id, customerId: captured.customerId })).password).toBe("s3cret-pass");
    await expect(m.guests.wifiPassword({ venueId: venue.id, customerId: "cus_unknown" })).rejects.toThrow(/unknown guest/i);
  });
});

describe("page addresses", () => {
  it("keep old codes pointing at their venue, and never let anyone else take them", async () => {
    const venue = await stampVenue();
    const oldCode = venue.shortCode;
    await m.admin.updateVenue(venue, { shortCode: `${oldCode}-new` });
    expect((await m.venues.findVenue(oldCode))?.id).toBe(venue.id);
    expect(await m.venues.shortCodeTaken(oldCode)).toBe(true);
    // The venue itself may go back to it.
    expect(await m.venues.shortCodeTaken(oldCode, venue.id)).toBe(false);
    await m.venues.deleteVenue(venue.id);
    expect(await m.venues.shortCodeTaken(oldCode)).toBe(true);
    expect(await m.venues.shortCodeTaken(`${oldCode}-new`)).toBe(true);
    expect(await m.venues.findVenue(oldCode)).toBeNull();
  });
});

describe("till races", () => {
  it("two tills redeeming at once only spend the stamps once", async () => {
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const { customer } = await m.customers.upsertCustomer(db, { venueId: venue.id, email: "race@example.com", captureSource: "landing" });
    const card = await m.cards.createCard(db, venue.id, customer.id, 5);
    (await db.run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", `race_${seq}`, venue.id));
    const device = { id: `race_${seq}`, venueId: venue.id, label: "Till" };
    const results = await Promise.allSettled([m.staff.redeemReward(device, card.id, 0), m.staff.redeemReward(device, card.id, 0)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await m.cards.findCardById(db, card.id))!.stamps).toBe(0);
  });
});

describe("housekeeping", () => {
  it("deletes expired sessions and old email copies once a day", async () => {
    const db = await m.db.getDb();
    const user = await m.users.insertUser({ email: "hk@example.com", name: "HK", passwordHash: "x" });
    (await db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES ('old', ?, now() - INTERVAL '1 day'), ('live', ?, now() + INTERVAL '1 day')", user.id, user.id));
    (await db.run("INSERT INTO outbox (recipient, subject, body, created_at) VALUES ('a@b.c', 's', 'b', now() - INTERVAL '100 days')"));
    const day = new Date("2031-01-01T00:00:00Z");
    expect(await m.housekeeping.runHousekeeping(day)).toBeGreaterThanOrEqual(2);
    expect(await m.housekeeping.runHousekeeping(day)).toBe(0);
    const left = await db.all<{ id: string }>("SELECT id FROM sessions WHERE user_id = ?", user.id);
    expect(left.map((row) => row.id)).toEqual(["live"]);
  });
});

describe("demo venues", () => {
  it("stay live for anyone to try, but never count as real venues in the admin console", async () => {
    const { DEMO_VENUE_IDS } = await import("./seed");
    const admin = await import("./admin");
    expect((await m.venues.findVenue("demo"))?.id).toBe("ven_juniper");
    const listed = (await m.venues.listVenuesForAdmin()).map((venue) => venue.id);
    expect(listed.some((id) => DEMO_VENUE_IDS.includes(id))).toBe(false);
    const db = await m.db.getDb();
    const all = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM venues"))!.n;
    expect((await admin.platformCounts()).venues).toBe(all - DEMO_VENUE_IDS.length);
  });
});

describe("admin venue powers", () => {
  it("cancels a venue's renewal and deletes a venue for its owner, logging both", async () => {
    const operator = await import("./services/operator");
    const subs = await import("./repositories/subscriptions");
    const admin = await m.users.insertUser({ email: "ops@example.com", name: "Ops", passwordHash: "x" });
    const venue = await stampVenue();
    await subs.updateSubscription(venue.id, { paid: true, status: "active", provider: "dev", currentPeriodEnd: new Date(Date.now() + 86_400_000 * 300).toISOString() });

    await operator.updateVenueAsAdmin(admin, venue.id, { cancelRenewal: true });
    // Dev billing ends straight away, like the owner's own Cancel does locally.
    expect((await subs.getSubscription(venue.id))?.paid).toBe(false);

    await expect(operator.deleteVenueAsAdmin(admin, venue.id, "Wrong name")).rejects.toThrow(/exactly/);
    await expect(operator.deleteVenueAsAdmin(admin, "ven_juniper", "Juniper Coffee House")).rejects.toThrow(/Demo venues/);
    await operator.deleteVenueAsAdmin(admin, venue.id, venue.config.name);
    expect(await m.venues.getVenueRecord(venue.id)).toBeNull();

    const db = await m.db.getDb();
    const logged = await db.all<{ action: string }>("SELECT action FROM admin_actions WHERE target_id = ? ORDER BY created_at", venue.id);
    expect(logged.map((row) => row.action)).toEqual(["Cancelled subscription renewal", "Deleted venue"]);
  });
});

describe("feedback summary", () => {
  it("waits for 3 notes, and reuses a saved summary until new feedback arrives", async () => {
    const { feedbackSummary } = await import("./services/feedback-summary");
    const venue = await stampVenue();
    const named = { id: venue.id, name: venue.config.name };
    await m.feedback.submitFeedback({ venueId: venue.id, text: "Lovely chai" });
    expect(await feedbackSummary(named)).toEqual({ state: "too_few", notes: 1 });
    await m.feedback.submitFeedback({ venueId: venue.id, text: "Service was slow" });
    await m.feedback.submitFeedback({ venueId: venue.id, text: "Great samosas" });

    // A summary saved for exactly these notes is shown without calling the AI.
    const db = await m.db.getDb();
    const rows = await db.all<{ id: string }>("SELECT id FROM feedback WHERE venue_id = ? ORDER BY created_at DESC", venue.id);
    const summary = { headline: "Mostly happy guests", praise: ["Chai"], problems: ["Slow service"], suggestion: "" };
    await db.run("INSERT INTO feedback_summaries (venue_id, fingerprint, summary) VALUES (?, ?, ?)", venue.id, `3:${rows[0].id}:${rows[2].id}`, JSON.stringify(summary));
    const ready = await feedbackSummary(named);
    expect(ready.state).toBe("ready");
    expect(ready.state === "ready" && ready.summary).toEqual(summary);
  });
});

describe("scan sources", () => {
  it("count a table's QR scans and NFC taps as one spot", async () => {
    const { venueStats } = await import("./repositories/insights");
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const open = (source: string | null, session: string) =>
      db.run("INSERT INTO events (name, params, venue_id) VALUES ('landing_opened', ?, ?)", JSON.stringify({ ...(source ? { source } : {}), session_id: session }), venue.id);
    await open("table-4", "a");
    await open("table-4", "b");
    await open("table-4-nfc", "c");
    await open(null, "d");
    await open("nfc", "e");
    const { sources } = await venueStats(venue.id, 7);
    expect(sources).toContainEqual({ source: "table-4", scans: 3 });
    expect(sources).toContainEqual({ source: "unknown", scans: 2 });
    expect(sources.some((row) => row.source.endsWith("nfc"))).toBe(false);
  });
});

describe("scan counting", () => {
  it("counts guests only, once per visit, in the venue's own days, the same in the admin console", async () => {
    const { venueStats, windowStart } = await import("./repositories/insights");
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const open = (params: Record<string, unknown>) =>
      db.run("INSERT INTO events (name, params, venue_id) VALUES ('landing_opened', ?, ?)", JSON.stringify(params), venue.id);
    await open({ session_id: "guest-1", source: "table-1" });
    await open({ session_id: "guest-1", source: "table-1" }); // a refresh: same visit
    await open({ session_id: "guest-2", source: "table-2" });
    await open({ session_id: "owner", source: "table-1", team: 1 }); // the owner testing their own code
    await open({ session_id: "editor", source: "preview" });
    const stats = await venueStats(venue.id, 7, 330);
    expect(stats.scans).toBe(2);
    expect(stats.daily.reduce((sum, day) => sum + day.scans, 0)).toBe(2);
    const listed = (await m.venues.listVenuesForAdmin()).find((row) => row.id === venue.id)!;
    expect(listed.scans7d).toBe(2);

    // "Last 7 days" in India starts at local midnight six days ago: 11 Oct 01:30 IST → 5 Oct 00:00 IST (4 Oct 18:30 UTC).
    expect(windowStart(7, 330, Date.parse("2026-10-10T20:00:00Z"))).toBe("2026-10-04T18:30:00.000Z");
  });
});

describe("small pieces", () => {
  it("blanks private links in stored email copies", () => {
    expect(m.mailer.redactLinks("Reset: https://x.app/reset-password?token=abc123\nCard: https://x.app/card/crd_1?t=zzz&s=1")).toBe(
      "Reset: https://x.app/reset-password?token=[redacted]\nCard: https://x.app/card/crd_1?t=[redacted]&s=1",
    );
  });

  it("reads the client address from the proxy's end of X-Forwarded-For", () => {
    const request = (xff: string) => new Request("https://x.app/", { headers: { "x-forwarded-for": xff } });
    expect(m.http.clientIp(request("1.1.1.1"))).toBe("1.1.1.1");
    // A client can't pick its own address by sending the header: the proxy's entry wins.
    expect(m.http.clientIp(request("6.6.6.6, 2.2.2.2"))).toBe("2.2.2.2");
    process.env.TRUSTED_PROXY_COUNT = "2";
    expect(m.http.clientIp(request("6.6.6.6, 3.3.3.3, 4.4.4.4"))).toBe("3.3.3.3");
    delete process.env.TRUSTED_PROXY_COUNT;
  });

  it("asks Indian guests to confirm they're 18 before agreeing to offers", async () => {
    const venue = (await m.venues.findVenue((await stampVenue()).id))!;
    expect(m.features.consentAgeThreshold(venue)).toBe(18);
    expect(m.features.consentAgeThreshold({ ...venue, currencyCode: "GBP" })).toBe(13);
  });

  it("changes one setting without resetting the others in its section", () => {
    const current = m.settings.DEFAULT_SETTINGS;
    const patched = m.settings.venueSettingsSchema.parse(m.settings.applySettingsPatch({ ...current, stampPolicy: { cooldownMinutes: 60, feedbackStamp: false } }, { stampPolicy: { cooldownMinutes: 15 } }));
    expect(patched.stampPolicy).toEqual({ cooldownMinutes: 15, feedbackStamp: false });
  });
});

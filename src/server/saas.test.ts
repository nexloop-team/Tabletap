import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The database path is read when db.ts loads, so point it at a scratch
// directory before any server module is imported.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletap-test-"));
process.env.DATA_DIR = dataDir;

type Modules = {
  password: typeof import("./auth/password");
  billing: typeof import("./services/billing");
  venues: typeof import("./repositories/venues");
  users: typeof import("./repositories/users");
  subscriptions: typeof import("./repositories/subscriptions");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  db: typeof import("./db");
};
let m: Modules;

beforeAll(async () => {
  m = {
    password: await import("./auth/password"),
    billing: await import("./services/billing"),
    venues: await import("./repositories/venues"),
    users: await import("./repositories/users"),
    subscriptions: await import("./repositories/subscriptions"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    db: await import("./db"),
  };
});

afterAll(() => {
  globalThis.__appDb?.close();
  globalThis.__appDb = undefined;
  globalThis.__appDbMigrations = undefined;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("passwords", () => {
  it("verifies the right password and nothing else", async () => {
    const hash = await m.password.hashPassword("correct horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await m.password.verifyPassword("correct horse", hash)).toBe(true);
    expect(await m.password.verifyPassword("correct horse ", hash)).toBe(false);
    expect(await m.password.verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await m.password.hashPassword("same")).not.toBe(await m.password.hashPassword("same"));
  });
});

describe("Stripe webhook signatures", () => {
  const secret = "whsec_test";
  const body = '{"type":"ping"}';
  const sign = (t: number, payload = body, key = secret) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")}`;
  const now = Date.now();
  const t = Math.floor(now / 1000);

  it("accepts a fresh, correctly signed payload", () => {
    expect(m.billing.verifyStripeSignature(body, sign(t), secret, now)).toBe(true);
  });

  it("rejects tampering, the wrong secret, replays and junk", () => {
    expect(m.billing.verifyStripeSignature('{"type":"evil"}', sign(t), secret, now)).toBe(false);
    expect(m.billing.verifyStripeSignature(body, sign(t, body, "whsec_other"), secret, now)).toBe(false);
    expect(m.billing.verifyStripeSignature(body, sign(t - 3600), secret, now)).toBe(false);
    expect(m.billing.verifyStripeSignature(body, "t=1,v1=zz", secret, now)).toBe(false);
    expect(m.billing.verifyStripeSignature(body, null, secret, now)).toBe(false);
  });
});

describe("venues on the SaaS side", () => {
  async function owner(email: string) {
    return m.users.insertUser({ email, name: "Owner", passwordHash: await m.password.hashPassword("pw-12345678") });
  }

  function onboard(user: import("./repositories/users").User, name: string) {
    return m.admin.createVenueForUser(
      user,
      m.schema.createVenueRequest.parse({ name, venueType: "cafe", currencyCode: "GBP", loyalty: { rewardName: "Free coffee", stampsRequired: 9 } }),
    );
  }

  it("creates a venue on a Pro trial that the guest page can load by short code", async () => {
    const user = await owner("a@example.com");
    const venue = onboard(user, "Juniper Coffee House");
    expect(venue.shortCode).toBe("juniper-coffee-house");
    const page = m.venues.findVenue("juniper-coffee-house");
    expect(page?.loyaltyProgram?.rewardName).toBe("Free coffee");
    expect(m.subscriptions.entitlementsFor(venue.id).plan).toBe("pro");
  });

  it("gives clashing names a unique code and refuses reserved ones", async () => {
    const user = await owner("b@example.com");
    const first = onboard(user, "Juniper Coffee House");
    expect(first.shortCode).toMatch(/^juniper-coffee-house-[0-9a-f]{6}$/);
    expect(onboard(user, "Admin").shortCode).not.toBe("admin");
    expect(() => m.admin.updateVenue(first, { shortCode: "dashboard" })).toThrow(/reserved/);
    expect(() => m.admin.updateVenue(first, { shortCode: "juniper-coffee-house" })).toThrow(/already uses/);
  });

  it("hides paid features from guests once the trial is over", async () => {
    const user = await owner("c@example.com");
    const venue = onboard(user, "Kettle");
    m.db.getDb().prepare("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?").run(new Date(Date.now() - 1000).toISOString(), venue.id);
    expect(m.venues.findVenue(venue.id)?.loyaltyProgram).toBeNull();
    // The merchant's saved setup is untouched, ready for an upgrade.
    expect(m.venues.getVenueRecord(venue.id)?.config.loyaltyProgram?.rewardName).toBe("Free coffee");
    m.subscriptions.updateSubscription(venue.id, { plan: "pro", status: "active" });
    expect(m.venues.findVenue(venue.id)?.loyaltyProgram?.rewardName).toBe("Free coffee");
  });

  it("only lets owners at a venue", async () => {
    const alice = await owner("d@example.com");
    const mallory = await owner("e@example.com");
    const venue = onboard(alice, "Bloom");
    expect(m.admin.requireVenueAccess(alice, venue.id).id).toBe(venue.id);
    expect(() => m.admin.requireVenueAccess(mallory, venue.id)).toThrow(/not found/i);
  });

  it("merges a section save and validates the result as a whole", async () => {
    const user = await owner("f@example.com");
    const venue = onboard(user, "Merge Test");
    const saved = m.admin.updateVenue(venue, { config: { wifi: { ssid: "Guest", password: "pw", security: "WPA2" } } });
    expect(saved.config.wifi?.ssid).toBe("Guest");
    expect(saved.config.loyaltyProgram?.rewardName).toBe("Free coffee");
    expect(() => m.admin.updateVenue(saved, { config: { name: "" } })).toThrow();
  });

  it("suspended venues vanish from the guest side", async () => {
    const user = await owner("g@example.com");
    const venue = onboard(user, "Suspend Me");
    m.venues.setVenueStatus(venue.id, "suspended");
    expect(m.venues.findVenue(venue.id)).toBeNull();
    expect(m.venues.getVenueRecord(venue.id)?.status).toBe("suspended");
  });

  it("deletes a venue with its guests and subscription", async () => {
    const user = await owner("h@example.com");
    const venue = onboard(user, "Delete Me");
    const db = m.db.getDb();
    db.prepare("INSERT INTO customers (id, venue_id, email, capture_source) VALUES ('cus_x', ?, 'g@example.com', 'landing')").run(venue.id);
    expect(() => m.admin.removeVenue(venue, "Wrong name")).toThrow(/exactly/);
    m.admin.removeVenue(venue, "Delete Me");
    expect(m.venues.getVenueRecord(venue.id)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM customers WHERE venue_id = ?").get(venue.id)).toEqual({ n: 0 });
    expect(m.subscriptions.getSubscription(venue.id)).toBeNull();
  });

  it("applies Stripe subscription events to the right venue", async () => {
    const user = await owner("i@example.com");
    const venue = onboard(user, "Stripe Cafe");
    m.billing.handleStripeEvent({
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", client_reference_id: venue.id, customer: "cus_1", subscription: "sub_1" } },
    });
    expect(m.subscriptions.getSubscription(venue.id)).toMatchObject({ plan: "pro", status: "active", providerSubscriptionId: "sub_1" });
    // A late "incomplete" event must not undo the upgrade.
    m.billing.handleStripeEvent({ type: "customer.subscription.created", data: { object: { id: "sub_1", customer: "cus_1", status: "incomplete" } } });
    expect(m.subscriptions.getSubscription(venue.id)?.plan).toBe("pro");
    m.billing.handleStripeEvent({ type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1", status: "canceled" } } });
    expect(m.subscriptions.getSubscription(venue.id)).toMatchObject({ plan: "free", status: "canceled" });
  });
});

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
  invites: typeof import("./services/staff-invites");
  operator: typeof import("./services/operator");
  log: typeof import("./repositories/admin-actions");
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
    invites: await import("./services/staff-invites"),
    operator: await import("./services/operator"),
    log: await import("./repositories/admin-actions"),
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

describe("request origin", () => {
  const forged = new Request("http://localhost:3000/api/auth/forgot", { headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" } });

  it("ignores forged forwarding headers once APP_URL is set", async () => {
    const { requestOrigin } = await import("./http");
    process.env.APP_URL = "https://tabletap.example/";
    try {
      expect(requestOrigin(forged)).toBe("https://tabletap.example");
    } finally {
      delete process.env.APP_URL;
    }
    // Local development without APP_URL still follows the proxy.
    expect(requestOrigin(forged)).toBe("https://evil.example");
  });
});

describe("Razorpay signatures", () => {
  const secret = "whsec_test";
  const body = '{"event":"subscription.charged"}';
  const sign = (payload = body, key = secret) => createHmac("sha256", key).update(payload).digest("hex");

  it("accepts a correctly signed webhook body", () => {
    expect(m.billing.verifyWebhookSignature(body, sign(), secret)).toBe(true);
  });

  it("rejects tampering, the wrong secret and junk", () => {
    expect(m.billing.verifyWebhookSignature('{"event":"evil"}', sign(), secret)).toBe(false);
    expect(m.billing.verifyWebhookSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(m.billing.verifyWebhookSignature(body, "zz", secret)).toBe(false);
    expect(m.billing.verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it("checks Checkout's payment signature over payment id | subscription id", () => {
    const signature = createHmac("sha256", "key_secret").update("pay_1|sub_1").digest("hex");
    expect(m.billing.verifyCheckoutSignature("pay_1", "sub_1", signature, "key_secret")).toBe(true);
    expect(m.billing.verifyCheckoutSignature("pay_2", "sub_1", signature, "key_secret")).toBe(false);
    expect(m.billing.verifyCheckoutSignature("pay_1", "sub_1", signature, "other")).toBe(false);
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

  it("creates a venue on the free trial that the guest page can load by short code", async () => {
    const user = await owner("a@example.com");
    const venue = onboard(user, "Juniper Coffee House");
    expect(venue.shortCode).toBe("juniper-coffee-house");
    const page = m.venues.findVenue("juniper-coffee-house");
    expect(page?.loyaltyProgram?.rewardName).toBe("Free coffee");
    expect(m.subscriptions.venueAccess(venue.id)).toBe("trial");
  });

  it("gives clashing names a unique code and refuses reserved ones", async () => {
    const user = await owner("b@example.com");
    const first = onboard(user, "Juniper Coffee House");
    expect(first.shortCode).toMatch(/^juniper-coffee-house-[0-9a-f]{6}$/);
    expect(onboard(user, "Admin").shortCode).not.toBe("admin");
    expect(() => m.admin.updateVenue(first, { shortCode: "dashboard" })).toThrow(/reserved/);
    expect(() => m.admin.updateVenue(first, { shortCode: "juniper-coffee-house" })).toThrow(/already uses/);
  });

  it("takes the guest page offline once the trial is over, and back when paid", async () => {
    const user = await owner("c@example.com");
    const venue = onboard(user, "Kettle");
    m.db.getDb().prepare("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?").run(new Date(Date.now() - 1000).toISOString(), venue.id);
    expect(m.venues.findVenue(venue.id)).toBeNull();
    // The merchant's saved setup is untouched, ready for when they subscribe.
    expect(m.venues.getVenueRecord(venue.id)?.config.loyaltyProgram?.rewardName).toBe("Free coffee");
    m.subscriptions.updateSubscription(venue.id, { paid: true, status: "active" });
    expect(m.venues.findVenue(venue.id)?.loyaltyProgram?.rewardName).toBe("Free coffee");
  });

  it("extends a lapsed trial from today", async () => {
    const user = await owner("c2@example.com");
    const venue = onboard(user, "Lapsed");
    m.db.getDb().prepare("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?").run(new Date(Date.now() - 30 * 86_400_000).toISOString(), venue.id);
    expect(m.subscriptions.venueAccess(venue.id)).toBe("unpaid");
    m.subscriptions.extendTrial(venue.id, 7);
    expect(m.subscriptions.venueAccess(venue.id)).toBe("trial");
    expect(m.venues.findVenue(venue.id)).not.toBeNull();
  });

  it("only lets owners at a venue", async () => {
    const alice = await owner("d@example.com");
    const mallory = await owner("e@example.com");
    const venue = onboard(alice, "Bloom");
    expect(m.admin.requireVenueAccess(alice, venue.id).id).toBe(venue.id);
    expect(() => m.admin.requireVenueAccess(mallory, venue.id)).toThrow(/not found/i);
  });

  it("keeps staff logins out of the dashboard and lets each invite work once", async () => {
    const alice = await owner("staff-owner@example.com");
    const bob = await owner("staff-bob@example.com");
    const venue = onboard(alice, "Till Test");
    const { url } = m.invites.createStaffInvite(venue, alice, " Staff-Bob@Example.com ", "https://tabletap.test");
    const token = new URL(url).searchParams.get("t")!;

    expect(m.invites.acceptStaffInvite(token, bob)).toBe(venue.id);
    expect(m.venues.venueRole(bob.id, venue.id)).toBe("staff");
    expect(() => m.admin.requireVenueAccess(bob, venue.id)).toThrow(/not found/i);
    expect(m.venues.listVenuesForUser(bob.id).map((v) => v.id)).not.toContain(venue.id);
    expect(m.venues.listStaffVenuesForUser(bob.id).map((v) => v.id)).toEqual([venue.id]);
    expect(m.venues.listStaffMembers(venue.id).map((s) => s.email)).toEqual(["staff-bob@example.com"]);

    // Used links don't work twice, and an owner invited by mistake stays an owner.
    expect(m.invites.acceptStaffInvite(token, bob)).toBeNull();
    const again = new URL(m.invites.createStaffInvite(venue, alice, alice.email, "https://tabletap.test").url).searchParams.get("t")!;
    m.invites.acceptStaffInvite(again, alice);
    expect(m.venues.venueRole(alice.id, venue.id)).toBe("owner");

    // A till Bob opened with his login (and one the owner paired) — only Bob's is locked when he leaves.
    const db = m.db.getDb();
    db.prepare("INSERT INTO staff_devices (id, venue_id, label, user_id) VALUES ('dev-bob', ?, 'Bob', ?), ('dev-counter', ?, 'Counter', NULL)").run(venue.id, bob.id, venue.id);
    expect(m.venues.removeStaffMember(venue.id, bob.id)).toBe(true);
    expect(m.venues.venueRole(bob.id, venue.id)).toBeNull();
    const revoked = (id: string) => !!(db.prepare("SELECT revoked_at FROM staff_devices WHERE id = ?").get(id) as { revoked_at: string | null }).revoked_at;
    expect(revoked("dev-bob")).toBe(true);
    expect(revoked("dev-counter")).toBe(false);
    expect(m.venues.removeStaffMember(venue.id, bob.id)).toBe(false);
    expect(() => m.invites.createStaffInvite(venue, alice, "not an email", "https://tabletap.test")).toThrow(/email/i);
  });

  it("undoes the last save, and undoing again redoes it", async () => {
    const user = await owner("undo@example.com");
    const venue = onboard(user, "Undo Test");
    expect(m.venues.restorePreviousConfig(venue.id)).toBe(false);
    const branding = (tagline: string) => ({ coverImageUrl: null, logoUrl: null, tagline });
    m.admin.updateVenue(venue, { config: { branding: branding("First") } });
    const second = m.admin.updateVenue(m.venues.getVenueRecord(venue.id)!, { config: { branding: branding("Second") } });
    expect(second.config.branding.tagline).toBe("Second");
    expect(m.venues.restorePreviousConfig(venue.id)).toBe(true);
    expect(m.venues.getVenueRecord(venue.id)!.config.branding.tagline).toBe("First");
    expect(m.venues.restorePreviousConfig(venue.id)).toBe(true);
    expect(m.venues.getVenueRecord(venue.id)!.config.branding.tagline).toBe("Second");
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
    await expect(m.admin.removeVenue(venue, "Wrong name")).rejects.toThrow(/exactly/);
    await m.admin.removeVenue(venue, "Delete Me");
    expect(m.venues.getVenueRecord(venue.id)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM customers WHERE venue_id = ?").get(venue.id)).toEqual({ n: 0 });
    expect(m.subscriptions.getSubscription(venue.id)).toBeNull();
  });

  it("applies Razorpay subscription events to the right venue", async () => {
    const user = await owner("i@example.com");
    const venue = onboard(user, "Razorpay Cafe");
    const event = (name: string, status: string, extra: Record<string, unknown> = {}) =>
      m.billing.handleRazorpayEvent({ event: name, payload: { subscription: { entity: { id: "sub_1", status, customer_id: "cust_1", notes: { venue_id: venue.id }, ...extra } } } });
    const yearOn = Math.floor(Date.now() / 1000) + 365 * 86_400;

    // Not live yet: nothing changes.
    event("subscription.authenticated", "authenticated");
    expect(m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: false, providerSubscriptionId: null });

    event("subscription.activated", "active", { current_end: yearOn });
    expect(m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: true, status: "active", provider: "razorpay", providerSubscriptionId: "sub_1" });
    expect(m.subscriptions.venueAccess(venue.id)).toBe("paid");

    // A failed renewal keeps the page up while Razorpay retries...
    event("subscription.pending", "pending");
    expect(m.subscriptions.venueAccess(venue.id)).toBe("paid");
    // ...and takes it offline when the retries run out (the trial is long over by then).
    m.db.getDb().prepare("UPDATE subscriptions SET trial_ends_at = NULL WHERE venue_id = ?").run(venue.id);
    event("subscription.halted", "halted");
    expect(m.subscriptions.venueAccess(venue.id)).toBe("unpaid");
    expect(m.venues.findVenue(venue.id)).toBeNull();

    // Found by subscription id when the notes are missing.
    event("subscription.charged", "active", { notes: [], current_end: yearOn });
    expect(m.subscriptions.venueAccess(venue.id)).toBe("paid");
    event("subscription.cancelled", "cancelled");
    expect(m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: false, status: "canceled" });
  });
});

describe("operator console", () => {
  async function account(email: string, verified = true) {
    const user = m.users.insertUser({ email, name: "Someone", passwordHash: await m.password.hashPassword("pw-12345678") });
    if (verified) m.users.markEmailVerified(user.id);
    return m.users.findUserById(user.id)!;
  }

  it("blocks and unblocks an account, logging who did it", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const boss = await account("boss@example.com");
    const user = await account("blockme@example.com");
    m.operator.updateUserAsAdmin(boss, user.id, { action: "block" }, "http://localhost");
    expect(m.users.findUserById(user.id)?.blocked).toBe(true);
    m.operator.updateUserAsAdmin(boss, user.id, { action: "unblock" }, "http://localhost");
    expect(m.users.findUserById(user.id)?.blocked).toBe(false);
    const log = m.log.listAdminActions({ target: { type: "user", id: user.id } });
    expect(log.map((entry) => entry.action)).toEqual(["Unblocked account", "Blocked account"]);
    expect(log[0].adminEmail).toBe("boss@example.com");
  });

  it("won't lock out yourself or a super admin", async () => {
    process.env.ADMIN_EMAILS = "boss2@example.com,other-boss@example.com";
    const boss = await account("boss2@example.com");
    const other = await account("other-boss@example.com");
    expect(() => m.operator.updateUserAsAdmin(boss, boss.id, { action: "block" }, "http://localhost")).toThrow(/your own/);
    expect(() => m.operator.updateUserAsAdmin(boss, other.id, { action: "block" }, "http://localhost")).toThrow(/super admin/);
  });

  it("deletes an account and the venues only it owns once the email is typed", async () => {
    process.env.ADMIN_EMAILS = "boss3@example.com";
    const boss = await account("boss3@example.com");
    const owner = await account("leaving@example.com");
    const venue = m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: "Leaving Cafe", venueType: "cafe", currencyCode: "GBP" }));
    await expect(m.operator.deleteUserAsAdmin(boss, owner.id, "wrong@example.com")).rejects.toThrow(/exactly/);
    await m.operator.deleteUserAsAdmin(boss, owner.id, "Leaving@Example.com");
    expect(m.users.findUserById(owner.id)).toBeNull();
    expect(m.venues.getVenueRecord(venue.id)).toBeNull();
    expect(m.log.listAdminActions({ target: { type: "user", id: owner.id } })[0]).toMatchObject({ action: "Deleted account", detail: "and 1 venue" });
  });

  it("logs venue changes", async () => {
    process.env.ADMIN_EMAILS = "boss4@example.com";
    const boss = await account("boss4@example.com");
    const owner = await account("venue-owner@example.com");
    const venue = m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: "Logged Cafe", venueType: "cafe", currencyCode: "GBP" }));
    m.operator.updateVenueAsAdmin(boss, venue.id, { extendTrialDays: 7, status: "suspended" });
    expect(m.log.listAdminActions({ target: { type: "venue", id: venue.id } }).map((entry) => entry.action).sort()).toEqual(["Extended trial", "Suspended venue"]);
  });

  it("lets only super admins make or remove admins", async () => {
    process.env.ADMIN_EMAILS = "boss5@example.com";
    const boss = await account("boss5@example.com");
    const helper = await account("helper@example.com");
    const other = await account("other@example.com");
    m.operator.updateUserAsAdmin(boss, helper.id, { action: "make_admin" }, "http://localhost");
    const promoted = m.users.findUserById(helper.id)!;
    expect(promoted.adminRole).toBe(true);
    expect(() => m.operator.updateUserAsAdmin(promoted, other.id, { action: "make_admin" }, "http://localhost")).toThrow(/super admin/);
    // A plain admin can't lock out another admin either.
    m.operator.updateUserAsAdmin(boss, other.id, { action: "make_admin" }, "http://localhost");
    expect(() => m.operator.updateUserAsAdmin(promoted, other.id, { action: "block" }, "http://localhost")).toThrow(/super admin/);
    m.operator.updateUserAsAdmin(boss, helper.id, { action: "remove_admin" }, "http://localhost");
    expect(m.users.findUserById(helper.id)?.adminRole).toBe(false);
  });

  it("switches edit-for-owner on for one admin and venue, and logs it", async () => {
    process.env.ADMIN_EMAILS = "boss6@example.com";
    const boss = await account("boss6@example.com");
    const owner = await account("edited@example.com");
    const venue = m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: "Edited Cafe", venueType: "cafe", currencyCode: "GBP" }));
    expect(m.log.editGrantExpiry(boss.id, venue.id)).toBeNull();
    m.operator.setEditMode(boss, venue.id, true);
    expect(m.log.editGrantExpiry(boss.id, venue.id)).not.toBeNull();
    expect(m.log.editGrantExpiry(owner.id, venue.id)).toBeNull();
    m.operator.setEditMode(boss, venue.id, false);
    expect(m.log.editGrantExpiry(boss.id, venue.id)).toBeNull();
    expect(m.log.listAdminActions({ target: { type: "venue", id: venue.id } }).map((entry) => entry.action)).toEqual(["Stopped editing for owner", "Started editing for owner"]);
  });
});

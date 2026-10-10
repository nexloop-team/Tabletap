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

afterAll(async () => {
  await m.db.closeDb();
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

  it("accepts a correctly signed webhook body", async () => {
    expect(m.billing.verifyWebhookSignature(body, sign(), secret)).toBe(true);
  });

  it("rejects tampering, the wrong secret and junk", async () => {
    expect(m.billing.verifyWebhookSignature('{"event":"evil"}', sign(), secret)).toBe(false);
    expect(m.billing.verifyWebhookSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(m.billing.verifyWebhookSignature(body, "zz", secret)).toBe(false);
    expect(m.billing.verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it("checks Checkout's payment signature over payment id | subscription id", async () => {
    const signature = createHmac("sha256", "key_secret").update("pay_1|sub_1").digest("hex");
    expect(m.billing.verifyCheckoutSignature("pay_1", "sub_1", signature, "key_secret")).toBe(true);
    expect(m.billing.verifyCheckoutSignature("pay_2", "sub_1", signature, "key_secret")).toBe(false);
    expect(m.billing.verifyCheckoutSignature("pay_1", "sub_1", signature, "other")).toBe(false);
  });
});

describe("venues on the SaaS side", () => {
  async function owner(email: string) {
    return await m.users.insertUser({ email, name: "Owner", passwordHash: await m.password.hashPassword("pw-12345678") });
  }

  async function onboard(user: import("./repositories/users").User, name: string) {
    return await m.admin.createVenueForUser(
      user,
      m.schema.createVenueRequest.parse({ name, venueType: "cafe", currencyCode: "GBP", loyalty: { rewardName: "Free coffee", stampsRequired: 9 } }),
    );
  }

  it("creates a venue on the free trial that the guest page can load by short code", async () => {
    const user = await owner("a@example.com");
    const venue = await onboard(user, "Juniper Coffee House");
    expect(venue.shortCode).toBe("juniper-coffee-house");
    const page = await m.venues.findVenue("juniper-coffee-house");
    expect(page?.loyaltyProgram?.rewardName).toBe("Free coffee");
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("trial");
  });

  it("gives clashing names a unique code and refuses reserved ones", async () => {
    const user = await owner("b@example.com");
    const first = await onboard(user, "Juniper Coffee House");
    expect(first.shortCode).toMatch(/^juniper-coffee-house-[0-9a-f]{6}$/);
    expect((await onboard(user, "Admin")).shortCode).not.toBe("admin");
    await expect(m.admin.updateVenue(first, { shortCode: "dashboard" })).rejects.toThrow(/reserved/);
    await expect(m.admin.updateVenue(first, { shortCode: "juniper-coffee-house" })).rejects.toThrow(/already uses/);
  });

  it("takes the guest page offline once the trial is over, and back when paid", async () => {
    const user = await owner("c@example.com");
    const venue = await onboard(user, "Kettle");
    (await (await m.db.getDb()).run("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?", new Date(Date.now() - 1000).toISOString(), venue.id));
    expect(await m.venues.findVenue(venue.id)).toBeNull();
    // The merchant's saved setup is untouched, ready for when they subscribe.
    expect((await m.venues.getVenueRecord(venue.id))?.config.loyaltyProgram?.rewardName).toBe("Free coffee");
    await m.subscriptions.updateSubscription(venue.id, { paid: true, status: "active" });
    expect((await m.venues.findVenue(venue.id))?.loyaltyProgram?.rewardName).toBe("Free coffee");
  });

  it("finds a lapsed venue for the Back soon page, but not a wrong code", async () => {
    const user = await owner("paused@example.com");
    const venue = await onboard(user, "Paused Cafe");
    expect(await m.venues.findPausedVenue(venue.shortCode)).toBeNull();
    (await (await m.db.getDb()).run("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?", new Date(Date.now() - 1000).toISOString(), venue.id));
    expect((await m.venues.findPausedVenue(venue.shortCode))?.name).toBe("Paused Cafe");
    expect(await m.venues.findPausedVenue("no-such-venue")).toBeNull();
  });

  it("subscribing again before a cancelled year ends keeps the paid-up date (dev mode)", async () => {
    const user = await owner("again@example.com");
    const venue = await onboard(user, "Again Cafe");
    const end = new Date(Date.now() + 100 * 86_400_000).toISOString();
    await m.subscriptions.updateSubscription(venue.id, { paid: true, status: "active", provider: "dev", cancelAtPeriodEnd: true, currentPeriodEnd: end });
    const record = (await m.venues.getVenueRecord(venue.id))!;
    await m.billing.startCheckout(record, user, "http://localhost");
    expect(await m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: true, cancelAtPeriodEnd: false, currentPeriodEnd: end });
  });

  it("extends a lapsed trial from today", async () => {
    const user = await owner("c2@example.com");
    const venue = await onboard(user, "Lapsed");
    (await (await m.db.getDb()).run("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?", new Date(Date.now() - 30 * 86_400_000).toISOString(), venue.id));
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("unpaid");
    await m.subscriptions.extendTrial(venue.id, 7);
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("trial");
    expect(await m.venues.findVenue(venue.id)).not.toBeNull();
  });

  it("only lets owners at a venue", async () => {
    const alice = await owner("d@example.com");
    const mallory = await owner("e@example.com");
    const venue = await onboard(alice, "Bloom");
    expect((await m.admin.requireVenueAccess(alice, venue.id)).id).toBe(venue.id);
    await expect(m.admin.requireVenueAccess(mallory, venue.id)).rejects.toThrow(/not found/i);
  });

  it("keeps staff logins out of the dashboard and lets each invite work once", async () => {
    const unverified = await owner("staff-owner@example.com");
    const venue = await onboard(unverified, "Till Test");
    // Invite emails go out from our domain, so only an owner who confirmed their own email can send them.
    await expect(m.invites.createStaffInvite(venue, unverified, "someone@example.com", "https://tabletap.test")).rejects.toThrow(/confirm your own email/i);
    await m.users.markEmailVerified(unverified.id);
    const alice = (await m.users.findUserById(unverified.id))!;
    const bob = await owner("staff-bob@example.com");
    const { url } = await m.invites.createStaffInvite(venue, alice, " Staff-Bob@Example.com ", "https://tabletap.test");
    const token = new URL(url).searchParams.get("t")!;

    expect(await m.invites.acceptStaffInvite(token, bob)).toBe(venue.id);
    expect(await m.venues.venueRole(bob.id, venue.id)).toBe("staff");
    await expect(m.admin.requireVenueAccess(bob, venue.id)).rejects.toThrow(/not found/i);
    expect((await m.venues.listVenuesForUser(bob.id)).map((v) => v.id)).not.toContain(venue.id);
    expect((await m.venues.listStaffVenuesForUser(bob.id)).map((v) => v.id)).toEqual([venue.id]);
    expect((await m.venues.listStaffMembers(venue.id)).map((s) => s.email)).toEqual(["staff-bob@example.com"]);

    // Used links don't work twice, and an owner invited by mistake stays an owner.
    expect(await m.invites.acceptStaffInvite(token, bob)).toBeNull();
    const again = new URL((await m.invites.createStaffInvite(venue, alice, alice.email, "https://tabletap.test")).url).searchParams.get("t")!;
    await m.invites.acceptStaffInvite(again, alice);
    expect(await m.venues.venueRole(alice.id, venue.id)).toBe("owner");

    // A till Bob opened with his login (and one the owner paired) — only Bob's is locked when he leaves.
    const db = await m.db.getDb();
    (await db.run("INSERT INTO staff_devices (id, venue_id, label, user_id) VALUES ('dev-bob', ?, 'Bob', ?), ('dev-counter', ?, 'Counter', NULL)", venue.id, bob.id, venue.id));
    expect(await m.venues.removeStaffMember(venue.id, bob.id)).toBe(true);
    expect(await m.venues.venueRole(bob.id, venue.id)).toBeNull();
    const revoked = async (id: string) => !!((await db.get("SELECT revoked_at FROM staff_devices WHERE id = ?", id)) as { revoked_at: string | null }).revoked_at;
    expect(await revoked("dev-bob")).toBe(true);
    expect(await revoked("dev-counter")).toBe(false);
    expect(await m.venues.removeStaffMember(venue.id, bob.id)).toBe(false);
    await expect(m.invites.createStaffInvite(venue, alice, "not an email", "https://tabletap.test")).rejects.toThrow(/email/i);
  });

  it("undoes the last save, and undoing again redoes it", async () => {
    const user = await owner("undo@example.com");
    const venue = await onboard(user, "Undo Test");
    expect(await m.venues.restorePreviousConfig(venue.id)).toBe(false);
    const branding = (tagline: string) => ({ coverImageUrl: null, logoUrl: null, tagline });
    await m.admin.updateVenue(venue, { config: { branding: branding("First") } });
    const second = await m.admin.updateVenue((await m.venues.getVenueRecord(venue.id))!, { config: { branding: branding("Second") } });
    expect(second.config.branding.tagline).toBe("Second");
    expect(await m.venues.restorePreviousConfig(venue.id)).toBe(true);
    expect((await m.venues.getVenueRecord(venue.id))!.config.branding.tagline).toBe("First");
    expect(await m.venues.restorePreviousConfig(venue.id)).toBe(true);
    expect((await m.venues.getVenueRecord(venue.id))!.config.branding.tagline).toBe("Second");
  });

  it("merges a section save and validates the result as a whole", async () => {
    const user = await owner("f@example.com");
    const venue = await onboard(user, "Merge Test");
    const saved = await m.admin.updateVenue(venue, { config: { wifi: { ssid: "Guest", password: "pw", security: "WPA2" } } });
    expect(saved.config.wifi?.ssid).toBe("Guest");
    expect(saved.config.loyaltyProgram?.rewardName).toBe("Free coffee");
    await expect(m.admin.updateVenue(saved, { config: { name: "" } })).rejects.toThrow();
  });

  it("suspended venues vanish from the guest side", async () => {
    const user = await owner("g@example.com");
    const venue = await onboard(user, "Suspend Me");
    await m.venues.setVenueStatus(venue.id, "suspended");
    expect(await m.venues.findVenue(venue.id)).toBeNull();
    expect((await m.venues.getVenueRecord(venue.id))?.status).toBe("suspended");
  });

  it("deletes a venue with its guests and subscription", async () => {
    const user = await owner("h@example.com");
    const venue = await onboard(user, "Delete Me");
    const db = await m.db.getDb();
    (await db.run("INSERT INTO customers (id, venue_id, email, capture_source) VALUES ('cus_x', ?, 'g@example.com', 'landing')", venue.id));
    await expect(m.admin.removeVenue(venue, "Wrong name")).rejects.toThrow(/exactly/);
    await m.admin.removeVenue(venue, "Delete Me");
    expect(await m.venues.getVenueRecord(venue.id)).toBeNull();
    expect((await db.get("SELECT COUNT(*) AS n FROM customers WHERE venue_id = ?", venue.id))).toEqual({ n: 0 });
    expect(await m.subscriptions.getSubscription(venue.id)).toBeNull();
  });

  it("applies Razorpay subscription events to the right venue", async () => {
    const user = await owner("i@example.com");
    const venue = await onboard(user, "Razorpay Cafe");
    const event = async (name: string, status: string, extra: Record<string, unknown> = {}) =>
      await m.billing.handleRazorpayEvent({ event: name, payload: { subscription: { entity: { id: "sub_1", status, customer_id: "cust_1", notes: { venue_id: venue.id }, ...extra } } } });
    const yearOn = Math.floor(Date.now() / 1000) + 365 * 86_400;

    // Not live yet: nothing changes.
    await event("subscription.authenticated", "authenticated");
    expect(await m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: false, providerSubscriptionId: null });

    await event("subscription.activated", "active", { current_end: yearOn });
    expect(await m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: true, status: "active", provider: "razorpay", providerSubscriptionId: "sub_1" });
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("paid");

    // A failed renewal keeps the page up while Razorpay retries...
    await event("subscription.pending", "pending");
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("paid");
    // ...and takes it offline when the retries run out (the trial is long over by then).
    (await (await m.db.getDb()).run("UPDATE subscriptions SET trial_ends_at = NULL WHERE venue_id = ?", venue.id));
    await event("subscription.halted", "halted");
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("unpaid");
    expect(await m.venues.findVenue(venue.id)).toBeNull();

    // Found by subscription id when the notes are missing.
    await event("subscription.charged", "active", { notes: [], current_end: yearOn });
    expect(await m.subscriptions.venueAccess(venue.id)).toBe("paid");
    await event("subscription.cancelled", "cancelled");
    expect(await m.subscriptions.getSubscription(venue.id)).toMatchObject({ paid: false, status: "canceled" });
  });
});

describe("operator console", () => {
  async function account(email: string, verified = true) {
    const user = await m.users.insertUser({ email, name: "Someone", passwordHash: await m.password.hashPassword("pw-12345678") });
    if (verified) await m.users.markEmailVerified(user.id);
    return (await m.users.findUserById(user.id))!;
  }

  it("blocks and unblocks an account, logging who did it", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const boss = await account("boss@example.com");
    const user = await account("blockme@example.com");
    await m.operator.updateUserAsAdmin(boss, user.id, { action: "block" }, "http://localhost");
    expect((await m.users.findUserById(user.id))?.blocked).toBe(true);
    await m.operator.updateUserAsAdmin(boss, user.id, { action: "unblock" }, "http://localhost");
    expect((await m.users.findUserById(user.id))?.blocked).toBe(false);
    const log = await m.log.listAdminActions({ target: { type: "user", id: user.id } });
    expect(log.map((entry) => entry.action)).toEqual(["Unblocked account", "Blocked account"]);
    expect(log[0].adminEmail).toBe("boss@example.com");
  });

  it("won't lock out yourself or a super admin", async () => {
    process.env.ADMIN_EMAILS = "boss2@example.com,other-boss@example.com";
    const boss = await account("boss2@example.com");
    const other = await account("other-boss@example.com");
    await expect(m.operator.updateUserAsAdmin(boss, boss.id, { action: "block" }, "http://localhost")).rejects.toThrow(/your own/);
    await expect(m.operator.updateUserAsAdmin(boss, other.id, { action: "block" }, "http://localhost")).rejects.toThrow(/super admin/);
  });

  it("deletes an account and the venues only it owns once the email is typed", async () => {
    process.env.ADMIN_EMAILS = "boss3@example.com";
    const boss = await account("boss3@example.com");
    const owner = await account("leaving@example.com");
    const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: "Leaving Cafe", venueType: "cafe", currencyCode: "GBP" }));
    await expect(m.operator.deleteUserAsAdmin(boss, owner.id, "wrong@example.com")).rejects.toThrow(/exactly/);
    await m.operator.deleteUserAsAdmin(boss, owner.id, "Leaving@Example.com");
    expect(await m.users.findUserById(owner.id)).toBeNull();
    expect(await m.venues.getVenueRecord(venue.id)).toBeNull();
    expect((await m.log.listAdminActions({ target: { type: "user", id: owner.id } }))[0]).toMatchObject({ action: "Deleted account", detail: "and 1 venue" });
  });

  it("logs venue changes", async () => {
    process.env.ADMIN_EMAILS = "boss4@example.com";
    const boss = await account("boss4@example.com");
    const owner = await account("venue-owner@example.com");
    const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: "Logged Cafe", venueType: "cafe", currencyCode: "GBP" }));
    await m.operator.updateVenueAsAdmin(boss, venue.id, { extendTrialDays: 7, status: "suspended" });
    expect((await m.log.listAdminActions({ target: { type: "venue", id: venue.id } })).map((entry) => entry.action).sort()).toEqual(["Extended trial", "Suspended venue"]);
  });

  it("lets only super admins make or remove admins", async () => {
    process.env.ADMIN_EMAILS = "boss5@example.com";
    const boss = await account("boss5@example.com");
    const helper = await account("helper@example.com");
    const other = await account("other@example.com");
    await m.operator.updateUserAsAdmin(boss, helper.id, { action: "make_admin" }, "http://localhost");
    const promoted = (await m.users.findUserById(helper.id))!;
    expect(promoted.adminRole).toBe(true);
    await expect(m.operator.updateUserAsAdmin(promoted, other.id, { action: "make_admin" }, "http://localhost")).rejects.toThrow(/super admin/);
    // A plain admin can't lock out another admin either.
    await m.operator.updateUserAsAdmin(boss, other.id, { action: "make_admin" }, "http://localhost");
    await expect(m.operator.updateUserAsAdmin(promoted, other.id, { action: "block" }, "http://localhost")).rejects.toThrow(/super admin/);
    await m.operator.updateUserAsAdmin(boss, helper.id, { action: "remove_admin" }, "http://localhost");
    expect((await m.users.findUserById(helper.id))?.adminRole).toBe(false);
  });

  it("switches edit-for-owner on for one admin and venue, and logs it", async () => {
    process.env.ADMIN_EMAILS = "boss6@example.com";
    const boss = await account("boss6@example.com");
    const owner = await account("edited@example.com");
    const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: "Edited Cafe", venueType: "cafe", currencyCode: "GBP" }));
    expect(await m.log.editGrantExpiry(boss.id, venue.id)).toBeNull();
    await m.operator.setEditMode(boss, venue.id, true);
    expect(await m.log.editGrantExpiry(boss.id, venue.id)).not.toBeNull();
    expect(await m.log.editGrantExpiry(owner.id, venue.id)).toBeNull();
    await m.operator.setEditMode(boss, venue.id, false);
    expect(await m.log.editGrantExpiry(boss.id, venue.id)).toBeNull();
    expect((await m.log.listAdminActions({ target: { type: "venue", id: venue.id } })).map((entry) => entry.action)).toEqual(["Stopped editing for owner", "Started editing for owner"]);
  });
});

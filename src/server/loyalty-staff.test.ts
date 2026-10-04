import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { digestWeek, localDate } from "./jobs/time";

// db.ts reads DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletap-staff-"));
process.env.DATA_DIR = dataDir;

type M = {
  db: typeof import("./db");
  users: typeof import("./repositories/users");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  staff: typeof import("./services/staff");
  cards: typeof import("./repositories/loyalty-cards");
  customers: typeof import("./repositories/customers");
  venues: typeof import("./repositories/venues");
  digest: typeof import("./jobs/digest");
  insights: typeof import("./repositories/insights");
};
let m: M;

beforeAll(async () => {
  m = {
    db: await import("./db"),
    users: await import("./repositories/users"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    staff: await import("./services/staff"),
    cards: await import("./repositories/loyalty-cards"),
    customers: await import("./repositories/customers"),
    venues: await import("./repositories/venues"),
    digest: await import("./jobs/digest"),
    insights: await import("./repositories/insights"),
  };
});

afterAll(() => {
  globalThis.__appDb?.close();
  globalThis.__appDb = undefined;
  globalThis.__appDbMigrations = undefined;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
/** A venue on its Pro trial with a 5-stamp card (free pastry at 3), one member, and a paired device. */
function setup() {
  seq += 1;
  const owner = m.users.insertUser({ email: `owner${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const venue = m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Stamp Cafe ${seq}`, venueType: "cafe", currencyCode: "GBP" }));
  m.admin.updateVenue(venue, {
    config: {
      loyaltyProgram: {
        rewardName: "Free coffee",
        stampsRequired: 5,
        rewardTiers: [
          { rewardName: "Free pastry", stampsRequired: 3 },
          { rewardName: "Free coffee", stampsRequired: 5 },
        ],
      },
    },
  });
  const db = m.db.getDb();
  const { customer } = m.customers.upsertCustomer(db, { venueId: venue.id, email: `guest${seq}@example.com`, firstName: "Gus", captureSource: "landing" });
  const card = m.cards.createCard(db, venue.id, customer.id, 0);
  db.prepare("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')").run(`dev_${seq}`, venue.id);
  return { venue, card, device: { id: `dev_${seq}`, venueId: venue.id, label: "Till" } };
}

describe("staff stamping", () => {
  it("stamps, enforces the cooldown unless confirmed, and caps at the top reward", () => {
    const { card, device } = setup();
    expect(m.staff.stampCard(device, card.id, 1, false).stamps).toBe(1);
    expect(() => m.staff.stampCard(device, card.id, 1, false)).toThrow(/stamped/);
    expect(m.staff.stampCard(device, card.id, 2, true).stamps).toBe(3);
    // Asking for 5 more only fills the card to the top reward.
    const full = m.staff.stampCard(device, card.id, 5, true);
    expect(full.stamps).toBe(5);
    expect(full.tiers.every((tier) => tier.unlocked)).toBe(true);
    expect(() => m.staff.stampCard(device, card.id, 1, true)).toThrow(/full/);
  });

  it("redeems a tier by spending its stamps, and undo puts them back", () => {
    const { card, device } = setup();
    m.staff.stampCard(device, card.id, 4, false);
    expect(() => m.staff.redeemReward(device, card.id, 1)).toThrow(/Not enough/);
    const redeemed = m.staff.redeemReward(device, card.id, 0);
    expect(redeemed.stamps).toBe(1);
    expect(redeemed.undoable).toMatchObject({ kind: "redeem", rewardName: "Free pastry" });
    const undone = m.staff.undoLast(device, card.id);
    expect(undone.stamps).toBe(4);
    // The stamp before it is still undoable, then there's nothing left.
    expect(m.staff.undoLast(device, card.id).stamps).toBe(0);
    expect(() => m.staff.undoLast(device, card.id)).toThrow(/Nothing to undo/);
  });

  it("only works on cards from the device's own venue", () => {
    const a = setup();
    const b = setup();
    expect(() => m.staff.stampCard(a.device, b.card.id, 1, false)).toThrow(/couldn't find/);
  });

  it("stops when the venue's plan no longer includes loyalty", () => {
    const { venue, card, device } = setup();
    m.db.getDb().prepare("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?").run(new Date(Date.now() - 1000).toISOString(), venue.id);
    expect(() => m.staff.stampCard(device, card.id, 1, false)).toThrow(/no active stamp card/);
  });

  it("finds members by name or email, masking the address", () => {
    const { device, card } = setup();
    const [match] = m.staff.searchMembers(device, "gus");
    expect(match.cardId).toBe(card.id);
    expect(match.email).toMatch(/•••/);
    expect(m.staff.searchMembers(device, "g")).toEqual([]);
  });

  it("revoked devices disappear from the owner's list", () => {
    const { venue, device } = setup();
    expect(m.staff.listStaffDevices(venue.id).map((d) => d.id)).toContain(device.id);
    m.staff.revokeStaffDevice(venue.id, device.id);
    expect(m.staff.listStaffDevices(venue.id)).toEqual([]);
    expect(() => m.staff.revokeStaffDevice(venue.id, device.id)).toThrow(/not found/);
  });

  it("counts stamps given and rewards redeemed in the venue stats", () => {
    const { venue, card, device } = setup();
    m.staff.stampCard(device, card.id, 3, false);
    m.staff.redeemReward(device, card.id, 0);
    const stats = m.insights.venueStats(venue.id, 7);
    expect(stats.stampsGiven).toBe(3);
    expect(stats.rewardsRedeemed).toBe(1);
  });
});

describe("weekly digest", () => {
  it("is due from 08:00 on Monday (London time) and keyed by that Monday", () => {
    // 2026-10-05 is a Monday; London is on BST (UTC+1).
    expect(digestWeek(new Date("2026-10-05T06:30:00Z"))).toBeNull();
    expect(digestWeek(new Date("2026-10-05T07:05:00Z"))).toBe("2026-10-05");
    expect(digestWeek(new Date("2026-10-10T22:00:00Z"))).toBe("2026-10-05");
    // Sunday evening still belongs to the previous week…
    expect(digestWeek(new Date("2026-10-04T20:00:00Z"))).toBe("2026-09-28");
    // …and 23:30 UTC on Sunday is already 00:30 Monday in London: not due yet.
    expect(localDate(new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
    expect(digestWeek(new Date("2026-10-04T23:30:00Z"))).toBeNull();
  });

  it("sends once per owner, venue and week, and only to verified owners", async () => {
    const { venue } = setup();
    const db = m.db.getDb();
    // Old enough to qualify, owner verified.
    db.prepare("UPDATE venues SET created_at = datetime('now', '-10 days') WHERE id = ?").run(venue.id);
    db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id IN (SELECT user_id FROM venue_members WHERE venue_id = ?)").run(venue.id);
    const monday = new Date("2026-10-05T09:00:00Z");
    const outbox = () => (db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE subject LIKE ?").get(`%${venue.config.name}%`) as { n: number }).n;
    await m.digest.runWeeklyDigest(monday);
    expect(outbox()).toBe(1);
    await m.digest.runWeeklyDigest(monday);
    expect(outbox()).toBe(1);
    await m.digest.runWeeklyDigest(new Date("2026-10-12T09:00:00Z"));
    expect(outbox()).toBe(2);
  });
});

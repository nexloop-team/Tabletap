import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { digestWeek, localDate } from "./jobs/time";

// db.ts reads DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-staff-"));
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

afterAll(async () => {
  await m.db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
/** A venue on its Pro trial with a 5-stamp card (free pastry at 3), one member, and a paired device. */
async function setup() {
  seq += 1;
  const owner = await m.users.insertUser({ email: `owner${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Stamp Cafe ${seq}`, venueType: "cafe", currencyCode: "GBP" }));
  await m.admin.updateVenue(venue, {
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
  const db = await m.db.getDb();
  const { customer } = await m.customers.upsertCustomer(db, { venueId: venue.id, email: `guest${seq}@example.com`, firstName: "Gus", captureSource: "landing" });
  const card = await m.cards.createCard(db, venue.id, customer.id, 0);
  (await db.run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", `dev_${seq}`, venue.id));
  return { venue, card, device: { id: `dev_${seq}`, venueId: venue.id, label: "Till" } };
}

describe("staff stamping", () => {
  it("stamps, enforces the cooldown unless confirmed, and caps at the top reward", async () => {
    const { card, device } = await setup();
    expect((await m.staff.stampCard(device, card.id, 1, false)).stamps).toBe(1);
    await expect(m.staff.stampCard(device, card.id, 1, false)).rejects.toThrow(/stamped/);
    expect((await m.staff.stampCard(device, card.id, 2, true)).stamps).toBe(3);
    // Asking for 5 more only fills the card to the top reward.
    const full = await m.staff.stampCard(device, card.id, 5, true);
    expect(full.stamps).toBe(5);
    expect(full.tiers.every((tier) => tier.unlocked)).toBe(true);
    await expect(m.staff.stampCard(device, card.id, 1, true)).rejects.toThrow(/full/);
  });

  it("redeems a tier by spending its stamps, and undo puts them back", async () => {
    const { card, device } = await setup();
    await m.staff.stampCard(device, card.id, 4, false);
    await expect(m.staff.redeemReward(device, card.id, 1)).rejects.toThrow(/Not enough/);
    const redeemed = await m.staff.redeemReward(device, card.id, 0);
    expect(redeemed.stamps).toBe(1);
    expect(redeemed.undoable).toMatchObject({ kind: "redeem", rewardName: "Free pastry" });
    const undone = await m.staff.undoLast(device, card.id);
    expect(undone.stamps).toBe(4);
    // The stamp before it is still undoable, then there's nothing left.
    expect((await m.staff.undoLast(device, card.id)).stamps).toBe(0);
    await expect(m.staff.undoLast(device, card.id)).rejects.toThrow(/Nothing to undo/);
  });

  it("only works on cards from the device's own venue", async () => {
    const a = await setup();
    const b = await setup();
    await expect(m.staff.stampCard(a.device, b.card.id, 1, false)).rejects.toThrow(/couldn't find/);
  });

  it("stops when the venue's plan no longer includes loyalty", async () => {
    const { venue, card, device } = await setup();
    (await (await m.db.getDb()).run("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?", new Date(Date.now() - 1000).toISOString(), venue.id));
    await expect(m.staff.stampCard(device, card.id, 1, false)).rejects.toThrow(/no active stamp card/);
  });

  it("finds members by name or email, masking the address", async () => {
    const { device, card } = await setup();
    const [match] = await m.staff.searchMembers(device, "gus");
    expect(match.cardId).toBe(card.id);
    expect(match.email).toMatch(/•••/);
    expect(await m.staff.searchMembers(device, "g")).toEqual([]);
  });

  it("revoked devices disappear from the owner's list", async () => {
    const { venue, device } = await setup();
    expect((await m.staff.listStaffDevices(venue.id)).map((d) => d.id)).toContain(device.id);
    await m.staff.revokeStaffDevice(venue.id, device.id);
    expect(await m.staff.listStaffDevices(venue.id)).toEqual([]);
    await expect(m.staff.revokeStaffDevice(venue.id, device.id)).rejects.toThrow(/not found/);
  });

  it("counts stamps given and rewards redeemed in the venue stats", async () => {
    const { venue, card, device } = await setup();
    await m.staff.stampCard(device, card.id, 3, false);
    await m.staff.redeemReward(device, card.id, 0);
    const stats = await m.insights.venueStats(venue.id, 7);
    expect(stats.stampsGiven).toBe(3);
    expect(stats.rewardsRedeemed).toBe(1);
  });
});

describe("weekly digest", () => {
  it("is due from 08:00 on Monday in the venue's time zone and keyed by that Monday", async () => {
    // 2026-10-05 is a Monday. India is UTC+5:30 (the default); London is on BST (UTC+1).
    expect(digestWeek(new Date("2026-10-05T02:00:00Z"))).toBeNull();
    expect(digestWeek(new Date("2026-10-05T02:35:00Z"))).toBe("2026-10-05");
    expect(digestWeek(new Date("2026-10-10T22:00:00Z"))).toBe("2026-10-05");
    // Sunday evening (IST) still belongs to the previous week…
    expect(digestWeek(new Date("2026-10-04T14:00:00Z"))).toBe("2026-09-28");
    // …and 19:00 UTC on Sunday is already 00:30 Monday in India: not due yet.
    expect(localDate(new Date("2026-10-04T19:00:00Z"))).toBe("2026-10-05");
    expect(digestWeek(new Date("2026-10-04T19:00:00Z"))).toBeNull();
    // A UK venue's week turns over on London time.
    expect(digestWeek(new Date("2026-10-05T06:30:00Z"), "Europe/London")).toBeNull();
    expect(digestWeek(new Date("2026-10-05T07:05:00Z"), "Europe/London")).toBe("2026-10-05");
  });

  it("sends once per owner, venue and week, and only to verified owners", async () => {
    const { venue } = await setup();
    const db = await m.db.getDb();
    // Old enough to qualify, owner verified.
    (await db.run("UPDATE venues SET created_at = now() + INTERVAL '-10 days' WHERE id = ?", venue.id));
    (await db.run("UPDATE users SET email_verified_at = now() WHERE id IN (SELECT user_id FROM venue_members WHERE venue_id = ?)", venue.id));
    const monday = new Date("2026-10-05T09:00:00Z");
    const outbox = async () => ((await db.get("SELECT COUNT(*) AS n FROM outbox WHERE subject LIKE ?", `%${venue.config.name}%`)) as { n: number }).n;
    await m.digest.runWeeklyDigest(monday);
    expect(await outbox()).toBe(1);
    await m.digest.runWeeklyDigest(monday);
    expect(await outbox()).toBe(1);
    await m.digest.runWeeklyDigest(new Date("2026-10-12T09:00:00Z"));
    expect(await outbox()).toBe(2);
  });
});

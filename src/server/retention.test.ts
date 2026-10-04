import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liveAnnouncement } from "@/lib/venue/features";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletap-retention-"));
process.env.DATA_DIR = dataDir;
delete process.env.ANTHROPIC_API_KEY;

type M = {
  db: typeof import("./db");
  users: typeof import("./repositories/users");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  contracts: typeof import("@/lib/api/contracts");
  loyalty: typeof import("./services/loyalty");
  staff: typeof import("./services/staff");
  cards: typeof import("./repositories/loyalty-cards");
  retention: typeof import("./repositories/retention");
  venues: typeof import("./repositories/venues");
  guestEmails: typeof import("./jobs/guest-emails");
  ai: typeof import("./services/ai");
};
let m: M;

beforeAll(async () => {
  m = {
    db: await import("./db"),
    users: await import("./repositories/users"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    contracts: await import("@/lib/api/contracts"),
    loyalty: await import("./services/loyalty"),
    staff: await import("./services/staff"),
    cards: await import("./repositories/loyalty-cards"),
    retention: await import("./repositories/retention"),
    venues: await import("./repositories/venues"),
    guestEmails: await import("./jobs/guest-emails"),
    ai: await import("./services/ai"),
  };
});

afterAll(() => {
  globalThis.__appDb?.close();
  globalThis.__appDb = undefined;
  globalThis.__appDbMigrations = undefined;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
/** Pro-trial venue with a 6-stamp card, referrals on (2 for the inviter, 1 for the friend), and a till device. */
function setup() {
  seq += 1;
  const owner = m.users.insertUser({ email: `o${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const record = m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Ref Cafe ${seq}`, venueType: "cafe", currencyCode: "GBP" }));
  m.admin.updateVenue(record, {
    config: {
      loyaltyProgram: { rewardName: "Free coffee", stampsRequired: 6, referral: { enabled: true, referrerStamps: 2, friendStamps: 1 } },
      crm: { enabled: true, consentAsk: true, wifiCapture: false, feedbackCapture: false, birthdayAsk: true },
    },
  });
  const device = { id: `dev_r${seq}`, venueId: record.id, label: "Till" };
  m.db.getDb().prepare("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')").run(device.id, record.id);
  return { venueId: record.id, device };
}

function join(venueId: string, email: string, ref?: string) {
  return m.loyalty.enroll(m.contracts.enrollRequest.parse({ venueId, email, firstName: "Sam", captureSource: "landing", ref }), "http://localhost:3000");
}

const outboxCount = (subjectLike: string) =>
  (m.db.getDb().prepare("SELECT COUNT(*) AS n FROM outbox WHERE subject LIKE ?").get(`%${subjectLike}%`) as { n: number }).n;

describe("menu schema additions", () => {
  it("accepts explainers, badges and specials, and caps their size", () => {
    const item = { id: "i1", name: "Shakshuka", priceInPence: 950, isAvailable: true, allergens: [], dietaryTags: [] };
    expect(m.schema.menuItemSchema.safeParse({ ...item, explainer: "Eggs poached in spiced tomato.", badges: ["chef"], featured: true }).success).toBe(true);
    expect(m.schema.menuItemSchema.safeParse({ ...item, explainer: "x".repeat(601) }).success).toBe(false);
    expect(m.schema.menuItemSchema.safeParse({ ...item, badges: ["cheap"] }).success).toBe(false);
  });

  it("hides an announcement after its last day", () => {
    expect(liveAnnouncement({ text: "Pumpkin latte!", until: "2026-10-10" }, "2026-10-10")?.text).toBe("Pumpkin latte!");
    expect(liveAnnouncement({ text: "Pumpkin latte!", until: "2026-10-10" }, "2026-10-11")).toBeNull();
    expect(liveAnnouncement({ text: "  ", until: null }, "2026-10-11")).toBeNull();
    expect(liveAnnouncement({ text: "Always on" }, "2030-01-01")?.text).toBe("Always on");
  });
});

describe("AI guard rails", () => {
  it("refuses cleanly when no API key is configured", async () => {
    expect(m.ai.aiConfigured()).toBe(false);
    await expect(m.ai.explainDishes({ id: "v", name: "Cafe" }, [{ id: "a", name: "Shakshuka" }], false)).rejects.toThrow(/isn't set up/);
  });
});

describe("refer a friend", () => {
  it("gives the friend welcome stamps and the inviter stamps only after the friend's first staff stamp", () => {
    const { venueId, device } = setup();
    const inviter = join(venueId, "inviter@example.com");
    const code = m.retention.ensureReferralCode(inviter.cardId);
    expect(m.retention.ensureReferralCode(inviter.cardId)).toBe(code);

    const friend = join(venueId, "friend@example.com", code);
    const db = m.db.getDb();
    expect(m.cards.findCardById(db, friend.cardId)?.stamps).toBe(1);
    expect(m.cards.findCardById(db, inviter.cardId)?.stamps).toBe(0);

    m.staff.stampCard(device, friend.cardId, 1, false);
    expect(m.cards.findCardById(db, inviter.cardId)?.stamps).toBe(2);
    // Later stamps don't pay out again.
    m.staff.stampCard(device, friend.cardId, 1, true);
    expect(m.cards.findCardById(db, inviter.cardId)?.stamps).toBe(2);
  });

  it("ignores self-referral, unknown codes and caps rewards at five a month", () => {
    const { venueId, device } = setup();
    const inviter = join(venueId, "cap@example.com");
    const code = m.retention.ensureReferralCode(inviter.cardId);
    // Re-joining with your own email can't refer yourself.
    join(venueId, "cap@example.com", code);
    expect(join(venueId, "nobody@example.com", "zzzzzzzz").cardId).toBeTruthy();

    for (let i = 0; i < 7; i++) {
      const friend = join(venueId, `f${i}@example.com`, code);
      m.staff.stampCard(device, friend.cardId, 1, false);
    }
    // 5 rewards × 2 stamps, capped by the 6-stamp goal.
    const events = m.db.getDb().prepare("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ? AND kind = 'referral'").get(inviter.cardId) as { n: number };
    expect(events.n).toBe(3);
    expect(m.cards.findCardById(m.db.getDb(), inviter.cardId)?.stamps).toBe(6);
  });
});

describe("automatic guest emails", () => {
  it("emails once when a stamp unlocks the reward", () => {
    const { venueId, device } = setup();
    const subject = `Free coffee is ready at ${m.venues.getVenueRecord(venueId)!.config.name}`;
    const guest = join(venueId, "ready@example.com");
    m.staff.stampCard(device, guest.cardId, 5, false);
    expect(outboxCount(subject)).toBe(0);
    m.staff.stampCard(device, guest.cardId, 1, true);
    expect(outboxCount(subject)).toBe(1);
    // Redeem and re-reach the goal the same day: no second email.
    m.staff.redeemReward(device, guest.cardId, 0);
    m.staff.stampCard(device, guest.cardId, 5, true);
    m.staff.stampCard(device, guest.cardId, 1, true);
    expect(outboxCount(subject)).toBe(1);
  });

  it("sends birthday and win-back emails only to opted-in guests, once, in daytime", async () => {
    const { venueId } = setup();
    const venue = m.venues.getVenueRecord(venueId)!;
    const db = m.db.getDb();
    m.venues.saveVenueSettings(venueId, {
      ...m.venues.getVenueSettings(venueId),
      automations: { rewardReady: true, birthday: { enabled: true, offer: "Free cake" }, winBack: { enabled: true, days: 30, offer: "Free pastry" } },
    });
    const optedIn = join(venueId, "yes@example.com");
    const notAsked = join(venueId, "no@example.com");
    db.prepare("UPDATE customers SET marketing_consent = 'granted', birthday_month = 10, birthday_day = 8 WHERE id = ?").run(optedIn.customerId);
    db.prepare("UPDATE customers SET birthday_month = 10, birthday_day = 8 WHERE id = ?").run(notAsked.customerId);
    db.prepare("UPDATE customers SET created_at = datetime('now', '-60 days') WHERE id IN (?, ?)").run(optedIn.customerId, notAsked.customerId);

    // 5 Oct 2026, 10:00 London: birthdays on 8 Oct are due.
    const morning = new Date("2026-10-05T09:00:00Z");
    await m.guestEmails.runGuestAutomations(new Date("2026-10-05T05:00:00Z"));
    expect(outboxCount(`birthday from ${venue.config.name}`)).toBe(0);
    await m.guestEmails.runGuestAutomations(morning);
    await m.guestEmails.runGuestAutomations(morning);
    expect(outboxCount(`birthday from ${venue.config.name}`)).toBe(1);
    expect(outboxCount(`We miss you at ${venue.config.name}`)).toBe(1);

    const mail = db.prepare("SELECT recipient, body FROM outbox WHERE subject LIKE ?").get(`%birthday from ${venue.config.name}%`) as { recipient: string; body: string };
    expect(mail.recipient).toBe("yes@example.com");
    expect(mail.body).toContain("Free cake");
    expect(mail.body).toMatch(/\/unsubscribe\?token=/);
  });

  it("unsubscribing stops further marketing", () => {
    const { venueId } = setup();
    const guest = join(venueId, "bye@example.com");
    const token = m.retention.ensureUnsubscribeToken(guest.customerId);
    const found = m.retention.findByUnsubscribeToken(token)!;
    m.retention.unsubscribe(found.customerId);
    expect(m.retention.findByUnsubscribeToken(token)?.consent).toBe("declined");
  });
});

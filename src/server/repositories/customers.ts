import "server-only";
import type { Db } from "../db";
import { newId } from "../ids";

export type ConsentState = "unasked" | "declined" | "pending" | "granted";

export interface CustomerRow {
  id: string;
  venue_id: string;
  email: string;
  first_name: string | null;
  name: string | null;
  locale: string | null;
  capture_source: string | null;
  marketing_consent: ConsentState;
  age_attested: number;
  consent_token: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  birthday_skips: number;
  created_at: string;
}

export async function findCustomerByEmail(db: Db, venueId: string, email: string): Promise<CustomerRow | null> {
  return ((await db.get("SELECT * FROM customers WHERE venue_id = ? AND email = ?", venueId, email)) as CustomerRow | undefined) ?? null;
}

export async function findCustomerById(db: Db, venueId: string, customerId: string): Promise<CustomerRow | null> {
  return ((await db.get("SELECT * FROM customers WHERE venue_id = ? AND id = ?", venueId, customerId)) as CustomerRow | undefined) ?? null;
}

export async function findCustomerByConsentToken(db: Db, token: string): Promise<CustomerRow | null> {
  return ((await db.get("SELECT * FROM customers WHERE consent_token = ?", token)) as CustomerRow | undefined) ?? null;
}

export interface NewCustomer {
  venueId: string;
  email: string;
  firstName?: string | null;
  name?: string | null;
  locale?: string | null;
  captureSource: string;
}

/** Returns the existing customer for this venue+email, or creates one. */
export async function upsertCustomer(db: Db, input: NewCustomer): Promise<{ customer: CustomerRow; created: boolean }> {
  const existing = await findCustomerByEmail(db, input.venueId, input.email);
  if (existing) {
    // Fill gaps, never overwrite what the guest told us earlier.
    if ((!existing.first_name && input.firstName) || (!existing.name && input.name)) {
      (await db.run("UPDATE customers SET first_name = COALESCE(first_name, ?), name = COALESCE(name, ?) WHERE id = ?", input.firstName ?? null,
        input.name ?? null,
        existing.id,));
    }
    return { customer: (await findCustomerById(db, input.venueId, existing.id))!, created: false };
  }
  const id = newId("cus");
  // Two joins with the same email at once: the second finds the first's row instead of failing.
  const inserted = await db.run(
    "INSERT INTO customers (id, venue_id, email, first_name, name, locale, capture_source) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (venue_id, email) DO NOTHING", id, input.venueId, input.email, input.firstName ?? null, input.name ?? null, input.locale ?? null, input.captureSource);
  if (inserted.changes === 0) return { customer: (await findCustomerByEmail(db, input.venueId, input.email))!, created: false };
  return { customer: (await findCustomerById(db, input.venueId, id))!, created: true };
}

export async function setConsent(db: Db, customerId: string, state: ConsentState, ageAttested: boolean, token: string | null) {
  (await db.run(
    "UPDATE customers SET marketing_consent = ?, age_attested = ?, consent_token = ?, consent_updated_at = now() WHERE id = ?", state, ageAttested ? 1 : 0, token, customerId));
}

/** Records a birthday once. Joins aren't signed in, so a later form can't change one already given. */
export async function setBirthday(db: Db, customerId: string, month: number, day: number) {
  (await db.run("UPDATE customers SET birthday_month = ?, birthday_day = ? WHERE id = ? AND birthday_month IS NULL", month, day, customerId));
}

export async function recordBirthdaySkip(db: Db, customerId: string) {
  (await db.run("UPDATE customers SET birthday_skips = birthday_skips + 1 WHERE id = ?", customerId));
}

export async function recordVisit(db: Db, venueId: string, customerId: string, type: string) {
  (await db.run("INSERT INTO visits (venue_id, customer_id, type) VALUES (?, ?, ?)", venueId, customerId, type));
}

/**
 * Erases a guest from one venue: their details, card, stamps, visits and
 * email history (the right to erasure under India's DPDP Act). Feedback is
 * anonymous and stays. Returns false when there was no such guest.
 */
export async function deleteGuest(db: Db, venueId: string, customerId: string): Promise<boolean> {
  const guest = await findCustomerById(db, venueId, customerId);
  if (!guest) return false;
  const card = (await db.get("SELECT id FROM loyalty_cards WHERE customer_id = ?", customerId)) as { id: string } | undefined;
  if (card) {
    (await db.run("UPDATE loyalty_cards SET referred_by_card_id = NULL WHERE referred_by_card_id = ?", card.id));
    (await db.run("DELETE FROM stamp_events WHERE card_id = ?", card.id));
    (await db.run("DELETE FROM loyalty_cards WHERE id = ?", card.id));
  }
  (await db.run("DELETE FROM visits WHERE customer_id = ?", customerId));
  (await db.run("DELETE FROM guest_emails WHERE customer_id = ?", customerId));
  (await db.run("DELETE FROM customers WHERE id = ?", customerId));
  return true;
}

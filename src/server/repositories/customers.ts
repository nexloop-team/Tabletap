import "server-only";
import type { DatabaseSync } from "node:sqlite";
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

export function findCustomerByEmail(db: DatabaseSync, venueId: string, email: string): CustomerRow | null {
  return (db.prepare("SELECT * FROM customers WHERE venue_id = ? AND email = ?").get(venueId, email) as CustomerRow | undefined) ?? null;
}

export function findCustomerById(db: DatabaseSync, venueId: string, customerId: string): CustomerRow | null {
  return (db.prepare("SELECT * FROM customers WHERE venue_id = ? AND id = ?").get(venueId, customerId) as CustomerRow | undefined) ?? null;
}

export function findCustomerByConsentToken(db: DatabaseSync, token: string): CustomerRow | null {
  return (db.prepare("SELECT * FROM customers WHERE consent_token = ?").get(token) as CustomerRow | undefined) ?? null;
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
export function upsertCustomer(db: DatabaseSync, input: NewCustomer): { customer: CustomerRow; created: boolean } {
  const existing = findCustomerByEmail(db, input.venueId, input.email);
  if (existing) {
    // Fill gaps, never overwrite what the guest told us earlier.
    if ((!existing.first_name && input.firstName) || (!existing.name && input.name)) {
      db.prepare("UPDATE customers SET first_name = COALESCE(first_name, ?), name = COALESCE(name, ?) WHERE id = ?").run(
        input.firstName ?? null,
        input.name ?? null,
        existing.id,
      );
    }
    return { customer: findCustomerById(db, input.venueId, existing.id)!, created: false };
  }
  const id = newId("cus");
  db.prepare(
    "INSERT INTO customers (id, venue_id, email, first_name, name, locale, capture_source) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, input.venueId, input.email, input.firstName ?? null, input.name ?? null, input.locale ?? null, input.captureSource);
  return { customer: findCustomerById(db, input.venueId, id)!, created: true };
}

export function setConsent(db: DatabaseSync, customerId: string, state: ConsentState, ageAttested: boolean, token: string | null) {
  db.prepare(
    "UPDATE customers SET marketing_consent = ?, age_attested = ?, consent_token = ?, consent_updated_at = datetime('now') WHERE id = ?",
  ).run(state, ageAttested ? 1 : 0, token, customerId);
}

export function setBirthday(db: DatabaseSync, customerId: string, month: number, day: number) {
  db.prepare("UPDATE customers SET birthday_month = ?, birthday_day = ? WHERE id = ?").run(month, day, customerId);
}

export function recordBirthdaySkip(db: DatabaseSync, customerId: string) {
  db.prepare("UPDATE customers SET birthday_skips = birthday_skips + 1 WHERE id = ?").run(customerId);
}

export function recordVisit(db: DatabaseSync, venueId: string, customerId: string, type: string) {
  db.prepare("INSERT INTO visits (venue_id, customer_id, type) VALUES (?, ?, ?)").run(venueId, customerId, type);
}

import "server-only";
import type { z } from "zod";
import type { CaptureGuestResponse, birthdayRequest, captureGuestRequest, recordVisitRequest } from "@/lib/api/contracts";
import { isValidBirthday } from "@/lib/validation";
import { birthdayAskOn, wifiGateActive } from "@/lib/venue/features";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { findCustomerById, recordBirthdaySkip, recordVisit, setBirthday, upsertCustomer } from "../repositories/customers";
import { findVenue } from "../repositories/venues";
import { deliver, recordConsent } from "./consent";

/** The Wi-Fi gate's "just the Wi-Fi" path: a guest record, no loyalty card. */
export function captureGuest(input: z.output<typeof captureGuestRequest>, origin: string): CaptureGuestResponse {
  const venue = findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  if (!wifiGateActive(venue)) throw new ServiceError(403, "Guest capture is not enabled for this venue");

  const { customer, consent } = transaction((db) => {
    const { customer } = upsertCustomer(db, {
      venueId: venue.id,
      email: input.email,
      firstName: input.firstName ?? null,
      locale: input.locale ?? null,
      captureSource: input.source,
    });
    recordVisit(db, venue.id, customer.id, "wifi_tap");
    const consent = recordConsent(db, venue, customer, { marketingConsent: input.marketingConsent, ageAttested: input.ageAttested }, origin);
    return { customer, consent };
  });
  deliver(consent.mail);
  return { customerId: customer.id, confirmationPending: consent.confirmationPending };
}

export function recordGuestVisit(input: z.output<typeof recordVisitRequest>) {
  const db = getDb();
  if (!findCustomerById(db, input.venueId, input.customerId)) throw new ServiceError(404, "Unknown guest");
  recordVisit(db, input.venueId, input.customerId, input.type);
}

/**
 * Answers 200 even where the venue does not ask for birthdays, and writes
 * nothing there, so the response never reveals a venue's settings.
 */
export function updateBirthday(input: z.output<typeof birthdayRequest>) {
  const venue = findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const db = getDb();
  const customer = findCustomerById(db, venue.id, input.customerId);
  if (!customer) throw new ServiceError(404, "Unknown guest");
  if (!birthdayAskOn(venue)) return;
  if ("skipped" in input) {
    recordBirthdaySkip(db, customer.id);
    return;
  }
  if (!isValidBirthday(input.month, input.day)) throw new ServiceError(400, "Invalid date");
  setBirthday(db, customer.id, input.month, input.day);
}

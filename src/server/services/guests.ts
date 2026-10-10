import "server-only";
import type { z } from "zod";
import type { CaptureGuestResponse, WifiPasswordResponse, birthdayRequest, captureGuestRequest, recordVisitRequest, wifiPasswordRequest } from "@/lib/api/contracts";
import { isValidBirthday } from "@/lib/validation";
import { birthdayAskOn, wifiGateActive } from "@/lib/venue/features";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { findCustomerById, recordBirthdaySkip, recordVisit, setBirthday, upsertCustomer } from "../repositories/customers";
import { findVenue } from "../repositories/venues";
import { deliver, recordConsent } from "./consent";

/** The Wi-Fi email gate: a guest record (no loyalty card, no stamp), and their consent answer if asked. */
export async function captureGuest(input: z.output<typeof captureGuestRequest>, origin: string): Promise<CaptureGuestResponse> {
  const venue = await findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  if (!wifiGateActive(venue)) throw new ServiceError(403, "This venue doesn't ask for an email for its Wi-Fi");

  const { customer, consent } = await transaction(async (db) => {
    const { customer } = await upsertCustomer(db, {
      venueId: venue.id,
      email: input.email,
      firstName: input.firstName ?? null,
      locale: input.locale ?? null,
      captureSource: "wifi",
    });
    await recordVisit(db, venue.id, customer.id, "wifi_tap");
    const consent = await recordConsent(db, venue, customer, { marketingConsent: input.marketingConsent, ageAttested: input.ageAttested }, origin);
    return { customer, consent };
  });
  await deliver(consent.mail);
  return { customerId: customer.id, confirmationPending: consent.confirmationPending };
}

/** The gated Wi-Fi password, for a guest this venue has an email for. */
export async function wifiPassword(input: z.output<typeof wifiPasswordRequest>): Promise<WifiPasswordResponse> {
  const venue = await findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  if (!await findCustomerById(await getDb(), venue.id, input.customerId)) throw new ServiceError(404, "Unknown guest");
  return { password: venue.wifi?.password?.trim() || null };
}

export async function recordGuestVisit(input: z.output<typeof recordVisitRequest>) {
  const db = await getDb();
  if (!await findCustomerById(db, input.venueId, input.customerId)) throw new ServiceError(404, "Unknown guest");
  await recordVisit(db, input.venueId, input.customerId, input.type);
}

/**
 * Answers 200 even where the venue does not ask for birthdays, and writes
 * nothing there, so the response never reveals a venue's settings.
 */
export async function updateBirthday(input: z.output<typeof birthdayRequest>) {
  const venue = await findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const db = await getDb();
  const customer = await findCustomerById(db, venue.id, input.customerId);
  if (!customer) throw new ServiceError(404, "Unknown guest");
  if (!birthdayAskOn(venue)) return;
  if ("skipped" in input) {
    await recordBirthdaySkip(db, customer.id);
    return;
  }
  if (!isValidBirthday(input.month, input.day)) throw new ServiceError(400, "Invalid date");
  await setBirthday(db, customer.id, input.month, input.day);
}

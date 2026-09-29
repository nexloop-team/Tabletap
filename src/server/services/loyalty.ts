import "server-only";
import type { DatabaseSync } from "node:sqlite";
import type { z } from "zod";
import type { EnrollResponse, StampResponse, enrollRequest, stampRequest } from "@/lib/api/contracts";
import { isValidBirthday } from "@/lib/validation";
import { birthdayAskOn, hasLoyaltyProgram, isRewardsOnly } from "@/lib/venue/features";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { findCustomerByEmail, setBirthday, upsertCustomer } from "../repositories/customers";
import { addFeedbackStamp, createCard, findCardByCustomer, hoursSince, markPassEmailed, type LoyaltyCardRow } from "../repositories/loyalty-cards";
import { findVenue } from "../repositories/venues";
import { deliver, recordConsent } from "./consent";
import { sendMail } from "./mailer";
import { issueWalletPass } from "./wallet";

/** A returning member is re-sent their card at most this often. */
const PASS_RESEND_COOLDOWN_HOURS = 24 * 7;
/** One feedback stamp per member per day. */
const FEEDBACK_STAMP_COOLDOWN_HOURS = 24;

function requireVenue(venueId: string): PublicVenue {
  const venue = findVenue(venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  return venue;
}

function cardUrl(origin: string, card: LoyaltyCardRow) {
  return `${origin}/card/${card.id}?t=${card.access_token}`;
}

function sendCardEmail(venue: PublicVenue, email: string, card: LoyaltyCardRow, origin: string): boolean {
  return sendMail({
    to: email,
    subject: `Your ${venue.name} rewards card`,
    text: `Here's your ${venue.name} card. Keep this link handy and show it when you visit:\n${cardUrl(origin, card)}`,
  });
}

export function enroll(input: z.output<typeof enrollRequest>, origin: string): EnrollResponse {
  const venue = requireVenue(input.venueId);
  const rewardsOnly = isRewardsOnly(venue);
  if (!hasLoyaltyProgram(venue) && !rewardsOnly) throw new ServiceError(400, "This venue does not have a loyalty program");

  // The CRM doors each have their own switch; the home card is always open.
  if (input.door === "feedback" && !venue.crm.feedbackCapture) throw new ServiceError(403, "Joining is not available here");
  if (input.door === "wifi_gate" && !venue.crm.wifiCapture) throw new ServiceError(403, "Joining is not available here");

  const isRewardsJoin = input.captureSource === "rewards";
  // On a rewards join the button press is the consent; the age line gates it.
  const consentAnswer = isRewardsJoin
    ? { marketingConsent: !!input.joined, ageAttested: !!input.ageAttested }
    : input.marketingConsent === undefined
      ? null
      : { marketingConsent: input.marketingConsent, ageAttested: !!input.ageAttested };

  const result = transaction((db) => {
    const { customer } = upsertCustomer(db, {
      venueId: venue.id,
      email: input.email,
      firstName: input.firstName ?? null,
      name: input.name ?? input.firstName ?? null,
      locale: input.locale ?? null,
      captureSource: input.captureSource ?? "landing",
    });
    let card = findCardByCustomer(db, customer.id);
    const wasExisting = !!card;
    if (!card) {
      // Stamps are never granted on a rewards-only programme, whatever arrives.
      const stamps = rewardsOnly || isRewardsJoin ? 0 : (input.initialStamps ?? 0);
      card = createCard(db, venue.id, customer.id, stamps);
      if (input.captureSource === "feedback" && stamps > 0) addFeedbackStampCooldownOnly(db, card.id);
    }
    const consent = recordConsent(db, venue, customer, consentAnswer, origin);
    const consented = !!consentAnswer?.marketingConsent && !!consentAnswer.ageAttested;
    if (input.birthday && consented && birthdayAskOn(venue) && isValidBirthday(input.birthday.month, input.birthday.day)) {
      setBirthday(db, customer.id, input.birthday.month, input.birthday.day);
    }
    return { customer, card, wasExisting, consent };
  });

  const { customer, card, wasExisting, consent } = result;
  const shouldEmail = !wasExisting || hoursSince(card.last_pass_email_at) >= PASS_RESEND_COOLDOWN_HOURS;
  const passEmailed = shouldEmail && sendCardEmail(venue, customer.email, card, origin);
  if (passEmailed) markPassEmailed(getDb(), card.id);
  deliver(consent.mail);

  // A returning member's card is only ever re-sent by email: handing it to
  // whoever typed their address would hand over their card.
  const pass = wasExisting
    ? { passBase64: null, googleWalletUrl: null }
    : issueWalletPass({ cardId: card.id, venueName: venue.name, holderName: customer.first_name ?? customer.name, stamps: card.stamps });

  return {
    customerId: customer.id,
    cardId: card.id,
    wasExisting,
    passEmailed,
    passBase64: pass.passBase64,
    googleWalletUrl: pass.googleWalletUrl,
    cardUrl: wasExisting ? null : cardUrl(origin, card),
    confirmationPending: consent.confirmationPending,
  };
}

/** The join already granted the feedback stamp; start the cooldown without adding another. */
function addFeedbackStampCooldownOnly(db: DatabaseSync, cardId: string) {
  db.prepare("UPDATE loyalty_cards SET last_feedback_stamp_at = datetime('now') WHERE id = ?").run(cardId);
}

/**
 * Stamps an existing member for leaving feedback. Every refusal (not a
 * member, cooldown) answers the same `stamped: false`, so the endpoint cannot
 * be used to test whether an address is a member.
 */
export function stampForFeedback(input: z.output<typeof stampRequest>): StampResponse {
  const venue = requireVenue(input.venueId);
  if (!hasLoyaltyProgram(venue)) throw new ServiceError(400, "This venue does not have a stamp card");
  return transaction((db) => {
    const customer = findCustomerByEmail(db, venue.id, input.email);
    const card = customer ? findCardByCustomer(db, customer.id) : null;
    if (!card) return { stamped: false, currentStamps: 0 };
    if (hoursSince(card.last_feedback_stamp_at) < FEEDBACK_STAMP_COOLDOWN_HOURS) {
      return { stamped: false, currentStamps: card.stamps };
    }
    return { stamped: true, currentStamps: addFeedbackStamp(db, card.id) };
  });
}

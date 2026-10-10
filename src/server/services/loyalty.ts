import "server-only";
import type { Db } from "../db";
import type { z } from "zod";
import type { EnrollResponse, StampResponse, enrollRequest, stampRequest } from "@/lib/api/contracts";
import { isValidBirthday } from "@/lib/validation";
import { birthdayAskOn, hasLoyaltyProgram, isRewardsOnly } from "@/lib/venue/features";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { findCustomerByEmail, setBirthday, upsertCustomer } from "../repositories/customers";
import { claimFeedbackStamp } from "../repositories/feedback";
import { addFeedbackStamp, createCard, findCardByCustomer, hoursSince, lockCard, markPassEmailed, setCardStamps, type LoyaltyCardRow } from "../repositories/loyalty-cards";
import { attachReferral, findReferrerCard } from "../repositories/retention";
import { recordStampEvent } from "../repositories/stamps";
import { friendJoinBonus } from "./retention";
import { findVenue, getVenueSettings } from "../repositories/venues";
import { deliver, recordConsent } from "./consent";
import { sendMail } from "./mailer";
import { issueWalletPass } from "./wallet";

/**
 * A returning member is emailed their card link again (never shown it on the
 * page, since anyone can type an email), at most this often.
 */
const PASS_RESEND_COOLDOWN_HOURS = 1;
/** One feedback stamp per member per day. */
const FEEDBACK_STAMP_COOLDOWN_HOURS = 24;

async function requireVenue(venueId: string): Promise<PublicVenue> {
  const venue = await findVenue(venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  return venue;
}

function cardUrl(origin: string, card: LoyaltyCardRow) {
  return `${origin}/card/${card.id}?t=${card.access_token}`;
}

async function sendCardEmail(venue: PublicVenue, email: string, card: LoyaltyCardRow, origin: string): Promise<boolean> {
  return await sendMail({
    to: email,
    subject: `Your ${venue.name} rewards card`,
    text: `Here's your ${venue.name} card. Keep this link handy and show it when you visit:\n${cardUrl(origin, card)}`,
  });
}

export async function enroll(input: z.output<typeof enrollRequest>, origin: string): Promise<EnrollResponse> {
  const venue = await requireVenue(input.venueId);
  const rewardsOnly = isRewardsOnly(venue);
  if (!hasLoyaltyProgram(venue) && !rewardsOnly) throw new ServiceError(400, "This venue does not have a loyalty program");

  // The CRM doors each have their own switch; the home card is always open.
  if (input.door === "feedback" && !venue.crm.feedbackCapture) throw new ServiceError(403, "Joining is not available here");

  const isRewardsJoin = input.captureSource === "rewards";
  // On a rewards join the button press is the consent; the age line gates it.
  const consentAnswer = isRewardsJoin
    ? { marketingConsent: !!input.joined, ageAttested: !!input.ageAttested }
    : input.marketingConsent === undefined
      ? null
      : { marketingConsent: input.marketingConsent, ageAttested: !!input.ageAttested };

  const feedbackStampOn = (await getVenueSettings(venue.id)).stampPolicy.feedbackStamp;

  const result = await transaction(async (db) => {
    const { customer } = await upsertCustomer(db, {
      venueId: venue.id,
      email: input.email,
      firstName: input.firstName ?? null,
      name: input.name ?? input.firstName ?? null,
      locale: input.locale ?? null,
      captureSource: input.captureSource ?? "landing",
    });
    let card = await findCardByCustomer(db, customer.id);
    const wasExisting = !!card;
    if (!card) {
      // The join stamp is the server's call: only a receipt for feedback just
      // posted earns it. Never on rewards-only.
      let stamps = 0;
      if (!rewardsOnly && !isRewardsJoin && input.initialStamps === 1 && input.captureSource === "feedback" && feedbackStampOn && input.feedbackReceipt) {
        stamps = (await claimFeedbackStamp(db, venue.id, input.feedbackReceipt.feedbackId, input.feedbackReceipt.token)) ? 1 : 0;
      }
      card = await createCard(db, venue.id, customer.id, stamps);
      if (input.captureSource === "feedback" && stamps > 0) await addFeedbackStampCooldownOnly(db, card.id);
      // Joined through a member's invite: link the cards (the inviter is
      // rewarded at the friend's first staff stamp) and add welcome stamps.
      const referrer = input.ref && !rewardsOnly && !isRewardsJoin ? await findReferrerCard(db, venue.id, input.ref) : null;
      if (referrer && referrer.customer_id !== customer.id && venue.loyaltyProgram?.referral?.enabled) {
        await attachReferral(db, card.id, referrer.id);
        const bonus = friendJoinBonus(venue, card.stamps);
        if (bonus > 0) {
          await setCardStamps(db, card.id, card.stamps + bonus);
          await recordStampEvent(db, { venueId: venue.id, cardId: card.id, kind: "bonus", delta: bonus });
        }
        card = (await findCardByCustomer(db, customer.id))!;
      }
    }
    const consent = await recordConsent(db, venue, customer, consentAnswer, origin);
    const consented = !!consentAnswer?.marketingConsent && !!consentAnswer.ageAttested;
    if (input.birthday && consented && birthdayAskOn(venue) && isValidBirthday(input.birthday.month, input.birthday.day)) {
      await setBirthday(db, customer.id, input.birthday.month, input.birthday.day);
    }
    return { customer, card, wasExisting, consent };
  });

  const { customer, card, wasExisting, consent } = result;
  const shouldEmail = !wasExisting || hoursSince(card.last_pass_email_at) >= PASS_RESEND_COOLDOWN_HOURS;
  const passEmailed = shouldEmail && await sendCardEmail(venue, customer.email, card, origin);
  if (passEmailed) await markPassEmailed(await getDb(), card.id);
  await deliver(consent.mail);

  // A returning member is sent their card again by email rather than shown
  // it here: an email address is no proof of who's typing it, and the card's
  // QR code is what staff scan to hand out a reward. The till can still find
  // them by name or email. Wallet passes are only minted on first join.
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
async function addFeedbackStampCooldownOnly(db: Db, cardId: string) {
  (await db.run("UPDATE loyalty_cards SET last_feedback_stamp_at = now() WHERE id = ?", cardId));
}

/**
 * Stamps an existing member for the feedback they just posted: it needs that
 * feedback's one-time receipt, and gives at most one stamp a day. Every
 * refusal (not a member, cooldown, used receipt) answers the same
 * `stamped: false` without the balance, so the endpoint cannot be used to
 * test whether an address is a member.
 */
export async function stampForFeedback(input: z.output<typeof stampRequest>): Promise<StampResponse> {
  const venue = await requireVenue(input.venueId);
  if (!hasLoyaltyProgram(venue)) throw new ServiceError(400, "This venue does not have a stamp card");
  const refused = { stamped: false, currentStamps: 0 };
  if (!(await getVenueSettings(venue.id)).stampPolicy.feedbackStamp) return refused;
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  return await transaction(async (db) => {
    const customer = await findCustomerByEmail(db, venue.id, input.email);
    const found = customer ? await findCardByCustomer(db, customer.id) : null;
    const card = found ? await lockCard(db, found.id) : null;
    if (!card || hoursSince(card.last_feedback_stamp_at) < FEEDBACK_STAMP_COOLDOWN_HOURS) return refused;
    if (!(await claimFeedbackStamp(db, venue.id, input.feedbackReceipt.feedbackId, input.feedbackReceipt.token))) return refused;
    return { stamped: true, currentStamps: await addFeedbackStamp(db, card.id, goal) };
  });
}

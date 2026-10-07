import "server-only";
import { BRAND } from "@/config/brand";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { localDate } from "../jobs/time";
import { appOrigin } from "../origin";
import { findCardById, setCardStamps } from "../repositories/loyalty-cards";
import { claimGuestEmail, claimReferralReward, referralRewardsInLast, releaseGuestEmail } from "../repositories/retention";
import { recordStampEvent } from "../repositories/stamps";
import { venueHasAccess } from "../repositories/subscriptions";
import { getVenueSettings } from "../repositories/venues";
import { sendMail } from "./mailer";

/** Referral rewards a member can earn in any 30 days, so invites can't be farmed. */
export const MAX_REFERRAL_REWARDS_PER_MONTH = 5;

/**
 * Things that follow a staff stamp: the "reward ready" email and referral
 * rewards. Runs after the stamp is committed; a failure here is logged and
 * never undoes the stamp.
 */
export function onStaffStamp(event: { venue: PublicVenue; cardId: string; before: number; after: number }) {
  try {
    sendRewardReadyEmail(event.venue, event.cardId, event.before, event.after);
  } catch (error) {
    console.error("[retention] reward-ready email failed", error);
  }
  try {
    rewardReferrer(event.venue, event.cardId);
  } catch (error) {
    console.error("[retention] referral reward failed", error);
  }
}

/**
 * Service email (no marketing consent needed) when a stamp takes the card
 * past a reward. At most once per reward per card per day.
 */
export function sendRewardReadyEmail(venue: PublicVenue, cardId: string, before: number, after: number): boolean {
  if (!venueHasAccess(venue.id) || !getVenueSettings(venue.id).automations.rewardReady) return false;
  const unlocked = programTiers(venue.loyaltyProgram).filter((tier) => before < tier.stampsRequired && after >= tier.stampsRequired);
  const tier = unlocked[unlocked.length - 1];
  if (!tier) return false;
  const card = findCardById(getDb(), cardId);
  if (!card) return false;
  const guest = getDb().prepare("SELECT id, email, first_name FROM customers WHERE id = ?").get(card.customer_id) as
    | { id: string; email: string; first_name: string | null }
    | undefined;
  if (!guest) return false;
  const key = `${card.id}:${tier.stampsRequired}:${localDate(new Date())}`;
  if (!claimGuestEmail(guest.id, "reward_ready", key)) return false;
  const sent = sendMail({
    to: guest.email,
    subject: `Your ${tier.rewardName} is ready at ${venue.name}`,
    text: [
      `Hi ${guest.first_name || "there"},`,
      "",
      `You've collected ${after} stamp${after === 1 ? "" : "s"} at ${venue.name}: that's a ${tier.rewardName}!`,
      "Show your card at the counter next time you're in to claim it:",
      `${appOrigin()}/card/${card.id}?t=${card.access_token}`,
      "",
      `${venue.name} · via ${BRAND.name}`,
    ].join("\n"),
  });
  if (!sent) releaseGuestEmail(guest.id, "reward_ready", key);
  return sent;
}

/**
 * The friend's first staff stamp proves a real visit, so that's when the
 * member who invited them gets their stamps. Checked once per friend card.
 */
export function rewardReferrer(venue: PublicVenue, friendCardId: string) {
  const referral = venue.loyaltyProgram?.referral;
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  const result = transaction((db) => {
    const referrerId = claimReferralReward(db, friendCardId);
    if (!referrerId || !referral?.enabled || goal === 0) return null;
    const referrer = findCardById(db, referrerId);
    if (!referrer || referrer.venue_id !== venue.id) return null;
    if (referralRewardsInLast(db, referrer.id, 30) >= MAX_REFERRAL_REWARDS_PER_MONTH) return null;
    const next = Math.min(referrer.stamps + referral.referrerStamps, goal);
    if (next === referrer.stamps) return null;
    setCardStamps(db, referrer.id, next);
    recordStampEvent(db, { venueId: venue.id, cardId: referrer.id, kind: "referral", delta: next - referrer.stamps });
    return { referrerId: referrer.id, before: referrer.stamps, after: next };
  });
  if (result) sendRewardReadyEmail(venue, result.referrerId, result.before, result.after);
}

/** Welcome stamps for a friend who joined through an invite, on top of any join bonus. */
export function friendJoinBonus(venue: PublicVenue, currentStamps: number): number {
  const referral = venue.loyaltyProgram?.referral;
  if (!referral?.enabled) return 0;
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  return Math.max(0, Math.min(currentStamps + referral.friendStamps, goal) - currentStamps);
}

import type { LoyaltyProgram, RewardTier } from "./types";

/**
 * The reward ladder of a stamp card, cheapest first. A programme without
 * tiers is a ladder of one: its main reward.
 */
export function programTiers(program: LoyaltyProgram | null | undefined): RewardTier[] {
  if (!program || program.stampsEnabled === false) return [];
  const tiers = program.rewardTiers?.length ? program.rewardTiers : [{ rewardName: program.rewardName, stampsRequired: program.stampsRequired }];
  return [...tiers].filter((tier) => tier.stampsRequired > 0 && tier.rewardName).sort((a, b) => a.stampsRequired - b.stampsRequired);
}

/** Stamps needed for the top reward; a card never holds more than this. */
export function stampGoal(tiers: RewardTier[]): number {
  return tiers.length ? tiers[tiers.length - 1].stampsRequired : 0;
}

/** Rewards this many stamps can pay for right now. */
export function unlockedTiers(tiers: RewardTier[], stamps: number): RewardTier[] {
  return tiers.filter((tier) => stamps >= tier.stampsRequired);
}

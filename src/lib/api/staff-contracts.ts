import { z } from "zod";

/** Requests from a paired staff device, and the owner's device management. */

const cardId = z.string().trim().regex(/^crd_[A-Za-z0-9]{1,40}$/, "Invalid card");

export const staffStampRequest = z.object({
  cardId,
  count: z.number().int().min(1).max(5).default(1),
  /** Staff confirmed "add another" inside the cooldown. */
  force: z.boolean().optional(),
});
export type StaffStampRequest = z.input<typeof staffStampRequest>;

export const staffRedeemRequest = z.object({ cardId, tierIndex: z.number().int().min(0).max(10) });
export type StaffRedeemRequest = z.input<typeof staffRedeemRequest>;

export const staffUndoRequest = z.object({ cardId });
export type StaffUndoRequest = z.input<typeof staffUndoRequest>;

/** What the till screen shows for one card. */
export interface StaffCardView {
  cardId: string;
  venueName: string;
  guestName: string | null;
  /** Masked, enough to confirm it's the right person. */
  guestEmail: string;
  stamps: number;
  goal: number;
  tiers: { index: number; rewardName: string; stampsRequired: number; unlocked: boolean }[];
  /** The last stamp or redemption, if it can still be undone. */
  undoable: { kind: string; delta: number; rewardName: string | null } | null;
}

export const inviteStaffRequest = z.object({ email: z.string().trim().min(1, "Enter the staff member's email address").max(200) });
export type InviteStaffRequest = z.input<typeof inviteStaffRequest>;

export const addStaffDeviceRequest = z.object({ label: z.string().trim().min(1, "Name the device, e.g. “Front till”").max(40) });
export type AddStaffDeviceRequest = z.input<typeof addStaffDeviceRequest>;

import { z } from "zod";

/**
 * Request/response contracts for the customer-facing API. Route handlers
 * validate with these schemas; the browser client imports only the types.
 */

const venueId = z.string().trim().min(1).max(128);
const email = z.string().trim().toLowerCase().min(3).max(254);
const firstName = z.string().trim().max(80).optional();
const locale = z.string().trim().max(35).optional();
const birthday = z.object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) });

/** Proof that feedback was just posted: the one thing that earns a feedback stamp. */
const feedbackReceipt = z.object({ feedbackId: z.string().trim().min(1).max(64), token: z.string().trim().min(10).max(100) });

/** Where a join happened; also selects which CRM switch governs it. */
export const joinDoor = z.enum(["home", "feedback"]);

export const enrollRequest = z.object({
  venueId,
  email,
  name: z.string().trim().max(120).optional(),
  firstName,
  /**
   * Only 0 or 1: joining after feedback grants one stamp. The server decides
   * whether it's earned (a receipt for that feedback), whatever is asked for.
   */
  initialStamps: z.number().int().min(0).max(1).optional(),
  feedbackReceipt: feedbackReceipt.optional(),
  captureSource: z.enum(["landing", "feedback", "rewards"]).optional(),
  /** Rewards-only join: the button press itself is the membership consent. */
  joined: z.boolean().optional(),
  door: joinDoor.optional(),
  marketingConsent: z.boolean().optional(),
  ageAttested: z.boolean().optional(),
  birthday: birthday.optional(),
  locale,
  /** Invite code from a member's "Invite a friend" link. */
  ref: z.string().trim().regex(/^[a-z0-9]{6,16}$/i).optional(),
});
export type EnrollRequest = z.input<typeof enrollRequest>;

export interface EnrollResponse {
  customerId: string;
  cardId: string;
  wasExisting: boolean;
  /** False when a returning member re-joined inside the resend cooldown. */
  passEmailed: boolean;
  /** Web version of the card, only to new members; a returning member is emailed it instead. */
  cardUrl: string | null;
  /** The server asked for a double-opt-in confirmation. */
  confirmationPending: boolean;
}

export const stampRequest = z.object({ venueId, email, feedbackReceipt });
export type StampRequest = z.input<typeof stampRequest>;
export interface StampResponse {
  stamped: boolean;
  currentStamps: number;
}

export const feedbackRequest = z.object({
  venueId,
  text: z.string().trim().min(1).max(5000),
  /** The `s` param from the QR code: which table / poster was scanned. */
  source: z.string().trim().max(64).optional(),
  /** JPEG, base64 without the data: prefix, already downscaled client-side. */
  imageBase64: z.string().max(4_000_000).optional(),
});
export type FeedbackRequest = z.input<typeof feedbackRequest>;
export interface FeedbackResponse {
  id: string;
  /** -1 (negative) to 1 (positive), computed server-side. */
  sentimentScore: number;
  /** Claims this feedback's stamp (once, within the hour); null when the venue gives none. */
  stampReceipt: { feedbackId: string; token: string } | null;
}

/** The Wi-Fi email gate (when the owner has it on): an email, and the consent line's answer if it was shown. */
export const captureGuestRequest = z.object({
  venueId,
  email,
  firstName,
  marketingConsent: z.boolean(),
  ageAttested: z.boolean(),
  locale,
});
export type CaptureGuestRequest = z.input<typeof captureGuestRequest>;
export interface CaptureGuestResponse {
  customerId: string;
  confirmationPending: boolean;
}

/** A guest past the Wi-Fi email gate (this device knows their guest id) asks for the password. */
export const wifiPasswordRequest = z.object({ venueId, customerId: z.string().trim().min(1).max(128) });
export type WifiPasswordRequest = z.input<typeof wifiPasswordRequest>;
export interface WifiPasswordResponse {
  password: string | null;
}

export const recordVisitRequest = z.object({
  venueId,
  customerId: z.string().trim().min(1).max(128),
  type: z.enum(["wifi_tap"]),
});
export type RecordVisitRequest = z.input<typeof recordVisitRequest>;

export const birthdayRequest = z.union([
  z.object({ venueId, customerId: z.string().min(1).max(128), month: z.number().int(), day: z.number().int() }),
  z.object({ venueId, customerId: z.string().min(1).max(128), skipped: z.literal(true) }),
]);
export type BirthdayRequest = z.input<typeof birthdayRequest>;

export const analyticsEvent = z.object({
  name: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/),
  params: z
    .record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean(), z.null()]))
    .refine((params) => Object.keys(params).length <= 20, "Too many parameters")
    .optional(),
});
export type AnalyticsEvent = z.input<typeof analyticsEvent>;

/** A member's card, for the holder of its private link. */
export interface MemberCardView {
  cardId: string;
  venueId: string;
  venueName: string;
  holder: string | null;
  memberSince: string;
  stamps: number;
  /** Stamps for the top reward; 0 for a members club without stamps. */
  goal: number;
  tiers: { rewardName: string; stampsRequired: number; unlocked: boolean }[];
  /** The code staff scan; null when the venue has no stamp card. */
  staffQrSvg: string | null;
  invite: { url: string; referrerStamps: number; friendStamps: number } | null;
}

export interface ApiError {
  error: string;
}

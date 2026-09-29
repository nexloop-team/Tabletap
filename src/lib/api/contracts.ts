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

/** Where a join happened; also selects which CRM switch governs it. */
export const joinDoor = z.enum(["home", "feedback", "wifi_gate"]);

export const enrollRequest = z.object({
  venueId,
  email,
  name: z.string().trim().max(120).optional(),
  firstName,
  /** Only 0 or 1: the Wi-Fi offer and the feedback join grant one stamp. */
  initialStamps: z.number().int().min(0).max(1).optional(),
  captureSource: z.enum(["landing", "feedback", "wifi", "rewards"]).optional(),
  /** Rewards-only join: the button press itself is the membership consent. */
  joined: z.boolean().optional(),
  door: joinDoor.optional(),
  marketingConsent: z.boolean().optional(),
  ageAttested: z.boolean().optional(),
  birthday: birthday.optional(),
  locale,
});
export type EnrollRequest = z.input<typeof enrollRequest>;

export interface EnrollResponse {
  customerId: string;
  cardId: string;
  wasExisting: boolean;
  /** False when a returning member re-joined inside the resend cooldown. */
  passEmailed: boolean;
  /** Signed .pkpass (base64) — only when Apple Wallet signing is configured. */
  passBase64: string | null;
  /** Google Wallet save link — only when a Google issuer is configured. */
  googleWalletUrl: string | null;
  /** Web version of the card; always available, and only to new members. */
  cardUrl: string | null;
  /** The server asked for a double-opt-in confirmation. */
  confirmationPending: boolean;
}

export const stampRequest = z.object({ venueId, email });
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
}

export const captureGuestRequest = z.object({
  venueId,
  email,
  firstName,
  marketingConsent: z.boolean(),
  ageAttested: z.boolean(),
  source: z.enum(["wifi"]),
  locale,
});
export type CaptureGuestRequest = z.input<typeof captureGuestRequest>;
export interface CaptureGuestResponse {
  customerId: string;
  confirmationPending: boolean;
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
  name: z.string().trim().min(1).max(64),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
export type AnalyticsEvent = z.input<typeof analyticsEvent>;

export interface ApiError {
  error: string;
}

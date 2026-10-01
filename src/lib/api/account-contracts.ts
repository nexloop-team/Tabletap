import { z } from "zod";
import { shortCodeSchema, venueConfigPatch } from "../venue/schema";

/** Request contracts for merchant accounts and the dashboard API. */

const email = z.string().trim().toLowerCase().min(3).max(254).email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters").max(200, "That password is too long");
const name = z.string().trim().min(1, "Tell us your name").max(80);

export const signupRequest = z.object({ name, email, password });
export type SignupRequest = z.input<typeof signupRequest>;

export const loginRequest = z.object({ email, password: z.string().min(1, "Enter your password").max(200) });
export type LoginRequest = z.input<typeof loginRequest>;

export const forgotPasswordRequest = z.object({ email });
export type ForgotPasswordRequest = z.input<typeof forgotPasswordRequest>;

export const resetPasswordRequest = z.object({ token: z.string().min(10).max(200), password });
export type ResetPasswordRequest = z.input<typeof resetPasswordRequest>;

export const updateAccountRequest = z.object({ name });
export type UpdateAccountRequest = z.input<typeof updateAccountRequest>;

export const changePasswordRequest = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });
export type ChangePasswordRequest = z.input<typeof changePasswordRequest>;

export const deleteAccountRequest = z.object({ password: z.string().min(1, "Enter your password").max(200) });
export type DeleteAccountRequest = z.input<typeof deleteAccountRequest>;

export const updateVenueRequest = z.object({ config: venueConfigPatch.optional(), shortCode: shortCodeSchema.optional() });
export type UpdateVenueRequest = z.input<typeof updateVenueRequest>;

export const deleteVenueRequest = z.object({ confirmName: z.string().max(200) });
export type DeleteVenueRequest = z.input<typeof deleteVenueRequest>;

export const adminVenueRequest = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  plan: z.enum(["free", "pro"]).optional(),
});
export type AdminVenueRequest = z.input<typeof adminVenueRequest>;

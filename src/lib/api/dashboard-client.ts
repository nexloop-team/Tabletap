import type {
  AdminVenueRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  ExplainDishesRequest,
  ForgotPasswordRequest,
  LoginRequest,
  NotificationPrefsRequest,
  ResetPasswordRequest,
  SignupRequest,
  UpdateAccountRequest,
  UpdateVenueRequest,
} from "./account-contracts";
import { ApiRequestError } from "./client";
import type { AddStaffDeviceRequest, StaffCardView, StaffRedeemRequest, StaffStampRequest, StaffUndoRequest } from "./staff-contracts";
import type { CreateVenueRequest, VenueConfig } from "../venue/schema";

type MenuSectionDraft = VenueConfig["menus"][number]["sections"][number];
import type { VenueSettings, VenueSettingsPatch } from "../venue/settings";

/** Browser client for the merchant side: auth, account, dashboard and admin APIs. */

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new ApiRequestError(0, "Couldn't reach the server. Check your connection and try again.");
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new ApiRequestError(response.status, data?.error ?? `Request failed (${response.status})`);
  return data as T;
}

export interface SavedVenue {
  id: string;
  shortCode: string;
  config: UpdateVenueRequest["config"];
}

export const dashboardApi = {
  signup: (body: SignupRequest) => send<{ ok: true }>("POST", "/api/auth/signup", body),
  login: (body: LoginRequest) => send<{ ok: true }>("POST", "/api/auth/login", body),
  logout: () => send<{ ok: true }>("POST", "/api/auth/logout"),
  forgotPassword: (body: ForgotPasswordRequest) => send<{ ok: true }>("POST", "/api/auth/forgot", body),
  resetPassword: (body: ResetPasswordRequest) => send<{ ok: true }>("POST", "/api/auth/reset", body),
  resendVerification: () => send<{ ok: true }>("POST", "/api/auth/resend-verification"),

  updateAccount: (body: UpdateAccountRequest) => send<{ ok: true }>("PATCH", "/api/account", body),
  changePassword: (body: ChangePasswordRequest) => send<{ ok: true }>("POST", "/api/account/password", body),
  deleteAccount: (body: DeleteAccountRequest) => send<{ ok: true }>("DELETE", "/api/account", body),
  setNotifications: (body: NotificationPrefsRequest) => send<{ ok: true }>("PATCH", "/api/account/notifications", body),

  createVenue: (body: CreateVenueRequest) => send<{ id: string; shortCode: string }>("POST", "/api/dashboard/venues", body),
  updateVenue: (venueId: string, body: UpdateVenueRequest) => send<SavedVenue>("PATCH", `/api/dashboard/venues/${venueId}`, body),
  /** Back to how the page was before the last save (twice = redo). */
  restoreVenue: (venueId: string) => send<SavedVenue>("POST", `/api/dashboard/venues/${venueId}/restore`),
  deleteVenue: (venueId: string, confirmName: string) => send<{ ok: true }>("DELETE", `/api/dashboard/venues/${venueId}`, { confirmName }),
  checkout: (venueId: string) => send<{ url: string }>("POST", `/api/dashboard/venues/${venueId}/billing/checkout`),
  billingPortal: (venueId: string) => send<{ url: string }>("POST", `/api/dashboard/venues/${venueId}/billing/portal`),

  async uploadImage(venueId: string, file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/dashboard/venues/${venueId}/media`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) }).catch(() => {
      throw new ApiRequestError(0, "Upload failed. Check your connection and try again.");
    });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url) throw new ApiRequestError(response.status, data?.error ?? "Upload failed");
    return data.url;
  },

  adminUpdateVenue: (venueId: string, body: AdminVenueRequest) => send<{ ok: true }>("PATCH", `/api/admin/venues/${venueId}`, body),

  addStaffDevice: (venueId: string, body: AddStaffDeviceRequest) =>
    send<{ url: string; qrSvg: string; expiresAt: string }>("POST", `/api/dashboard/venues/${venueId}/staff-devices`, body),
  revokeStaffDevice: (venueId: string, deviceId: string) => send<{ ok: true }>("DELETE", `/api/dashboard/venues/${venueId}/staff-devices/${encodeURIComponent(deviceId)}`),
  explainDishes: (venueId: string, body: ExplainDishesRequest) =>
    send<{ suggestions: { itemId: string; explainer: string }[] }>("POST", `/api/dashboard/venues/${venueId}/ai/explain`, body),

  async importMenu(venueId: string, files: File[]): Promise<{ sections: MenuSectionDraft[]; flaggedItemIds: string[] }> {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    // Reading a long menu can take a minute or two.
    const response = await fetch(`/api/dashboard/venues/${venueId}/ai/menu-import`, { method: "POST", body: form, signal: AbortSignal.timeout(240_000) }).catch(() => {
      throw new ApiRequestError(0, "The import didn't finish. Check your connection and try again.");
    });
    const data = (await response.json().catch(() => null)) as { sections?: MenuSectionDraft[]; flaggedItemIds?: string[]; error?: string } | null;
    if (!response.ok || !data?.sections) throw new ApiRequestError(response.status, data?.error ?? "Import failed");
    return { sections: data.sections, flaggedItemIds: data.flaggedItemIds ?? [] };
  },

  updateSettings: (venueId: string, body: VenueSettingsPatch) => send<VenueSettings>("PATCH", `/api/dashboard/venues/${venueId}/settings`, body),
  staffStamp: (body: StaffStampRequest) => send<StaffCardView>("POST", "/api/staff/stamp", body),
  staffRedeem: (body: StaffRedeemRequest) => send<StaffCardView>("POST", "/api/staff/redeem", body),
  staffUndo: (body: StaffUndoRequest) => send<StaffCardView>("POST", "/api/staff/undo", body),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

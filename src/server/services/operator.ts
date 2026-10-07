import "server-only";
import type { z } from "zod";
import type { adminUserRequest, adminVenueRequest } from "@/lib/api/account-contracts";
import { destroyAllSessions, isAdmin, isSuperAdmin } from "../auth/session";
import { ServiceError } from "../http";
import { logAdminAction } from "../repositories/admin-actions";
import { extendTrial, getSubscription, updateSubscription } from "../repositories/subscriptions";
import { findUserById, setUserBlocked, type User } from "../repositories/users";
import { getVenueRecord, setVenueStatus } from "../repositories/venues";
import { removeAccount, sendPasswordResetEmail, sendVerificationEmail } from "./accounts";

/**
 * Everything an operator can change from the admin console. Each change is
 * written to `admin_actions` with who did it, so support work can be traced.
 */

export function updateVenueAsAdmin(admin: User, venueId: string, input: z.output<typeof adminVenueRequest>) {
  const venue = getVenueRecord(venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const target = { type: "venue" as const, id: venueId, label: venue.config.name };
  if (input.freeAccess !== undefined) {
    const sub = getSubscription(venueId);
    if (sub?.provider === "razorpay" && sub.paid && sub.status !== "canceled") {
      throw new ServiceError(409, "This venue pays through Razorpay. Cancel it in the Razorpay dashboard first.");
    }
    updateSubscription(
      venueId,
      input.freeAccess
        ? { paid: true, status: "active", provider: "manual", currentPeriodEnd: null, cancelAtPeriodEnd: false }
        : { paid: false, status: "canceled", currentPeriodEnd: null, cancelAtPeriodEnd: false },
    );
    logAdminAction(admin, input.freeAccess ? "Gave free access" : "Removed free access", target);
  }
  if (input.extendTrialDays) {
    extendTrial(venueId, input.extendTrialDays);
    logAdminAction(admin, "Extended trial", target, `+${input.extendTrialDays} days`);
  }
  if (input.status && input.status !== venue.status) {
    setVenueStatus(venueId, input.status);
    logAdminAction(admin, input.status === "suspended" ? "Suspended venue" : "Restored venue", target);
  }
}

function accountTarget(user: User) {
  return { type: "user" as const, id: user.id, label: user.email };
}

/** Operators can't lock themselves or another operator out; super admins (ADMIN_EMAILS) are changed in the environment only. */
function assertCanLockOut(admin: User, user: User) {
  if (user.id === admin.id) throw new ServiceError(400, "You can't do that to your own account");
  if (isSuperAdmin(user)) throw new ServiceError(403, "This account is a super admin (ADMIN_EMAILS). Remove it there first.");
  if (isAdmin(user) && !isSuperAdmin(admin)) throw new ServiceError(403, "Only a super admin can do that to another admin");
}

export function updateUserAsAdmin(admin: User, userId: string, input: z.output<typeof adminUserRequest>, origin: string) {
  const user = findUserById(userId);
  if (!user) throw new ServiceError(404, "Account not found");
  const target = accountTarget(user);
  switch (input.action) {
    case "resend_verification":
      if (user.emailVerified) throw new ServiceError(400, "That email is already confirmed");
      sendVerificationEmail(user, origin);
      logAdminAction(admin, "Resent verification email", target);
      return;
    case "send_reset":
      if (user.blocked) throw new ServiceError(400, "Unblock the account first");
      sendPasswordResetEmail(user, origin);
      logAdminAction(admin, "Sent password reset link", target);
      return;
    case "block":
      assertCanLockOut(admin, user);
      setUserBlocked(user.id, true);
      destroyAllSessions(user.id);
      logAdminAction(admin, "Blocked account", target);
      return;
    case "unblock":
      setUserBlocked(user.id, false);
      logAdminAction(admin, "Unblocked account", target);
      return;
  }
}

/** Deletes the account and the venues it alone owns. The operator types the email to confirm. */
export async function deleteUserAsAdmin(admin: User, userId: string, confirmEmail: string) {
  const user = findUserById(userId);
  if (!user) throw new ServiceError(404, "Account not found");
  assertCanLockOut(admin, user);
  if (confirmEmail.trim().toLowerCase() !== user.email) throw new ServiceError(400, "Type the account's email exactly to confirm");
  const venues = await removeAccount(user.id);
  logAdminAction(admin, "Deleted account", accountTarget(user), venues ? `and ${venues} venue${venues === 1 ? "" : "s"}` : null);
}

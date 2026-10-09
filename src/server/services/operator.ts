import "server-only";
import type { z } from "zod";
import type { adminUserRequest, adminVenueRequest } from "@/lib/api/account-contracts";
import { destroyAllSessions, isAdmin, isSuperAdmin } from "../auth/session";
import { ServiceError } from "../http";
import { EDIT_GRANT_MINUTES, endEditGrant, logAdminAction, startEditGrant } from "../repositories/admin-actions";
import { extendTrial, getSubscription, updateSubscription } from "../repositories/subscriptions";
import { findUserById, setAdminRole, setUserBlocked, type User } from "../repositories/users";
import { getVenueRecord, setVenueStatus } from "../repositories/venues";
import { removeAccount, sendPasswordResetEmail, sendVerificationEmail } from "./accounts";

/**
 * Everything an operator can change from the admin console. Each change is
 * written to `admin_actions` with who did it, so support work can be traced.
 */

export async function updateVenueAsAdmin(admin: User, venueId: string, input: z.output<typeof adminVenueRequest>) {
  const venue = await getVenueRecord(venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const target = { type: "venue" as const, id: venueId, label: venue.config.name };
  if (input.freeAccess !== undefined) {
    const sub = await getSubscription(venueId);
    if (sub?.provider === "razorpay" && sub.paid && sub.status !== "canceled") {
      throw new ServiceError(409, "This venue pays through Razorpay. Cancel it in the Razorpay dashboard first.");
    }
    await updateSubscription(
      venueId,
      input.freeAccess
        ? { paid: true, status: "active", provider: "manual", currentPeriodEnd: null, cancelAtPeriodEnd: false }
        : { paid: false, status: "canceled", currentPeriodEnd: null, cancelAtPeriodEnd: false },
    );
    await logAdminAction(admin, input.freeAccess ? "Gave free access" : "Removed free access", target);
  }
  if (input.extendTrialDays) {
    await extendTrial(venueId, input.extendTrialDays);
    await logAdminAction(admin, "Extended trial", target, `+${input.extendTrialDays} days`);
  }
  if (input.status && input.status !== venue.status) {
    await setVenueStatus(venueId, input.status);
    await logAdminAction(admin, input.status === "suspended" ? "Suspended venue" : "Restored venue", target);
  }
}

/** "Edit for owner": lets this admin save changes to the venue for a while. Switching it on is logged, and so is every save. */
export async function setEditMode(admin: User, venueId: string, on: boolean) {
  const venue = await getVenueRecord(venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const target = { type: "venue" as const, id: venueId, label: venue.config.name };
  if (on) {
    await startEditGrant(admin.id, venueId);
    await logAdminAction(admin, "Started editing for owner", target, `for ${EDIT_GRANT_MINUTES} minutes`);
  } else {
    await endEditGrant(admin.id, venueId);
    await logAdminAction(admin, "Stopped editing for owner", target);
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

/** Admin roles: super admins only, never on themselves or another super admin. */
function assertSuperAdminChange(admin: User, user: User) {
  if (!isSuperAdmin(admin)) throw new ServiceError(403, "Only a super admin (ADMIN_EMAILS) can do that");
  if (user.id === admin.id || isSuperAdmin(user)) throw new ServiceError(400, "Super admins are managed in ADMIN_EMAILS");
}

export async function updateUserAsAdmin(admin: User, userId: string, input: z.output<typeof adminUserRequest>, origin: string) {
  const user = await findUserById(userId);
  if (!user) throw new ServiceError(404, "Account not found");
  const target = accountTarget(user);
  switch (input.action) {
    case "resend_verification":
      if (user.emailVerified) throw new ServiceError(400, "That email is already confirmed");
      await sendVerificationEmail(user, origin);
      await logAdminAction(admin, "Resent verification email", target);
      return;
    case "send_reset":
      if (user.blocked) throw new ServiceError(400, "Unblock the account first");
      await sendPasswordResetEmail(user, origin);
      await logAdminAction(admin, "Sent password reset link", target);
      return;
    case "block":
      assertCanLockOut(admin, user);
      await setUserBlocked(user.id, true);
      await destroyAllSessions(user.id);
      await logAdminAction(admin, "Blocked account", target);
      return;
    case "unblock":
      await setUserBlocked(user.id, false);
      await logAdminAction(admin, "Unblocked account", target);
      return;
    case "make_admin":
    case "remove_admin":
      assertSuperAdminChange(admin, user);
      if (input.action === "make_admin" && !user.emailVerified) throw new ServiceError(400, "They need to confirm their email first");
      await setAdminRole(user.id, input.action === "make_admin");
      await logAdminAction(admin, input.action === "make_admin" ? "Made admin" : "Removed admin", target);
      return;
  }
}

/** Deletes the account and the venues it alone owns. The operator types the email to confirm. */
export async function deleteUserAsAdmin(admin: User, userId: string, confirmEmail: string) {
  const user = await findUserById(userId);
  if (!user) throw new ServiceError(404, "Account not found");
  assertCanLockOut(admin, user);
  if (confirmEmail.trim().toLowerCase() !== user.email) throw new ServiceError(400, "Type the account's email exactly to confirm");
  const venues = await removeAccount(user.id);
  await logAdminAction(admin, "Deleted account", accountTarget(user), venues ? `and ${venues} venue${venues === 1 ? "" : "s"}` : null);
}

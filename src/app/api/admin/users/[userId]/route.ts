import { adminDeleteUserRequest, adminUserRequest } from "@/lib/api/account-contracts";
import { requireApiAdmin } from "@/server/dashboard";
import { handle, parseBody, requestOrigin } from "@/server/http";
import { deleteUserAsAdmin, updateUserAsAdmin } from "@/server/services/operator";

/** Operator account actions: resend verification, send a reset link, block or unblock. */
export const PATCH = handle(async (request, ctx: RouteContext<"/api/admin/users/[userId]">) => {
  const admin = await requireApiAdmin(request);
  updateUserAsAdmin(admin, (await ctx.params).userId, await parseBody(request, adminUserRequest), requestOrigin(request));
  return Response.json({ ok: true });
});

export const DELETE = handle(async (request, ctx: RouteContext<"/api/admin/users/[userId]">) => {
  const admin = await requireApiAdmin(request);
  const { confirmEmail } = await parseBody(request, adminDeleteUserRequest);
  await deleteUserAsAdmin(admin, (await ctx.params).userId, confirmEmail);
  return Response.json({ ok: true });
});

import { deleteAccountRequest, updateAccountRequest } from "@/lib/api/account-contracts";
import { requireApiUser } from "@/server/auth/session";
import { assertSameOrigin, handle, parseBody } from "@/server/http";
import { updateUserName } from "@/server/repositories/users";
import { deleteAccount } from "@/server/services/accounts";

export const PATCH = handle(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { name } = await parseBody(request, updateAccountRequest);
  updateUserName(user.id, name);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { password } = await parseBody(request, deleteAccountRequest);
  await deleteAccount(user, password);
  return Response.json({ ok: true });
});

import { changePasswordRequest } from "@/lib/api/account-contracts";
import { requireApiUser } from "@/server/auth/session";
import { assertSameOrigin, handle, parseBody } from "@/server/http";
import { changePassword } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await changePassword(user, await parseBody(request, changePasswordRequest));
  return Response.json({ ok: true });
});

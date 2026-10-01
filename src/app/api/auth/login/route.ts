import { loginRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit } from "@/server/http";
import { login } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(request, "login", 20);
  await login(await parseBody(request, loginRequest));
  return Response.json({ ok: true });
});

import { signupRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { signup } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(request, "signup", 5);
  const input = await parseBody(request, signupRequest);
  await signup(input, requestOrigin(request));
  return Response.json({ ok: true });
});

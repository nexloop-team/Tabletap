import { forgotPasswordRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { requestPasswordReset } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(request, "forgot", 5);
  const { email } = await parseBody(request, forgotPasswordRequest);
  requestPasswordReset(email, requestOrigin(request));
  return Response.json({ ok: true });
});

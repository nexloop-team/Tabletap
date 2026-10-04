import { forgotPasswordRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { requestPasswordReset } from "@/server/services/accounts";
import { verifyCaptcha } from "@/server/services/captcha";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(request, "forgot", 5);
  const { email, captchaToken } = await parseBody(request, forgotPasswordRequest);
  await verifyCaptcha(captchaToken, request);
  requestPasswordReset(email, requestOrigin(request));
  return Response.json({ ok: true });
});

import { assertSameOrigin, handle } from "@/server/http";
import { logout } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await logout();
  return Response.json({ ok: true });
});

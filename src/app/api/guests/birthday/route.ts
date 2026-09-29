import { birthdayRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit } from "@/server/http";
import { updateBirthday } from "@/server/services/guests";

export const POST = handle(async (request) => {
  rateLimit(request, "birthday", 20);
  updateBirthday(await parseBody(request, birthdayRequest));
  return Response.json({ ok: true });
});

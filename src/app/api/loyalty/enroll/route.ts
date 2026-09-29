import { enrollRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { enroll } from "@/server/services/loyalty";

export const POST = handle(async (request) => {
  rateLimit(request, "enroll", 20);
  const input = await parseBody(request, enrollRequest);
  return Response.json(enroll(input, requestOrigin(request)));
});

import { stampRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit } from "@/server/http";
import { stampForFeedback } from "@/server/services/loyalty";

export const POST = handle(async (request) => {
  rateLimit(request, "stamp", 20);
  const input = await parseBody(request, stampRequest);
  return Response.json(stampForFeedback(input));
});

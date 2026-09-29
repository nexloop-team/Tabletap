import { captureGuestRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { captureGuest } from "@/server/services/guests";

export const POST = handle(async (request) => {
  rateLimit(request, "capture", 20);
  const input = await parseBody(request, captureGuestRequest);
  return Response.json(captureGuest(input, requestOrigin(request)));
});

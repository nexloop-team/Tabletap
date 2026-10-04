import { staffUndoRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { requireStaffDevice, undoLast } from "@/server/services/staff";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  rateLimitKey(`staff:${device.id}`, 60);
  const { cardId } = await parseBody(request, staffUndoRequest);
  return Response.json(undoLast(device, cardId));
});

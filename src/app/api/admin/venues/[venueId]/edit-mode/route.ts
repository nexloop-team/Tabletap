import { adminEditModeRequest } from "@/lib/api/account-contracts";
import { requireApiAdmin } from "@/server/dashboard";
import { handle, parseBody } from "@/server/http";
import { setEditMode } from "@/server/services/operator";

/** Switch "Edit for owner" on or off for this admin and venue. */
export const POST = handle(async (request, ctx: RouteContext<"/api/admin/venues/[venueId]/edit-mode">) => {
  const admin = await requireApiAdmin(request);
  const { on } = await parseBody(request, adminEditModeRequest);
  await setEditMode(admin, (await ctx.params).venueId, on);
  return Response.json({ ok: true });
});

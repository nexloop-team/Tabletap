import { handle, rateLimit, requestOrigin, ServiceError } from "@/server/http";
import { publicOrigin } from "@/server/services/qr";
import { memberCardView } from "@/server/services/card";

/**
 * The member's card for whoever holds its private link (id + token). The
 * venue's guest page shows it inline, and both it and the card page poll
 * this to show new stamps the moment staff add them.
 */
export const GET = handle(async (request, ctx: RouteContext<"/api/cards/[id]">) => {
  rateLimit(request, "card-status", 120);
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const view = await memberCardView(id, token, publicOrigin(requestOrigin(request)));
  if (!view) throw new ServiceError(404, "Card not found");
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
});

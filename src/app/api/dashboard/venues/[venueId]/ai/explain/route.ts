import { explainDishesRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, rateLimit, ServiceError } from "@/server/http";
import { entitlementsFor } from "@/server/repositories/subscriptions";
import { explainDishes } from "@/server/services/ai";

/** Drafts "What's this?" notes for the owner to review; nothing is saved here. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/ai/explain">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  if (!entitlementsFor(venue.id).can.ai) throw new ServiceError(402, "AI drafting is part of the Pro plan");
  rateLimit(request, "ai-explain", 20);
  const { items, onlyUnfamiliar } = await parseBody(request, explainDishesRequest);
  const suggestions = await explainDishes({ id: venue.id, name: venue.config.name, venueType: venue.config.venueType }, items, onlyUnfamiliar);
  return Response.json({ suggestions });
});

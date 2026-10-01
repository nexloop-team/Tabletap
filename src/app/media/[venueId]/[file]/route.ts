import fs from "node:fs";
import { resolveMedia } from "@/server/services/media";

/** Public merchant images. Names are random and never reused, so they cache forever. */
export async function GET(_request: Request, ctx: RouteContext<"/media/[venueId]/[file]">) {
  const { venueId, file } = await ctx.params;
  const media = resolveMedia(venueId, file);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(media.filePath)), {
    headers: {
      "Content-Type": media.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

import { timingSafeEqual } from "node:crypto";
import { runDueJobs } from "@/server/jobs";

/**
 * For an external scheduler when the in-process ticker is off: Vercel Cron
 * (GET, see vercel.json; Vercel sends `Authorization: Bearer $CRON_SECRET`
 * itself once CRON_SECRET is set) or any other cron (POST, same header).
 * Safe to call any time; jobs only do what is due and never repeat work.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDueJobs());
}

export const GET = POST;

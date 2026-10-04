import { redirect } from "next/navigation";
import { completePairing } from "@/server/services/staff";

/** The one-time link from the dashboard: opening it makes this browser a staff device. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  redirect(token && (await completePairing(token)) ? "/staff?paired=1" : "/staff?paired=0");
}

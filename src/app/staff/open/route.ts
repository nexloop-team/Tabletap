import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { ServiceError } from "@/server/http";
import { openTillForUser } from "@/server/services/staff-invites";

/** `/staff/open?v=<venue>`: a signed-in staff member (or owner) turns this browser into a till device. */
export async function GET(request: Request) {
  const venueId = new URL(request.url).searchParams.get("v") ?? "";
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/staff/open?v=${venueId}`)}`);
  try {
    await openTillForUser(user, venueId);
  } catch (error) {
    if (error instanceof ServiceError) redirect("/staff?invite=0");
    throw error;
  }
  redirect("/staff?paired=1");
}

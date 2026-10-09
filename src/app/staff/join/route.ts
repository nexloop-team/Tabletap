import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { acceptStaffInvite } from "@/server/services/staff-invites";

/** `/staff/join?t=…` from the invite email: sign in (or up) first, then join the venue as staff and open the till. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/staff/join?t=${token}`)}`);
  const venueId = token ? await acceptStaffInvite(token, user) : null;
  redirect(venueId ? `/staff/open?v=${encodeURIComponent(venueId)}` : "/staff?invite=0");
}

import { redirect } from "next/navigation";
import { verifyEmail } from "@/server/services/accounts";

/** The link in the confirmation email. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  redirect(token && verifyEmail(token) ? "/dashboard?verified=1" : "/dashboard?verified=0");
}

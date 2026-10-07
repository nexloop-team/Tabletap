import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/AuthForms";
import { TRIAL_DAYS } from "@/lib/plans";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = firstParam((await searchParams).next);
  if (await currentUser()) redirect(safeNext(next));
  // Invited staff sign up to reach the till, not to create a venue.
  const joiningStaff = next.startsWith("/staff/");
  return (
    <>
      <h1>{joiningStaff ? "Create your staff account" : "Set up your venue in minutes"}</h1>
      <p>{joiningStaff ? "A free account just for you. It lets you stamp cards at the till, nothing else." : `Try everything free for ${TRIAL_DAYS} days. No card needed.`}</p>
      <SignupForm next={next || undefined} />
      <p className="auth-alt">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link>
      </p>
    </>
  );
}

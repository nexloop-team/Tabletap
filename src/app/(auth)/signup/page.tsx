import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/AuthForms";
import { TRIAL_DAYS } from "@/lib/plans";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <>
      <h1>Set up your venue in minutes</h1>
      <p>Free forever for the basics, with {TRIAL_DAYS} days of Pro included. No card needed.</p>
      <SignupForm />
      <p className="auth-alt">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}

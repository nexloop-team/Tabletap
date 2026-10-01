import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = firstParam((await searchParams).token);
  if (!token) {
    return (
      <>
        <h1>This link is incomplete</h1>
        <p>Open the link from your email again, or ask for a new one.</p>
        <Link className="btn btn-primary btn-block" href="/forgot-password">
          Send a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1>Choose a new password</h1>
      <p>You&apos;ll be signed out everywhere else.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}

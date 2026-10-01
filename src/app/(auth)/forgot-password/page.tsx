import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1>Reset your password</h1>
      <p>Enter the email you signed up with and we&apos;ll send you a link.</p>
      <ForgotPasswordForm />
      <p className="auth-alt">
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}

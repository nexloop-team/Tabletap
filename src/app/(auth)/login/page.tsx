import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = firstParam((await searchParams).next);
  if (await currentUser()) redirect(safeNext(next));
  return (
    <>
      <h1>Welcome back</h1>
      <p>Sign in to manage your venue.</p>
      <LoginForm next={next || undefined} />
      <p className="auth-alt">
        New here? <Link href="/signup">Create a free account</Link>
      </p>
    </>
  );
}

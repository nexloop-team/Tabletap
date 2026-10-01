import type { Metadata } from "next";
import { AccountForms } from "@/components/dashboard/SettingsForms";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="dash-main" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1>Your account</h1>
          <p>Signed in as {user.email}</p>
        </div>
      </div>
      <AccountForms name={user.name} email={user.email} />
    </main>
  );
}

import type { Metadata } from "next";
import { BadgeCheck, Lock, MailWarning, Search, Users } from "lucide-react";
import Link from "next/link";
import { AdminUserActions } from "@/components/dashboard/AdminActions";
import { EmptyState, PageHeader } from "@/components/dashboard/blocks";
import { formatAgo, formatDate, initials } from "@/lib/format";
import { isAdmin, isSuperAdmin } from "@/server/auth/session";
import { adminUsers, matches, USER_LIMIT } from "@/server/admin";
import { requireAdminPage } from "@/server/dashboard";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Accounts" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unverified", label: "Unverified" },
  { key: "no-venue", label: "No venue" },
  { key: "blocked", label: "Blocked" },
  { key: "admins", label: "Admins" },
] as const;

export default async function AdminAccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  const admin = await requireAdminPage();
  const query = await searchParams;
  const q = firstParam(query.q).slice(0, 100);
  const filter = FILTERS.find((f) => f.key === firstParam(query.filter))?.key ?? "all";

  const all = await adminUsers();
  const searched = all.filter((user) => matches(q, user.name, user.email));
  const inFilter = (key: string) => (user: (typeof all)[number]) => (key === "unverified" ? !user.emailVerified : key === "no-venue" ? user.venueCount === 0 : key === "blocked" ? user.blocked : key === "admins" ? isAdmin(user) : true);
  const rows = searched.filter(inFilter(filter));
  const href = (key: string) => `/admin/accounts?${new URLSearchParams({ ...(q ? { q } : {}), ...(key !== "all" ? { filter: key } : {}) })}`;

  return (
    <div className="page">
      <PageHeader eyebrow="Platform admin" title="Accounts" description="Everyone who has signed up, newest first. Resend emails, block or delete from the … menu." />

      <section className="card card-flush">
        <div className="toolbar">
          <nav className="filter-tabs" aria-label="Filter accounts">
            {FILTERS.map((f) => (
              <Link key={f.key} href={href(f.key)} aria-current={f.key === filter ? "true" : undefined}>
                {f.label} <span className="count">{searched.filter(inFilter(f.key)).length}</span>
              </Link>
            ))}
          </nav>
          <form className="search" action="/admin/accounts" role="search">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            <Search aria-hidden />
            <input className="input" type="search" name="q" defaultValue={q} placeholder="Name or email" aria-label="Search accounts" />
          </form>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title={q ? "No accounts match that search" : "Nothing here"}>
            {q ? "Try a shorter search." : "Accounts in this group will show up here."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Email</th>
                  <th scope="col" className="num">
                    Venues
                  </th>
                  <th scope="col">Signed up</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="cell-venue">
                        <span className="avatar" aria-hidden>
                          {initials(user.name || user.email)}
                        </span>
                        <span>
                          <strong>{user.name || "Unnamed"}</strong>
                          <span className="muted truncate">{user.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="inline">
                        {user.emailVerified ? (
                          <span className="badge badge-ok">
                            <BadgeCheck aria-hidden /> Verified
                          </span>
                        ) : (
                          <span className="badge badge-warn">
                            <MailWarning aria-hidden /> Unverified
                          </span>
                        )}
                        {user.blocked && (
                          <span className="badge badge-danger">
                            <Lock aria-hidden /> Blocked
                          </span>
                        )}
                        {isAdmin(user) && (
                          <span className="badge badge-admin">{isSuperAdmin(user) ? "Super admin" : "Admin"}</span>
                        )}
                      </span>
                    </td>
                    <td className="num">
                      {user.venueCount > 0 ? (
                        <Link className="link-quiet" href={`/admin/venues?q=${encodeURIComponent(user.email)}`}>
                          {user.venueCount}
                        </Link>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="nowrap">
                      <span title={formatDate(user.createdAt)}>{formatAgo(user.createdAt)}</span>
                    </td>
                    <td className="cell-actions">
                      <AdminUserActions
                        userId={user.id}
                        email={user.email}
                        verified={user.emailVerified}
                        blocked={user.blocked}
                        protectedAccount={user.id === admin.id || isSuperAdmin(user) || (isAdmin(user) && !isSuperAdmin(admin))}
                        canManageAdmins={isSuperAdmin(admin) && user.id !== admin.id && !isSuperAdmin(user) && (user.emailVerified || user.adminRole)}
                        adminRole={user.adminRole}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          Showing {rows.length.toLocaleString("en-IN")} of {all.length.toLocaleString("en-IN")} accounts
          {all.length >= USER_LIMIT && ` (the ${USER_LIMIT} newest)`}
        </div>
      </section>
    </div>
  );
}

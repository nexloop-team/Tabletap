import type { Metadata } from "next";
import { History } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/dashboard/blocks";
import { formatAgo, formatDate } from "@/lib/format";
import { requireAdminPage } from "@/server/dashboard";
import { listAdminActions } from "@/server/repositories/admin-actions";

export const metadata: Metadata = { title: "Activity log" };

const LIMIT = 300;

/** Every change an operator made, newest first. Rows are never edited or removed. */
export default async function AdminActivityPage() {
  await requireAdminPage();
  const actions = listAdminActions({ limit: LIMIT });

  return (
    <div className="page">
      <PageHeader eyebrow="Platform admin" title="Activity log" description="Every change made from the admin console, and by whom." />
      <section className="card card-flush">
        {actions.length === 0 ? (
          <EmptyState icon={History} title="Nothing yet">
            Suspensions, trial extensions, account actions and owner edits show up here.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Admin</th>
                  <th scope="col">Action</th>
                  <th scope="col">On</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((entry) => (
                  <tr key={entry.id}>
                    <td className="nowrap">
                      <span title={formatDate(entry.createdAt)}>{formatAgo(entry.createdAt)}</span>
                    </td>
                    <td className="truncate">{entry.adminEmail}</td>
                    <td>
                      <strong>{entry.action}</strong>
                      {entry.detail && <span className="muted"> {entry.detail}</span>}
                    </td>
                    <td className="truncate">
                      {entry.targetType === "venue" ? (
                        <Link className="link-quiet" href={`/admin/venues?q=${encodeURIComponent(entry.targetId)}`}>
                          {entry.targetLabel ?? entry.targetId}
                        </Link>
                      ) : (
                        <Link className="link-quiet" href={`/admin/accounts?q=${encodeURIComponent(entry.targetLabel ?? "")}`}>
                          {entry.targetLabel ?? entry.targetId}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          {actions.length === 1 ? "1 entry" : `Showing the latest ${actions.length} entries`}
        </div>
      </section>
    </div>
  );
}

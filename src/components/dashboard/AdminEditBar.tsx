"use client";

import { Loader2, PencilLine, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { useConfirm } from "./confirm";

/**
 * The notice an admin sees on someone else's venue: read-only by default,
 * with an explicit, logged "Edit for owner" that switches itself off.
 */
export function AdminEditBar({ venueId, venueName, editingUntil, minutes }: { venueId: string; venueName: string; editingUntil: string | null; minutes: number }) {
  const router = useRouter();
  const ask = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(on: boolean) {
    if (
      on &&
      !(await ask({
        title: `Edit ${venueName} for the owner?`,
        body: `You can save changes here for the next ${minutes} minutes. Every save is recorded in the activity log with your name. Billing and deleting the venue stay with the owner.`,
        confirmLabel: "Start editing",
      }))
    )
      return;
    setPending(true);
    setError(null);
    try {
      await dashboardApi.adminEditMode(venueId, { on });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const until = editingUntil ? new Date(editingUntil).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;

  return (
    <div className={`notice ${until ? "notice-warn" : "notice-admin"}`}>
      <span className="inline" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        {until ? <PencilLine aria-hidden style={{ marginTop: 2 }} /> : <Shield aria-hidden style={{ marginTop: 2 }} />}
        <span>
          {until ? (
            <>
              <strong>You&apos;re editing {venueName} for the owner</strong> until <span suppressHydrationWarning>{until}</span>. Every save is logged.
            </>
          ) : (
            <>
              You&apos;re viewing <strong>{venueName}</strong> as a platform admin. It&apos;s read-only until you turn on editing.
            </>
          )}
          {error && <span className="field-error" style={{ display: "block" }}>{error}</span>}
        </span>
      </span>
      <span className="inline nowrap">
        {until ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void toggle(false)} disabled={pending}>
            {pending && <Loader2 className="spin" aria-hidden />} Stop editing
          </button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => void toggle(true)} disabled={pending}>
            {pending ? <Loader2 className="spin" aria-hidden /> : <PencilLine aria-hidden />} Edit for owner
          </button>
        )}
        <Link className="btn btn-sm btn-ghost" href="/admin/venues">
          Back to admin
        </Link>
      </span>
    </div>
  );
}

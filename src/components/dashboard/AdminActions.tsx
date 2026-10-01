"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { AdminVenueRequest } from "@/lib/api/account-contracts";

export function AdminVenueActions({ venueId, status, plan }: { venueId: string; status: "active" | "suspended"; plan: "free" | "pro" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function apply(body: AdminVenueRequest, question: string) {
    if (!window.confirm(question)) return;
    setPending(true);
    try {
      await dashboardApi.adminUpdateVenue(venueId, body);
      router.refresh();
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline" style={{ flexWrap: "nowrap" }}>
      {status === "active" ? (
        <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => apply({ status: "suspended" }, "Suspend this venue? Its guest page goes offline.")}>
          Suspend
        </button>
      ) : (
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => apply({ status: "active" }, "Restore this venue?")}>
          Restore
        </button>
      )}
      {plan === "pro" ? (
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => apply({ plan: "free" }, "Remove Pro from this venue? (Doesn't cancel a Stripe subscription.)")}>
          Remove Pro
        </button>
      ) : (
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => apply({ plan: "pro" }, "Give this venue Pro for free?")}>
          Comp Pro
        </button>
      )}
    </span>
  );
}

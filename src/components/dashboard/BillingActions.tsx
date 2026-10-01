"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";

/** Upgrade (Checkout) or manage (Customer Portal); both hand off to a URL the server returns. */
export function BillingActions({ venueId, action, label, devMode }: { venueId: string; action: "checkout" | "portal"; label: string; devMode: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (devMode && action === "portal" && !window.confirm("Dev mode: cancel Pro and go back to Free now?")) return;
    setPending(true);
    setError(null);
    try {
      const { url } = action === "checkout" ? await dashboardApi.checkout(venueId) : await dashboardApi.billingPortal(venueId);
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className={`btn ${action === "checkout" ? "btn-primary" : ""} btn-block`} onClick={go} disabled={pending}>
        {pending && <Loader2 className="spin" aria-hidden />}
        {label}
      </button>
      {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

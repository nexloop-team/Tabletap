import type { Metadata } from "next";
import { Check } from "lucide-react";
import { BillingActions } from "@/components/dashboard/BillingActions";
import { parseDbDate, planPriceParts, PLANS, trialDaysLeft } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";
import { firstParam } from "@/server/request";
import { billingMode } from "@/server/services/billing";

export const metadata: Metadata = { title: "Plan & billing" };

function formatDate(value: string | null | undefined): string | null {
  const time = parseDbDate(value);
  return time === null ? null : new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = { active: "Active", trialing: "Trial", past_due: "Payment failed: retrying", canceled: "Cancelled" };

export default async function BillingPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/billing">) {
  const { venue, plan, subscription } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const mode = billingMode();
  const trialDays = trialDaysLeft(subscription);
  const paying = subscription?.plan === "pro" && subscription.status !== "canceled";
  const renews = formatDate(subscription?.currentPeriodEnd);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plan & billing</h1>
          <p>Billed per venue. Cancel any time; your page stays up on the Free plan.</p>
        </div>
      </div>

      {firstParam(query.upgraded) && <div className="notice notice-ok" style={{ marginBottom: 16 }}>Welcome to Pro! Every feature is now live on your page.</div>}
      {firstParam(query.canceled) && <div className="notice notice-info" style={{ marginBottom: 16 }}>Your subscription was cancelled. Your page is on the Free plan.</div>}
      {mode === "dev" && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          Billing is in dev mode (no STRIPE_SECRET_KEY / STRIPE_PRICE_ID set): upgrading switches Pro on instantly without payment.
        </div>
      )}
      {subscription?.status === "past_due" && (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>
          Your last payment didn&apos;t go through. Update your card to keep Pro.
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="spread">
          <div>
            <div className="hint">Current plan</div>
            <div className="inline" style={{ marginTop: 2 }}>
              <strong style={{ fontSize: 20 }}>{plan === "pro" ? "Pro" : "Free"}</strong>
              {paying && subscription && <span className="badge badge-ok">{STATUS_LABEL[subscription.status]}</span>}
              {trialDays !== null && <span className="badge badge-pro">Trial: {trialDays} day{trialDays === 1 ? "" : "s"} left</span>}
            </div>
            {paying && renews && <p className="hint">Renews on {renews}</p>}
          </div>
        </div>
      </section>

      <div className="pricing" style={{ margin: 0, maxWidth: "none" }}>
        {PLANS.map((p) => {
          const [amount, per] = planPriceParts(p);
          return (
            <section key={p.id} className={`card price-card ${p.id === "pro" ? "featured" : ""}`}>
              <h3>{p.name}</h3>
              <div className="price">
                {amount}
                {per && <span> {per}</span>}
              </div>
              <p className="muted">{p.blurb}</p>
              <ul>
                {p.features.map((feature) => (
                  <li key={feature}>
                    <Check aria-hidden /> {feature}
                  </li>
                ))}
              </ul>
              {p.id === "pro" &&
                (paying ? (
                  <BillingActions venueId={venue.id} action="portal" label={mode === "dev" ? "Cancel Pro (dev)" : "Manage billing"} devMode={mode === "dev"} />
                ) : mode === "disabled" ? (
                  <p className="hint">Payments aren&apos;t set up yet. Contact us to upgrade.</p>
                ) : (
                  <BillingActions venueId={venue.id} action="checkout" label={trialDays !== null ? "Subscribe to keep Pro" : "Upgrade to Pro"} devMode={mode === "dev"} />
                ))}
              {p.id === "free" && plan === "free" && <p className="hint">You&apos;re on this plan.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

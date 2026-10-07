import type { Metadata } from "next";
import { Check } from "lucide-react";
import { CancelSubscriptionButton, SubscribeButton } from "@/components/dashboard/BillingActions";
import { BRAND } from "@/config/brand";
import { accessBadge, BILLING_PERIOD, formatInr, GST_RATE, parseDbDate, PLAN_FEATURES, PRICE_INR, PRICE_WITH_GST_INR, TRIAL_DAYS } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";
import { firstParam } from "@/server/request";
import { billingMode } from "@/server/services/billing";

export const metadata: Metadata = { title: "Subscription" };

function formatDate(value: string | null | undefined): string | null {
  const time = parseDbDate(value);
  return time === null ? null : new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BillingPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/billing">) {
  const { venue, subscription, access } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const mode = billingMode();
  const badge = accessBadge(subscription);
  const periodEnd = formatDate(subscription?.currentPeriodEnd);
  const trialEnd = formatDate(subscription?.trialEndsAt);
  const managedBySupport = access === "paid" && subscription?.provider === "manual";
  const cancelling = access === "paid" && !!subscription?.cancelAtPeriodEnd;
  const canCancel = access === "paid" && !managedBySupport && !cancelling;
  // While a cancelled year runs out, a second subscription would charge twice.
  const canSubscribe = access !== "paid";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subscription</h1>
          <p>One plan with everything in it, billed once a year for each venue.</p>
        </div>
      </div>

      {firstParam(query.subscribed) && <div className="notice notice-ok" style={{ marginBottom: 16 }}>You&apos;re subscribed. Thank you! Your guest page stays live.</div>}
      {mode === "dev" && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          Payments are in dev mode (no Razorpay keys set): subscribing switches the venue on for a year without payment.
        </div>
      )}
      {access === "unpaid" && (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>
          Your guest page is offline because {subscription?.paid || subscription?.status === "canceled" ? "your subscription has ended" : "your free trial has ended"}. Subscribe to bring it back exactly as it was.
        </div>
      )}
      {subscription?.status === "past_due" && access === "paid" && (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>
          Your renewal payment didn&apos;t go through. Razorpay will try again over the next few days; use the link in their email to update how you pay.
        </div>
      )}
      {cancelling && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          Your subscription won&apos;t renew. Your guest page stays live until {periodEnd ?? "the end of the year you paid for"}.
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="spread">
          <div>
            <div className="hint">Status</div>
            <div className="inline" style={{ marginTop: 2 }}>
              <strong style={{ fontSize: 20 }}>{access === "paid" ? "Subscribed" : access === "trial" ? "Free trial" : "Not subscribed"}</strong>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>
            {access === "trial" && trialEnd && <p className="hint">Your trial ends on {trialEnd}. Your page goes offline then unless you subscribe.</p>}
            {access === "paid" && !cancelling && !managedBySupport && periodEnd && <p className="hint">Renews on {periodEnd}.</p>}
            {managedBySupport && <p className="hint">Free access from the {BRAND.name} team{periodEnd ? `, until ${periodEnd}` : ""}.</p>}
          </div>
          {canCancel && <CancelSubscriptionButton venueId={venue.id} endsOn={periodEnd} devMode={mode === "dev" || subscription?.provider === "dev"} />}
        </div>
      </section>

      <div className="pricing pricing-single" style={{ margin: 0 }}>
        <section className="card price-card featured">
          <h3>{BRAND.name}</h3>
          <div className="price">
            {formatInr(PRICE_INR)}
            <span> / {BILLING_PERIOD}</span>
          </div>
          <p className="price-gst">
            + {GST_RATE * 100}% GST, so {formatInr(PRICE_WITH_GST_INR)} in total. {TRIAL_DAYS}-day free trial for every new venue.
          </p>
          <ul>
            {PLAN_FEATURES.map((feature) => (
              <li key={feature}>
                <Check aria-hidden /> {feature}
              </li>
            ))}
          </ul>
          {canSubscribe &&
            (mode === "disabled" ? (
              <p className="hint">Online payments aren&apos;t set up yet. Email {BRAND.supportEmail} and we&apos;ll get you subscribed.</p>
            ) : (
              <SubscribeButton venueId={venue.id} label={access === "trial" ? "Subscribe now" : "Subscribe"} />
            ))}
          {access === "paid" && <p className="hint">{cancelling ? "Everything above stays on until your paid year ends." : "You're subscribed. Everything above is on."}</p>}
        </section>
      </div>
    </>
  );
}

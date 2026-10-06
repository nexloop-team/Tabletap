"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { deviceMemory } from "@/lib/browser";
import { rewardsPassLine } from "@/lib/landing-copy";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import { hasLoyaltyProgram, isRewardsOnly } from "@/lib/venue/features";
import { ConsentLine, Field, RewardsConsent } from "../forms";
import { useLanding } from "../LandingContext";
import { useRewardsJoin, useStampJoin } from "../useJoin";

export interface GateCompletion {
  customerId: string | null;
  offerTaken: boolean;
  /** Both halves of the consent line were answered yes (so a birthday may be asked). */
  consentAsked: boolean;
  confirmationPending: boolean;
  passLine: string;
}

/**
 * Email before Wi-Fi. Three rules:
 *  - consent is never a condition of connecting;
 *  - the email is (no email, no password);
 *  - a failed loyalty join must not cost the guest their Wi-Fi.
 */
export function WifiGate({ onComplete }: { onComplete: (completion: GateCompletion) => void }) {
  const { venue, t, tf, track, rememberCustomer } = useLanding();
  const stampJoin = useStampJoin();
  const rewardsJoin = useRewardsJoin();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCard = hasLoyaltyProgram(venue);
  const rewardsOnly = isRewardsOnly(venue);

  async function submit(takeOffer: boolean) {
    const address = normaliseEmail(email);
    if (!isPlausibleEmail(address)) {
      setError(t("wifi_gate_email_required"));
      return;
    }
    setBusy(true);
    setError(null);

    if (takeOffer && rewardsOnly) {
      track("wifi_offer_taken");
      const result = await rewardsJoin({ email: address, firstName, ageAttested: consent, door: "wifi_gate" });
      if (!result.ok) track("wifi_offer_failed");
      onComplete({
        customerId: result.ok ? result.response.customerId : null,
        offerTaken: true,
        consentAsked: result.ok && consent,
        confirmationPending: result.ok && result.response.confirmationPending,
        passLine: result.ok ? rewardsPassLine(result.response, address, false, tf) : "",
      });
      return;
    }

    if (takeOffer) {
      track("wifi_offer_taken");
      const result = await stampJoin({ name: firstName, email: address, initialStamps: 1, captureSource: "wifi", consent });
      if (!result.ok) track("wifi_offer_failed"); // the stamp is dropped; the Wi-Fi is not
      onComplete({
        customerId: result.ok ? result.response.customerId : null,
        offerTaken: true,
        consentAsked: result.ok && consent,
        confirmationPending: result.ok && result.response.confirmationPending,
        passLine: result.ok ? rewardsPassLine(result.response, address, false, tf) : "",
      });
      return;
    }

    try {
      const captured = await api.captureGuest({
        venueId: venue.id,
        email: address,
        firstName: firstName.trim() || undefined,
        marketingConsent: consent,
        ageAttested: consent,
        source: "wifi",
        locale: navigator.language,
      });
      deviceMemory.rememberCustomer(venue.id, captured.customerId);
      rememberCustomer(captured.customerId);
      onComplete({ customerId: captured.customerId, offerTaken: false, consentAsked: consent, confirmationPending: captured.confirmationPending, passLine: "" });
    } catch {
      // Nothing captured, nothing earned: stay at the gate with a retry.
      setError(t("something_wrong"));
      setBusy(false);
    }
  }

  return (
    <div className="form-stack">
      <p className="sheet-intro">{t("wifi_gate_sub")}</p>
      <Field label={t("email_address")}>
        <input className="text-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t("first_name")}>
        <input className="text-input" type="text" autoComplete="given-name" autoCorrect="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </Field>
      {rewardsOnly ? <RewardsConsent checked={consent} onChange={setConsent} /> : <ConsentLine checked={consent} onChange={setConsent} />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {(hasCard || rewardsOnly) && (
        <button type="button" className={`primary-btn${busy ? " busy" : ""}`} disabled={busy} onClick={() => submit(true)}>
          {hasCard ? t("wifi_gate_offer") : t("rewards_wifi_offer")}
        </button>
      )}
      <button type="button" className="sheet-btn" disabled={busy} onClick={() => submit(false)}>
        {t("wifi_gate_only")}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { deviceMemory } from "@/lib/browser";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import { consentAskOn } from "@/lib/venue/features";
import { ConsentLine, Field } from "../forms";
import { useLanding } from "../LandingContext";

export interface GateCompletion {
  customerId: string;
  /** The guest ticked the offers line (so a birthday may be asked). */
  consentAsked: boolean;
  confirmationPending: boolean;
}

/**
 * Email before Wi-Fi, when the owner switched it on (Loyalty → Guest
 * details). Two rules: the email is the price of the password, and saying
 * yes to offers never is. No card and no stamp come with it.
 */
export function WifiGate({ onComplete }: { onComplete: (completion: GateCompletion) => void }) {
  const { venue, t, rememberCustomer } = useLanding();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const askConsent = consentAskOn(venue);

  async function submit() {
    const address = normaliseEmail(email);
    if (!isPlausibleEmail(address)) {
      setError(t("wifi_gate_email_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const captured = await api.captureGuest({
        venueId: venue.id,
        email: address,
        firstName: firstName.trim() || undefined,
        marketingConsent: askConsent && consent,
        ageAttested: askConsent && consent,
        locale: navigator.language,
      });
      deviceMemory.rememberCustomer(venue.id, captured.customerId);
      rememberCustomer(captured.customerId);
      onComplete({ customerId: captured.customerId, consentAsked: askConsent && consent, confirmationPending: captured.confirmationPending });
    } catch {
      // Nothing captured, nothing shown: stay at the gate with a retry.
      setError(t("something_wrong"));
      setBusy(false);
    }
  }

  return (
    <form
      className="form-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="sheet-intro">{t("wifi_gate_sub")}</p>
      <Field label={t("email_address")}>
        <input className="text-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t("first_name")}>
        <input className="text-input" type="text" autoComplete="given-name" autoCorrect="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </Field>
      {askConsent && <ConsentLine checked={consent} onChange={setConsent} />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={`primary-btn${busy ? " busy" : ""}`} disabled={busy}>
        {t("wifi_gate_submit")}
      </button>
    </form>
  );
}

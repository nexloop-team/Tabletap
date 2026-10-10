"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { deviceMemory } from "@/lib/browser";
import { birthdayAskOn, wifiGateActive } from "@/lib/venue/features";
import { useSheet } from "../FeatureCard";
import { BirthdayFields, birthdayAnswer } from "../forms";
import { useLanding } from "../LandingContext";
import { WifiCredentials } from "./WifiCredentials";
import { WifiGate, type GateCompletion } from "./WifiGate";

/** Asked after the guest is online, never before, and only of someone who said yes to marketing. */
function BirthdayPrompt({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const { venue, t, tf, track } = useLanding();
  const [value, setValue] = useState({ month: "1", day: "1" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("birthday_prompt_shown", { source: "wifi" });
  }, [track]);

  function skip() {
    const state = deviceMemory.birthdayState(venue.id);
    deviceMemory.setBirthdayState(venue.id, state === "1" ? "2" : "1");
    void api.setBirthday({ venueId: venue.id, customerId, skipped: true }).catch(() => {});
    track("birthday_prompt_skipped");
    onDone();
  }

  async function save() {
    const answer = birthdayAnswer(value);
    if (!answer) return;
    setBusy(true);
    try {
      await api.setBirthday({ venueId: venue.id, customerId, ...answer });
      deviceMemory.setBirthdayState(venue.id, "answered");
      track("birthday_added", { source: "wifi" });
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="form-stack birthday-card" style={{ marginTop: 16 }}>
      <h3>{t("birthday_prompt_title")}</h3>
      <p className="sub-text">{tf("birthday_prompt_body", { business: venue.name })}</p>
      <BirthdayFields value={value} onChange={setValue} allowBlank={false} />
      <button type="button" className={`primary-btn${busy ? " busy" : ""}`} disabled={busy} onClick={save}>
        {t("birthday_save")}
      </button>
      <button type="button" className="sheet-btn" onClick={skip}>
        {t("birthday_skip")}
      </button>
    </div>
  );
}
export function WifiSheet() {
  const { venue, t, track, knownCustomerId } = useLanding();
  const { isOpen } = useSheet();
  const gated = wifiGateActive(venue);
  const [completion, setCompletion] = useState<GateCompletion | null>(null);
  const [birthdayFor, setBirthdayFor] = useState<string | null>(null);
  const visitRecorded = useRef(false);
  const wasOpen = useRef(false);

  // A device the venue already knows skips the gate (and so does a guest who joined elsewhere on the page).
  const gateVisible = gated && !knownCustomerId && !completion;
  const guestId = completion?.customerId ?? knownCustomerId;

  // Behind the gate the password is fetched once the guest is through it.
  const [password, setPassword] = useState<{ for: string; value: string | null } | null>(null);
  useEffect(() => {
    if (!gated || !isOpen || !guestId || password?.for === guestId) return;
    let cancelled = false;
    api
      .wifiPassword({ venueId: venue.id, customerId: guestId })
      .then((result) => !cancelled && setPassword({ for: guestId, value: result.password }))
      .catch(() => !cancelled && setPassword({ for: guestId, value: null }));
    return () => {
      cancelled = true;
    };
  }, [gated, isOpen, guestId, password, venue.id]);

  // Open/close is what's measured: a tap, not a page load.
  useEffect(() => {
    if (isOpen === wasOpen.current) return;
    wasOpen.current = isOpen;
    if (!isOpen) {
      if (gateVisible) track("wifi_gate_abandoned");
      return;
    }
    track("wifi_sheet_opened");
    if (gateVisible) {
      track("wifi_gate_shown");
      return;
    }
    // A guest this phone knows counts as a visit (it keeps "we miss you" emails honest).
    if (knownCustomerId && !completion && !visitRecorded.current) {
      visitRecorded.current = true;
      track("wifi_known_device_connected");
      void api.recordVisit({ venueId: venue.id, customerId: knownCustomerId, type: "wifi_tap" }).catch(() => {});
    }
  }, [isOpen, gateVisible, knownCustomerId, completion, venue.id, track]);

  function complete(result: GateCompletion) {
    visitRecorded.current = true; // the capture itself recorded this visit
    setCompletion(result);
    track("wifi_gate_completed", { consent_pending: result.confirmationPending });
    if (result.confirmationPending) track("consent_confirmation_sent", { source: "wifi" });
    const state = deviceMemory.birthdayState(venue.id);
    if (birthdayAskOn(venue) && result.consentAsked && state !== "answered" && state !== "2") setBirthdayFor(result.customerId);
  }

  return (
    <div className="sheet-inner">
      {gateVisible ? (
        <WifiGate onComplete={complete} />
      ) : (
        <>
          {completion?.confirmationPending && (
            <div className="wifi-notice" role="status">
              <p>{t("check_inbox_confirm")}</p>
            </div>
          )}
          <WifiCredentials gated={gated} password={gated ? (password?.for === guestId ? password.value : undefined) : undefined} />
          {birthdayFor && <BirthdayPrompt customerId={birthdayFor} onDone={() => setBirthdayFor(null)} />}
        </>
      )}
    </div>
  );
}

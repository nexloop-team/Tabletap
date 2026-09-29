"use client";

import { useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { enrolEmailCopy } from "@/lib/landing-copy";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import { SuccessPanel, WalletActions } from "../forms";
import { useLanding } from "../LandingContext";
import { useStampJoin } from "../useJoin";

type Outcome =
  | { kind: "enrolled"; node: ReactNode }
  | { kind: "stamped" }
  | { kind: "not_stamped" };

/**
 * The thank-you's loyalty ask: "you've earned a free stamp, join to claim it".
 * A new member is enrolled with the stamp; an existing member is stamped
 * instead (the join endpoint never adds stamps to an existing card).
 */
export function FreeStampJoin() {
  const { venue, t, tf, track, setLoyaltyDone } = useLanding();
  const join = useStampJoin();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const valid = name.trim().length > 0 && isPlausibleEmail(email);

  async function submit() {
    if (!valid) {
      setError(t("please_enter_details"));
      return;
    }
    track("loyalty_signup_started", { from_context: "feedback_thankyou" });
    setBusy(true);
    setError(null);
    const result = await join({ name, email, initialStamps: 1, captureSource: "feedback" });
    if (!result.ok) {
      setBusy(false);
      setError(t(result.error));
      return;
    }
    const { response } = result;
    if (!response.wasExisting) {
      track("loyalty_signup_completed", { from_context: "feedback_thankyou" });
      setOutcome({
        kind: "enrolled",
        node: (
          <>
            <p>{enrolEmailCopy(response, result.email, t, tf)}</p>
            <WalletActions response={response} context="feedback_join" />
          </>
        ),
      });
      return;
    }
    track("loyalty_signup_already_enrolled", { from_context: "feedback_thankyou" });
    try {
      const stamp = await api.stampForFeedback({ venueId: venue.id, email: normaliseEmail(email) });
      if (stamp.stamped) {
        track("loyalty_stamp_from_feedback", { current_stamps: stamp.currentStamps });
        setLoyaltyDone();
      }
      setOutcome({ kind: stamp.stamped ? "stamped" : "not_stamped" });
    } catch {
      setBusy(false);
      setError(t("something_wrong"));
    }
  }

  if (outcome) {
    return (
      <>
        {outcome.kind === "enrolled" && (
          <SuccessPanel icon="heart" title={t("youre_enrolled")}>
            {outcome.node}
          </SuccessPanel>
        )}
        {outcome.kind === "stamped" && (
          <SuccessPanel icon="heart" title={t("stamp_added")}>
            <p>{t("wallet_updates_automatically")}</p>
          </SuccessPanel>
        )}
        {outcome.kind === "not_stamped" && (
          <SuccessPanel icon="heart">
            <p>{t("no_stamp_this_time")}</p>
          </SuccessPanel>
        )}
      </>
    );
  }

  return (
    <>
      <p>{tf("earn_rewards_visit", { business: venue.name })}</p>
      <form
        className="form-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input className="text-input" type="text" placeholder={t("your_name")} autoComplete="name" autoCorrect="off" value={name} onChange={(e) => setName(e.target.value)} aria-label={t("your_name")} />
        <input className="text-input" type="email" placeholder={t("email_address")} autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t("email_address")} />
        <button type="submit" className={`primary-btn${busy ? " busy" : ""}`} disabled={!valid || busy}>
          {busy ? t("enrolling") : t("join_free_stamp")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </>
  );
}

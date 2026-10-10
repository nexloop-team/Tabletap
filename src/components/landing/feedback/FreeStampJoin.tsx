"use client";

import { useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { FeedbackResponse } from "@/lib/api/contracts";
import { cardCredentialsFromUrl, deviceMemory, parseCardCredentials, type CardCredentials } from "@/lib/browser";
import { enrolEmailCopy } from "@/lib/landing-copy";
import { isPlausibleEmail, maskEmail, normaliseEmail } from "@/lib/validation";
import { Field, SuccessPanel, JoinedCard } from "../forms";
import { useLanding } from "../LandingContext";
import { MyCard } from "../loyalty/MyCard";
import { useStampJoin } from "../useJoin";

type Outcome =
  | { kind: "enrolled"; node: ReactNode }
  | { kind: "stamped"; card: CardCredentials | null }
  | { kind: "not_stamped"; card: CardCredentials | null };

/**
 * The thank-you's loyalty ask: "you've earned a free stamp, join to claim it".
 * A new member is enrolled with the stamp; an existing member is stamped
 * instead (the join endpoint never adds stamps to an existing card).
 */
export function FreeStampJoin({ receipt }: { receipt: NonNullable<FeedbackResponse["stampReceipt"]> }) {
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
    const result = await join({ name, email, initialStamps: 1, captureSource: "feedback", feedbackReceipt: receipt });
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
            <JoinedCard response={response} />
          </>
        ),
      });
      return;
    }
    track("loyalty_signup_already_enrolled", { from_context: "feedback_thankyou" });
    try {
      const stamp = await api.stampForFeedback({ venueId: venue.id, email: normaliseEmail(email), feedbackReceipt: receipt });
      if (stamp.stamped) {
        track("loyalty_stamp_from_feedback", { current_stamps: stamp.currentStamps });
        setLoyaltyDone();
      }
      // Already a member: show their card here if this phone knows it; otherwise it's on its way by email.
      const card = cardCredentialsFromUrl(response.cardUrl) ?? parseCardCredentials(deviceMemory.cardRaw(venue.id));
      setOutcome({ kind: stamp.stamped ? "stamped" : "not_stamped", card });
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
            {outcome.card ? <MyCard credentials={outcome.card} /> : <p>{tf("pass_sent_to", { email: maskEmail(normaliseEmail(email)) })}</p>}
          </SuccessPanel>
        )}
        {outcome.kind === "not_stamped" && (
          <SuccessPanel icon="heart">
            <p>{t("no_stamp_this_time")}</p>
            {outcome.card ? <MyCard credentials={outcome.card} /> : <p>{tf("pass_sent_to", { email: maskEmail(normaliseEmail(email)) })}</p>}
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
        <Field label={t("your_name")}>
          <input className="text-input" type="text" autoComplete="name" autoCorrect="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("email_address")}>
          <input className="text-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
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

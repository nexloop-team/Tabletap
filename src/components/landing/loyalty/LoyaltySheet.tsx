"use client";

import { useState } from "react";
import { enrolEmailCopy } from "@/lib/landing-copy";
import { isPlausibleEmail } from "@/lib/validation";
import { birthdayAskOn, consentAskOn } from "@/lib/venue/features";
import type { LoyaltyProgram } from "@/lib/venue/types";
import { FilledHeart } from "../../icons";
import { useSheet } from "../FeatureCard";
import { BirthdayFields, ConsentLine, EMPTY_BIRTHDAY, SuccessPanel, WalletActions, birthdayAnswer } from "../forms";
import { useLanding } from "../LandingContext";
import { useStampJoin } from "../useJoin";

const TIER_COLORS = ["#FF9F0A", "#D94D66", "#5B8DEF", "#34C759", "#AF52DE"];

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function RewardsSummary({ program }: { program: LoyaltyProgram }) {
  const { t, tf } = useLanding();
  const tiers = program.rewardTiers ?? [];
  if (tiers.length > 1) {
    const count = tiers.length;
    return (
      <>
        <p>{t("collect_stamps_rewards")}</p>
        <div className={`rewards-grid count-${count}`}>
          {tiers.map((tier, i) => {
            const color = TIER_COLORS[i % TIER_COLORS.length];
            // With an odd count the last (biggest) reward spans the full row.
            const featured = count % 2 === 1 && count > 1 && i === count - 1;
            return (
              <div key={`${tier.rewardName}-${i}`} className={`reward-card${featured ? " featured" : ""}`}>
                <div className="reward-card-num" style={{ background: `${color}22`, color }}>
                  {tier.stampsRequired}
                </div>
                <div className="reward-card-name">{tier.rewardName}</div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
  return <p>{tf("collect_stamps_single", { stamps: program.stampsRequired, reward: lowerFirst(program.rewardName) })}</p>;
}

/** The stamp-card join on the home card. */
export function LoyaltySheet() {
  const { venue, t, tf, track, membership } = useLanding();
  const { close } = useSheet();
  const join = useStampJoin();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const program = venue.loyaltyProgram!;
  const showConsent = consentAskOn(venue);
  // The birthday is only ever used with marketing consent, so it only sits beside that box.
  const showBirthday = showConsent && birthdayAskOn(venue);
  const valid = name.trim().length > 0 && isPlausibleEmail(email);

  if (membership) {
    const { response, email: joinedEmail } = membership;
    return (
      <div className="sheet-inner">
        <SuccessPanel icon="check" title={t(response.wasExisting ? "already_enrolled" : "youre_enrolled")} onClose={close}>
          <p>{enrolEmailCopy(response, joinedEmail, t, tf)}</p>
          {response.confirmationPending && <p className="confirm-notice">{t("check_inbox_confirm")}</p>}
          <WalletActions response={response} context="loyalty_signup" />
        </SuccessPanel>
      </div>
    );
  }

  async function submit() {
    if (!valid) {
      setError(t("please_enter_details"));
      return;
    }
    track("loyalty_signup_started");
    setBusy(true);
    setError(null);
    const result = await join({
      name,
      email,
      captureSource: "landing",
      consent: showConsent ? consent : undefined,
      birthday: showBirthday && consent ? birthdayAnswer(birthday) : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(t(result.error));
      return;
    }
    track(result.response.wasExisting ? "loyalty_signup_already_enrolled" : "loyalty_signup_completed");
    if (result.response.confirmationPending) track("consent_confirmation_sent", { source: "loyalty" });
  }

  return (
    <div className="sheet-inner">
      <div className="loyalty-header">
        <div className="loyalty-icon">
          <FilledHeart />
        </div>
        <h3>{venue.name || t("loyalty_program")}</h3>
        <RewardsSummary program={program} />
      </div>
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
        {showBirthday && (
          <div className="birthday-block">
            <p className="sub-text">{t("birthday_join_label")}</p>
            <BirthdayFields value={birthday} onChange={setBirthday} />
          </div>
        )}
        {showConsent && <ConsentLine checked={consent} onChange={setConsent} />}
        <button type="submit" className={`primary-btn${busy ? " busy" : ""}`} disabled={!valid || busy}>
          {busy ? t("enrolling") : t("join_loyalty")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}

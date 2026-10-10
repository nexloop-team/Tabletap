"use client";

import { useEffect, useId, useMemo, type ReactNode } from "react";
import type { EnrollResponse } from "@/lib/api/contracts";
import { cardCredentialsFromUrl } from "@/lib/browser";
import { daysInMonth } from "@/lib/validation";
import { consentAgeThreshold } from "@/lib/venue/features";
import { FilledHeart } from "../icons";
import { useLanding } from "./LandingContext";
import { MyCardToggle } from "./loyalty/MyCard";

/** A guest-page form field: a small label above a borderless 48px input. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="g-field">
      <span className="g-field-label">{label}</span>
      {children}
    </label>
  );
}

function PrivacyLink() {
  const { t } = useLanding();
  return (
    <a href="/privacy" target="_blank" rel="noopener">
      {t("privacy_notice")}
    </a>
  );
}

/** The single, unticked, never-required consent box. Its sentence carries the 13+/18+ age line. */
export function ConsentLine({ checked, onChange, withPrivacyLink = true }: { checked: boolean; onChange: (value: boolean) => void; withPrivacyLink?: boolean }) {
  const { venue, tf } = useLanding();
  const id = useId();
  const key = consentAgeThreshold(venue) === 18 ? "consent_single_18" : "consent_single_13";
  return (
    <label className="consent-line" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {tf(key, { business: venue.name })}
        {withPrivacyLink && (
          <>
            {" "}
            <PrivacyLink />
          </>
        )}
      </span>
    </label>
  );
}

/** Rewards-only joins: the button is the consent, so the statement has no box; the box is the age/marketing line. */
export function RewardsConsent({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { venue, tf } = useLanding();
  return (
    <>
      <p className="sub-text">
        {tf("rewards_consent", { business: venue.name })} <PrivacyLink />
      </p>
      <ConsentLine checked={checked} onChange={onChange} withPrivacyLink={false} />
    </>
  );
}

interface BirthdayValue {
  month: string;
  day: string;
}

export const EMPTY_BIRTHDAY: BirthdayValue = { month: "", day: "" };

export function birthdayAnswer(value: BirthdayValue): { month: number; day: number } | null {
  const month = Number(value.month);
  const day = Number(value.day);
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= daysInMonth(month))) return null;
  return { month, day };
}

/** Month and day, both starting blank; the day list narrows to the chosen month. */
export function BirthdayFields({ value, onChange, allowBlank = true }: { value: BirthdayValue; onChange: (value: BirthdayValue) => void; allowBlank?: boolean }) {
  const { t } = useLanding();
  const maxDay = value.month ? daysInMonth(Number(value.month)) : 31;

  useEffect(() => {
    if (value.day && Number(value.day) > maxDay) onChange({ ...value, day: "" });
  }, [maxDay, value, onChange]);

  return (
    <div className="birthday-row">
      <label>
        <span>{t("birthday_month")}</span>
        <select value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })}>
          {allowBlank && <option value="">-</option>}
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("birthday_day")}</span>
        <select value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })}>
          {allowBlank && <option value="">-</option>}
          {Array.from({ length: maxDay }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** A member who just joined: their web card opens here on the venue's page, not in a new tab. */
export function JoinedCard({ response }: { response: EnrollResponse }) {
  const cardCredentials = useMemo(() => cardCredentialsFromUrl(response.cardUrl), [response.cardUrl]);
  return cardCredentials ? <MyCardToggle credentials={cardCredentials} /> : null;
}

export function SuccessPanel({
  icon,
  title,
  onClose,
  children,
}: {
  icon: "check" | "heart";
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const { t } = useLanding();
  return (
    <div className="success-panel" role="status">
      {onClose && (
        <button type="button" className="close-x" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
      )}
      {icon === "heart" ? (
        <div className="check-icon heart">
          <FilledHeart />
        </div>
      ) : (
        <span className="check-badge" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

"use client";

import { useCallback } from "react";
import { api } from "@/lib/api/client";
import type { EnrollResponse } from "@/lib/api/contracts";
import type { MessageKey } from "@/lib/i18n";
import { deviceMemory } from "@/lib/browser";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import { useLanding } from "./LandingContext";

export type JoinResult = { ok: true; response: EnrollResponse; email: string } | { ok: false; error: MessageKey };

function currentLocale() {
  return typeof navigator !== "undefined" ? navigator.language : "en";
}

/** After any successful join: remember the device and publish the membership to every card. */
function useRecordJoin() {
  const { venue, rememberCustomer, setMembership, setLoyaltyDone } = useLanding();
  return useCallback(
    (response: EnrollResponse, email: string) => {
      deviceMemory.rememberCustomer(venue.id, response.customerId);
      rememberCustomer(response.customerId);
      setMembership({ response, email });
      if (!response.wasExisting) setLoyaltyDone();
    },
    [venue.id, rememberCustomer, setMembership, setLoyaltyDone],
  );
}

export interface StampJoinInput {
  name: string;
  email: string;
  initialStamps?: 0 | 1;
  captureSource: "landing" | "feedback" | "wifi";
  /** Only sent when the consent box was actually shown. */
  consent?: boolean;
  birthday?: { month: number; day: number } | null;
}

/** Stamp-card enrolment, shared by the loyalty sheet, the feedback thank-you and the Wi-Fi offer. */
export function useStampJoin() {
  const { venue } = useLanding();
  const recordJoin = useRecordJoin();
  return useCallback(
    async (input: StampJoinInput): Promise<JoinResult> => {
      const email = normaliseEmail(input.email);
      try {
        const response = await api.enroll({
          venueId: venue.id,
          email,
          name: input.name.trim() || undefined,
          firstName: input.name.trim().split(/\s+/)[0] || undefined,
          initialStamps: input.initialStamps,
          captureSource: input.captureSource,
          marketingConsent: input.consent,
          ageAttested: input.consent,
          birthday: input.birthday ?? undefined,
          locale: currentLocale(),
        });
        recordJoin(response, email);
        return { ok: true, response, email };
      } catch {
        return { ok: false, error: "something_wrong" };
      }
    },
    [venue.id, recordJoin],
  );
}

export interface RewardsJoinInput {
  email: string;
  firstName: string;
  ageAttested: boolean;
  door: "home" | "feedback" | "wifi_gate";
  birthday?: { month: number; day: number } | null;
}

/** Rewards-only membership: no stamps, no consent box of its own — the button is the consent. */
export function useRewardsJoin() {
  const { venue, track } = useLanding();
  const recordJoin = useRecordJoin();
  return useCallback(
    async (input: RewardsJoinInput): Promise<JoinResult> => {
      const email = normaliseEmail(input.email);
      if (!isPlausibleEmail(email)) return { ok: false, error: "rewards_email_required" };
      track("rewards_join_tapped", { context: input.door });
      try {
        const response = await api.enroll({
          venueId: venue.id,
          email,
          firstName: input.firstName.trim() || undefined,
          captureSource: "rewards",
          joined: true,
          door: input.door,
          ageAttested: input.ageAttested,
          birthday: input.ageAttested ? (input.birthday ?? undefined) : undefined,
          locale: currentLocale(),
        });
        recordJoin(response, email);
        track("rewards_join_completed", { context: input.door });
        return { ok: true, response, email };
      } catch {
        track("rewards_join_failed", { context: input.door });
        return { ok: false, error: "something_wrong" };
      }
    },
    [venue.id, track, recordJoin],
  );
}

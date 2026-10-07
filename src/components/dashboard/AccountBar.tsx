"use client";

import { Clock, Mail, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { subscribeNever } from "@/lib/browser";
import { ResendVerification } from "./Shell";

const SNOOZE_KEY = "tt_verify_snoozed_until";
const DAY_MS = 86_400_000;

function snoozedNow(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * One slim bar for account housekeeping instead of a stack of notices: the
 * free-trial countdown and, until it's done, "confirm your email" (which can
 * be snoozed for a day).
 */
export function AccountBar({ unverifiedEmail, trialDays, billingHref }: { unverifiedEmail: string | null; trialDays: number | null; billingHref: string }) {
  const storedSnooze = useSyncExternalStore(subscribeNever, snoozedNow, () => false);
  const [snoozed, setSnoozed] = useState(false);
  const showEmail = !!unverifiedEmail && !storedSnooze && !snoozed;
  if (!showEmail && trialDays === null) return null;

  return (
    <div className={`account-bar${trialDays === null ? " only-email" : ""}`}>
      {trialDays !== null && (
        <span className="account-bar-part">
          <Clock aria-hidden />
          <span>
            <strong>
              Free trial · {trialDays} day{trialDays === 1 ? "" : "s"} left.
            </strong>{" "}
            <span className="account-bar-more">Subscribe to keep your guest page online after it ends.</span>
          </span>
          <Link className="btn btn-primary btn-sm" href={billingHref}>
            Subscribe
          </Link>
        </span>
      )}
      {showEmail && (
        <span className="account-bar-part">
          <Mail aria-hidden />
          <span>
            Confirm <strong>{unverifiedEmail}</strong> so we can reach you.
          </span>
          <ResendVerification />
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Remind me tomorrow"
            title="Remind me tomorrow"
            onClick={() => {
              setSnoozed(true);
              try {
                localStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY_MS));
              } catch {
                // Private mode: hidden for this visit only.
              }
            }}
          >
            <X aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}

import "server-only";
import type { Db } from "../db";
import { consentAskOn } from "@/lib/venue/features";
import type { PublicVenue } from "@/lib/venue/types";
import { newToken } from "../ids";
import { findCustomerByConsentToken, setConsent, type CustomerRow } from "../repositories/customers";
import { sendMail, type Mail } from "./mailer";

export interface ConsentAnswer {
  /** The single box: "email me offers … I confirm I'm 13/18 or older". */
  marketingConsent: boolean;
  ageAttested: boolean;
}

export interface ConsentOutcome {
  /** True when a double-opt-in email was requested for this answer. */
  confirmationPending: boolean;
  /** Email to send once the surrounding transaction has committed. */
  mail: Mail | null;
}

/**
 * Records the guest's answer. Consent only ever becomes `granted` through the
 * emailed confirmation link (double opt-in). An unticked box records
 * `declined` only for a guest never asked before, so a later "no" on a
 * different form cannot silently revoke an earlier confirmed "yes".
 */
export async function recordConsent(
  db: Db,
  venue: PublicVenue,
  customer: CustomerRow,
  answer: ConsentAnswer | null,
  origin: string,
): Promise<ConsentOutcome> {
  if (!answer || !consentAskOn(venue)) return { confirmationPending: false, mail: null };

  if (answer.marketingConsent && answer.ageAttested) {
    if (customer.marketing_consent === "granted") return { confirmationPending: false, mail: null };
    const token = newToken();
    await setConsent(db, customer.id, "pending", true, token);
    return {
      confirmationPending: true,
      mail: {
        to: customer.email,
        subject: `Confirm your subscription to ${venue.name}`,
        text: `Tap to confirm you'd like offers and news from ${venue.name}:\n${origin}/consent?token=${token}\n\nIf this wasn't you, ignore this email and nothing will be sent.`,
      },
    };
  }

  if (customer.marketing_consent === "unasked") await setConsent(db, customer.id, "declined", answer.ageAttested, null);
  return { confirmationPending: false, mail: null };
}

export async function confirmConsent(db: Db, token: string): Promise<boolean> {
  const customer = await findCustomerByConsentToken(db, token);
  if (!customer || customer.marketing_consent !== "pending") return false;
  await setConsent(db, customer.id, "granted", !!customer.age_attested, null);
  return true;
}

export async function deliver(mail: Mail | null) {
  if (mail) await sendMail(mail);
}

import "server-only";
import { BRAND } from "@/config/brand";
import { getDb } from "../db";
import { appOrigin } from "../origin";
import { birthdayGuests, claimGuestEmail, ensureUnsubscribeToken, lapsedGuests, releaseGuestEmail, type EmailableGuest } from "../repositories/retention";
import { venueHasAccess } from "../repositories/subscriptions";
import { getVenueSettings } from "../repositories/venues";
import { sendMail } from "../services/mailer";
import { localParts } from "./time";

/**
 * Marketing emails the owner switches on once: a birthday treat (three days
 * ahead) and "we miss you" for regulars who've lapsed. Only to guests who
 * confirmed marketing consent, only in daytime, never twice for the same
 * birthday or the same lapse, and always with a one-click unsubscribe.
 */

const BIRTHDAY_DAYS_AHEAD = 3;
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 20;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function marketingFooter(venueName: string, customerId: string): { text: string; headers: Record<string, string> } {
  const url = `${appOrigin()}/unsubscribe?token=${ensureUnsubscribeToken(customerId)}`;
  return {
    text: `\n—\nYou're getting this because you asked ${venueName} for offers. Unsubscribe: ${url}\n${venueName} · via ${BRAND.name}`,
    headers: {
      "List-Unsubscribe": `<${appOrigin()}/api/unsubscribe?token=${ensureUnsubscribeToken(customerId)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

function send(guest: EmailableGuest, kind: string, key: string, subject: string, body: string[], venueName: string): boolean {
  if (!claimGuestEmail(guest.id, kind, key)) return false;
  const footer = marketingFooter(venueName, guest.id);
  const ok = sendMail({ to: guest.email, subject, text: `${body.join("\n")}\n${footer.text}`, headers: footer.headers });
  if (!ok) releaseGuestEmail(guest.id, kind, key);
  return ok;
}

export async function runGuestAutomations(now: Date): Promise<number> {
  const local = localParts(now);
  if (local.hour < SEND_FROM_HOUR || local.hour >= SEND_UNTIL_HOUR) return 0;

  const venues = getDb().prepare("SELECT id, json_extract(config, '$.name') AS name FROM venues WHERE status = 'active'").all() as { id: string; name: string }[];
  let sent = 0;
  for (const venue of venues) {
    if (!venueHasAccess(venue.id)) continue;
    const { birthday, winBack } = getVenueSettings(venue.id).automations;

    if (birthday.enabled) {
      const target = localParts(new Date(now.getTime() + BIRTHDAY_DAYS_AHEAD * 86_400_000));
      // 29 February birthdays are celebrated on 1 March in other years.
      const leapDayGuests = target.month === 3 && target.day === 1 && !isLeapYear(target.year) ? birthdayGuests(venue.id, 2, [29]) : [];
      const guests = [...birthdayGuests(venue.id, target.month, [target.day]), ...leapDayGuests];
      for (const guest of guests) {
        const ok = send(
          guest,
          "birthday",
          String(target.year),
          `Happy birthday from ${venue.name}!`,
          [
            `Hi ${guest.firstName || "there"},`,
            "",
            `Your birthday's coming up, and we'd love to celebrate with you at ${venue.name}.`,
            "",
            birthday.offer,
            "",
            "Just show this email when you visit. See you soon!",
          ],
          venue.name,
        );
        if (ok) sent += 1;
      }
    }

    if (winBack.enabled) {
      for (const guest of lapsedGuests(venue.id, winBack.days)) {
        const ok = send(
          guest,
          "win_back",
          guest.lastSeen.slice(0, 10),
          `We miss you at ${venue.name}`,
          [`Hi ${guest.firstName || "there"},`, "", `It's been a little while since we saw you at ${venue.name}.`, "", winBack.offer, "", "Hope to see you soon!"],
          venue.name,
        );
        if (ok) sent += 1;
      }
    }
  }
  return sent;
}

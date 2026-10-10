import "server-only";
import { BRAND } from "@/config/brand";
import { appOrigin } from "../origin";
import { listFeedback, venueStats } from "../repositories/insights";
import { digestRecipients, type DigestRecipient } from "../repositories/notifications";
import { sendMail } from "../services/mailer";
import { claimJob, releaseJob } from "./claims";
import { digestWeek } from "./time";
import { parseDbDate } from "@/lib/plans";
import { venueTimeZone } from "@/lib/venue/region";

/**
 * The Monday-morning email: last week's scans, guests, stamps and feedback
 * for each venue an owner runs. Owners who never log in still see the value.
 */

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export async function buildDigest(recipient: DigestRecipient, now = new Date()): Promise<{ subject: string; text: string }> {
  const stats = await venueStats(recipient.venueId, 7);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const notes = (await listFeedback(recipient.venueId, { limit: 10 })).rows.filter((row) => (parseDbDate(row.createdAt) ?? 0) >= weekAgo).slice(0, 3);
  const origin = appOrigin();
  const dashboard = `${origin}/dashboard/${recipient.venueId}`;

  const lines = [
    `Hi ${recipient.name.split(" ")[0] || "there"},`,
    "",
    `Here's your week at ${recipient.venueName}:`,
    "",
    `• ${plural(stats.scans, "scan")} (${plural(stats.visitors, "visit")})`,
    `• ${plural(stats.menuViews, "menu view")}`,
    `• ${plural(stats.newGuests, "new guest")} (${stats.totalGuests} in total)`,
    `• ${plural(stats.stampsGiven, "stamp")} given, ${plural(stats.rewardsRedeemed, "reward")} redeemed`,
    `• ${plural(stats.feedbackCount, "feedback note")}, ${plural(stats.reviewTaps, "tap")} on your Google review link`,
  ];
  if (notes.length) {
    lines.push("", "Latest feedback:");
    for (const note of notes) lines.push(`  “${note.text.length > 160 ? `${note.text.slice(0, 157)}…` : note.text}”`);
    lines.push(`Read it all: ${dashboard}/feedback`);
  }
  if (stats.scans === 0) {
    lines.push("", `No scans last week. Your QR codes might need a better spot: try one on every table and one at the counter. Print them here: ${dashboard}/qr`);
  }
  lines.push("", `Open your dashboard: ${dashboard}`, "", "—", `${BRAND.name} · Turn off this email: ${origin}/dashboard/account`);

  return {
    subject: `Your week at ${recipient.venueName}: ${plural(stats.scans, "scan")}, ${plural(stats.newGuests, "new guest")}`,
    text: lines.join("\n"),
  };
}

export async function runWeeklyDigest(now: Date): Promise<number> {
  let sent = 0;
  for (const recipient of await digestRecipients()) {
    // Monday 08:00 where the venue is.
    const week = digestWeek(now, venueTimeZone(recipient.currencyCode));
    if (!week) continue;
    const key = `${week}:${recipient.venueId}:${recipient.userId}`;
    if (!await claimJob("digest", key)) continue;
    const { subject, text } = await buildDigest(recipient, now);
    if (await sendMail({ to: recipient.email, subject, text })) sent += 1;
    else await releaseJob("digest", key);
  }
  return sent;
}

import "server-only";
import { BRAND } from "@/config/brand";
import { getDb } from "../db";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Every message is written to the `outbox` table (an audit trail, and the
 * whole delivery in development). With RESEND_API_KEY set it is also sent
 * through Resend; delivery runs in the background so a slow provider never
 * holds up the request, and failures are logged rather than shown to guests.
 */
export function sendMail(mail: Mail): boolean {
  try {
    getDb().prepare("INSERT INTO outbox (recipient, subject, body) VALUES (?, ?, ?)").run(mail.to, mail.subject, mail.text);
  } catch (error) {
    console.error("[mail] failed", error);
    return false;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[mail] from=${BRAND.emailFrom} to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return true;
  }
  void fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: BRAND.emailFrom, to: [mail.to], subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(15_000),
  })
    .then(async (response) => {
      if (!response.ok) console.error(`[mail] Resend ${response.status} for "${mail.subject}": ${await response.text()}`);
    })
    .catch((error) => console.error("[mail] Resend unreachable", error));
  return true;
}

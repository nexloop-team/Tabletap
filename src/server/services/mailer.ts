import "server-only";
import { BRAND } from "@/config/brand";
import { getDb } from "../db";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Development mailer: every message lands in the `outbox` table and the
 * server log, so flows that "send an email" can be verified locally.
 * Swap the body of this function for an SMTP/API provider in production;
 * callers only depend on the boolean result.
 */
export function sendMail(mail: Mail): boolean {
  try {
    getDb().prepare("INSERT INTO outbox (recipient, subject, body) VALUES (?, ?, ?)").run(mail.to, mail.subject, mail.text);
    console.info(`[mail] from=${BRAND.emailFrom} to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return true;
  } catch (error) {
    console.error("[mail] failed", error);
    return false;
  }
}

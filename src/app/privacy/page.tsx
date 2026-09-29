import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import "@/styles/pages.css";

export const metadata: Metadata = { title: "Privacy notice" };

/**
 * Plain-language notice linked from every consent line. The venue is the
 * controller of its guests' data and we process it on the venue's behalf;
 * have this reviewed by a lawyer before launch.
 */
export default function PrivacyPage() {
  return (
    <main className="page-wrapper simple-page prose">
      <h1>Privacy notice</h1>
      <p>
        This page explains what happens to your information when you use a venue&apos;s {BRAND.name} page, the page a QR code on your table
        opens. The venue you are visiting decides what it collects and why; {BRAND.name} runs the page for them.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>If you join a loyalty programme or give your email for the Wi-Fi:</strong> your email address, the name you type, and your
          stamps and visits. If you choose to, your birthday (month and day only, never the year).
        </li>
        <li>
          <strong>If you leave feedback:</strong> what you write and any photo you attach. Feedback isn&apos;t linked to your name or email.
          Photos are re-encoded before upload, which removes location data.
        </li>
        <li>
          <strong>When you use the page:</strong> which buttons are tapped, which QR code you scanned and a random ID for this visit. We
          don&apos;t use advertising cookies. We store one small value on your device to remember that you&apos;ve joined, and one to keep
          the page layout consistent.
        </li>
      </ul>

      <h2>Marketing emails</h2>
      <p>
        You&apos;ll only get offers and news if you tick the box <em>and</em> confirm by email. Joining a loyalty programme or getting on
        the Wi-Fi never requires it. Every marketing email has an unsubscribe link.
      </p>

      <h2>Age</h2>
      <p>You must be 13 or older to join (18 or older at pubs and bars).</p>

      <h2>How long we keep it, and your rights</h2>
      <p>
        We keep your details while you&apos;re a member of the venue&apos;s programme and delete them when the venue closes its account or
        when you ask. You can ask for a copy of your data, a correction or deletion. Ask the venue directly, or reply to any email you
        received from us.
      </p>
    </main>
  );
}

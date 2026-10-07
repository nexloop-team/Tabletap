import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { formatInr, PRICE_INR, PRICE_WITH_GST_INR, TRIAL_DAYS } from "@/lib/plans";
import "@/styles/pages.css";

export const metadata: Metadata = { title: "Terms of service" };

/**
 * Starter terms for venue owners. A template, not legal advice: have a
 * lawyer adapt it to your company, country and pricing before launch.
 */
export default function TermsPage() {
  return (
    <main className="page-wrapper simple-page prose">
      <h1>Terms of service</h1>
      <p>
        These terms cover your use of {BRAND.name} as a venue owner or staff member (&ldquo;you&rdquo;). By creating an account you agree to
        them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your password safe. You&apos;re responsible for what happens under your account.</li>
        <li>Give us an email address you check: we use it for security and billing messages.</li>
        <li>You must be allowed to act for the venues you add.</li>
      </ul>

      <h2>Your content and your guests&apos; data</h2>
      <p>
        You own the content you add (menus, images, text). You are the controller of your guests&apos; personal data and we process it on your
        behalf, only to run your page and the features you switch on. Only send marketing to guests who have given and confirmed consent,
        which the guest list shows.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>No unlawful, misleading or harmful content, and no links to malware or phishing.</li>
        <li>No attempts to break, overload or get around the limits of the service.</li>
        <li>We may suspend a venue page that breaks these rules, and will tell you why.</li>
      </ul>

      <h2>Plans and payment</h2>
      <p>
        There is one plan, billed per venue, in advance, once a year: {formatInr(PRICE_INR)} plus GST ({formatInr(PRICE_WITH_GST_INR)} in total). New
        venues get a {TRIAL_DAYS}-day free trial with no card required. If the trial ends, or a renewal can&apos;t be collected, without an active
        subscription, the venue&apos;s guest page goes offline until you subscribe; your settings and guest list are kept and you can still sign in.
        Payments are processed by Razorpay. The subscription renews each year until you cancel; cancelling stops the next renewal, and the page
        stays live until the end of the year you paid for. Prices may change with 30 days&apos; notice.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete a venue or your whole account from the dashboard at any time. Deletion removes the venue&apos;s page, menus, guests,
        feedback and photos. Backups are overwritten within 30 days.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work hard to keep the service running but can&apos;t promise it will never be interrupted. To the extent the law allows, our
        liability is limited to the fees you paid in the 12 months before a claim.
      </p>

      <h2>Changes</h2>
      <p>We&apos;ll email you before making material changes to these terms.</p>
    </main>
  );
}

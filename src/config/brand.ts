/**
 * Product branding shown on every venue page (footer lockup, page titles,
 * email sender). Kept in one place so a rename is a one-line change.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Tapmore",
  /** Sender used by the mailer for pass and confirmation emails. */
  emailFrom: process.env.MAIL_FROM || "Tapmore <hello@tapmore.local>",
  /** Where "Help & contact" in the dashboard sends owners. */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@tapmore.local",
} as const;

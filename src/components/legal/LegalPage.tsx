import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";
import { legalDetails, operatedByOther, POLICIES_UPDATED } from "@/config/legal";

/** Every company page, in the order the footer lists them (Razorpay looks for each one). */
export const LEGAL_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/refunds", label: "Cancellation & refunds" },
  { href: "/shipping", label: "Delivery policy" },
  { href: "/contact", label: "Contact us" },
] as const;

/**
 * The shared frame of the company pages: Tapmore's name, links between the
 * pages, the last-updated date, and one line of fine print naming the
 * company that operates the service, which Indian law asks for.
 */
export function LegalPage({ path, title, children, dated = true }: { path: (typeof LEGAL_LINKS)[number]["href"]; title: string; children: ReactNode; dated?: boolean }) {
  const legal = legalDetails();
  return (
    <main className="page-wrapper simple-page legal-page prose">
      <p className="legal-nav-brand">
        <Link href="/">{BRAND.name}</Link>
      </p>
      <nav className="legal-nav" aria-label="Company pages">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={link.href === path ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <h1>{title}</h1>
      {dated && <p className="legal-updated">Last updated {POLICIES_UPDATED}</p>}
      {children}
      <footer className="legal-parent">
        <p>
          © {new Date().getFullYear()} {operatedByOther(legal) ? `${BRAND.name}. Operated by ${legal.entityLabel}` : legal.entityLabel}
          {legal.registration ? ` (${legal.registration})` : ""}, {legal.address}.
        </p>
      </footer>
    </main>
  );
}

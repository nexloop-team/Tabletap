import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { CURRENCIES } from "@/lib/venue/schema";
import { requireUser } from "@/server/auth/session";
import { listVenuesForUser } from "@/server/repositories/venues";
import "@/styles/app.css";

export const metadata: Metadata = { title: "Set up your venue" };

/** A first guess at the currency from the browser's region; the merchant can change it. */
const REGION_CURRENCY: Record<string, (typeof CURRENCIES)[number]> = {
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", BE: "EUR", AT: "EUR",
  US: "USD", IN: "INR", AU: "AUD", CA: "CAD", NZ: "NZD", AE: "AED", SG: "SGD", ZA: "ZAR",
};

export default async function OnboardingPage() {
  const user = await requireUser();
  const hasVenues = listVenuesForUser(user.id).length > 0;
  const region = /-([A-Z]{2})\b/.exec((await headers()).get("accept-language") ?? "")?.[1] ?? "";
  return (
    <div className="app auth-shell">
      <div style={{ width: "min(640px, 100%)" }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <Link className="wordmark" href="/">
            <BrandMark />
            {BRAND.name}
          </Link>
          {hasVenues && <Link href="/dashboard">Back to dashboard</Link>}
        </div>
        <OnboardingWizard defaultCurrency={REGION_CURRENCY[region] ?? "GBP"} />
      </div>
    </div>
  );
}

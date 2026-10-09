import type { Metadata } from "next";
import { headers } from "next/headers";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { CURRENCIES } from "@/lib/venue/schema";
import { requireUser } from "@/server/auth/session";
import { listVenuesForUser } from "@/server/repositories/venues";
import { uiFont } from "@/app/fonts";
import { firstParam } from "@/server/request";
import "@/styles/app.css";

export const metadata: Metadata = { title: "Set up your venue" };

/** A first guess at the currency from the browser's region; the merchant can change it. */
const REGION_CURRENCY: Record<string, (typeof CURRENCIES)[number]> = {
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", BE: "EUR", AT: "EUR",
  US: "USD", IN: "INR", AU: "AUD", CA: "CAD", NZ: "NZD", AE: "AED", SG: "SGD", ZA: "ZAR",
};

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser();
  const verified = firstParam((await searchParams).verified);
  const hasVenues = (await listVenuesForUser(user.id)).length > 0;
  const region = /-([A-Z]{2})\b/.exec((await headers()).get("accept-language") ?? "")?.[1] ?? "";
  return (
    <div className={`app ${uiFont.variable}`}>
      <OnboardingWizard
        defaultCurrency={REGION_CURRENCY[region] ?? "GBP"}
        exitHref={hasVenues ? "/dashboard" : null}
        notice={
          <>
            {verified === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks! Now let&apos;s set up your venue.</div>}
            {verified === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}
          </>
        }
      />
    </div>
  );
}

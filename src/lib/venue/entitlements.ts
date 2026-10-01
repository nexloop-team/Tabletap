import type { Entitlements } from "../plans";
import type { PublicVenue } from "./types";

/**
 * What the guest actually sees on the current plan. The saved configuration
 * is untouched, so features come back the moment the merchant upgrades.
 */
export function applyEntitlements(venue: PublicVenue, can: Entitlements): PublicVenue {
  return {
    ...venue,
    loyaltyProgram: can.loyalty ? venue.loyaltyProgram : null,
    crm: can.crm ? venue.crm : { enabled: false, consentAsk: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
    branding: can.stylePresets ? venue.branding : { ...venue.branding, style: null },
    showPoweredBy: !can.removeBranding,
  };
}

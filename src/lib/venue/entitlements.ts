import type { Entitlements } from "../plans";
import type { PublicVenue } from "./types";

/**
 * What the guest actually sees on the current plan. The saved configuration
 * is untouched, so features come back the moment the merchant upgrades.
 */
export function applyEntitlements(venue: PublicVenue, can: Entitlements): PublicVenue {
  return {
    ...venue,
    loyaltyProgram: !can.loyalty
      ? null
      : can.referrals || !venue.loyaltyProgram?.referral
        ? venue.loyaltyProgram
        : { ...venue.loyaltyProgram, referral: { ...venue.loyaltyProgram.referral, enabled: false } },
    crm: can.crm ? venue.crm : { enabled: false, consentAsk: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
    branding: {
      ...venue.branding,
      style: can.stylePresets ? venue.branding.style : null,
      ...(can.layouts ? {} : { layout: null, headerStyle: null, buttonShape: null }),
    },
    menus: can.layouts ? venue.menus : venue.menus.map((menu) => ({ ...menu, layout: null })),
    showPoweredBy: !can.removeBranding,
  };
}

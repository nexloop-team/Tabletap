/**
 * The public shape of a venue as served to the customer landing page by
 * GET /api/venues/:id. Everything here is safe to show to anyone holding the
 * QR code; private merchant data never enters this type.
 */

export type LinkLabelToken =
  | "view_menu"
  | "view_price_list"
  | "our_services"
  | "book_now"
  | "visit_website"
  | "order_online";

export interface RewardTier {
  rewardName: string;
  stampsRequired: number;
}

export interface LoyaltyProgram {
  rewardName: string;
  stampsRequired: number;
  /** `false` makes this a rewards-only membership: a pass, but no stamps. */
  stampsEnabled?: boolean;
  rewardTiers?: RewardTier[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  priceInPence: number;
  isAvailable: boolean;
  allergens: string[];
  dietaryTags: string[];
  calories?: number | null;
  imageUrl?: string | null;
}

export interface MenuSection {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  name: string;
  /** When set, the menu card opens this URL instead of the hosted menu page. */
  externalUrl?: string | null;
  linkLabelToken?: LinkLabelToken | null;
  linkLabelCustom?: string | null;
  welcomeText?: string | null;
  primaryColorHex?: string | null;
  /** Print each item's kcal (required in some jurisdictions, optional elsewhere). */
  showCalories?: boolean | null;
  sections: MenuSection[];
}

export interface ExternalLink {
  id: string;
  url: string;
  labelToken?: string | null;
  labelCustom?: string | null;
  icon?: string | null;
}

export type LandingStyle = "classic" | "editorial" | "modern";

export interface VenueBranding {
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  /** Whitespace-only hides the title; absent falls back to the venue name. */
  titleOverride?: string | null;
  tagline?: string | null;
  backgroundColorHex?: string | null;
  /** Forces the card chrome light or dark regardless of the page colour. */
  appearance?: "light" | "dark" | null;
  style?: LandingStyle | null;
  showGoogleReviewButton?: boolean;
  sudokuEnabled?: boolean;
  /** Feature keys (plus `link:<id>`) in the merchant's preferred order. */
  featureOrder?: string[];
}

export interface SocialLinks {
  google?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tripAdvisor?: string | null;
  youtube?: string | null;
}

export interface WifiDetails {
  ssid: string;
  password?: string | null;
  /** e.g. "WPA2"; "open" / "none" / "nopass" mean no password. */
  security?: string | null;
}

/** Customer-platform switches, already resolved server-side. */
export interface CrmSettings {
  enabled: boolean;
  /** Show the marketing-consent line on join forms and the Wi-Fi gate. */
  consentAsk: boolean;
  /** Ask for an email before revealing the Wi-Fi password. */
  wifiCapture: boolean;
  /** Offer the rewards-only join on the feedback thank-you. */
  feedbackCapture: boolean;
  /** Ask for a birthday (month and day, never a year). */
  birthdayAsk: boolean;
}

export interface PublicVenue {
  id: string;
  shortCode: string;
  name: string;
  /** "pub" and "bar" raise the consent age line from 13+ to 18+. */
  venueType?: string | null;
  currencyCode: string;
  wifi?: WifiDetails | null;
  socialLinks: SocialLinks;
  menus: Menu[];
  loyaltyProgram?: LoyaltyProgram | null;
  branding: VenueBranding;
  externalLinks: ExternalLink[];
  crm: CrmSettings;
}

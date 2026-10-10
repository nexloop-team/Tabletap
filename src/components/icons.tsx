import {
  Archive,
  Briefcase,
  Calendar,
  Camera,
  Clock,
  Coffee,
  FileText,
  Gift,
  Globe,
  Grid3x3,
  Heart,
  Info,
  Link as LinkIcon,
  List,
  Mail,
  MapPin,
  MessageSquareMore,
  Music,
  PartyPopper,
  Phone,
  ShoppingCart,
  Star,
  Tag,
  Ticket,
  Truck,
  Utensils,
  Wifi,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { SVGProps } from "react";

/**
 * Icons a merchant may pick for a custom link. This allow-list (not the map
 * below) is the membership check, so arbitrary stored values never render.
 */
export const LINK_ICON_TOKENS = [
  "calendar", "ticket", "event", "music", "food", "drink", "coffee", "cart", "delivery", "gift", "offer",
  "globe", "location", "phone", "email", "hours", "info", "document", "star", "heart", "camera", "jobs", "link",
] as const;
export type LinkIconToken = (typeof LINK_ICON_TOKENS)[number];

const LINK_ICONS: Record<LinkIconToken, LucideIcon> = {
  calendar: Calendar, ticket: Ticket, event: PartyPopper, music: Music, food: Utensils, drink: Wine, coffee: Coffee,
  cart: ShoppingCart, delivery: Truck, gift: Gift, offer: Tag, globe: Globe, location: MapPin, phone: Phone, email: Mail,
  hours: Clock, info: Info, document: FileText, star: Star, heart: Heart, camera: Camera, jobs: Briefcase, link: LinkIcon,
};

export function LinkIconGlyph({ token }: { token: LinkIconToken }) {
  const Icon = LINK_ICONS[token];
  return <Icon aria-hidden strokeWidth={2} />;
}

/** Menu card: a bulleted list, like a printed menu. */
export function MenuGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FilledHeart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.8" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853" />
      <path d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
    </svg>
  );
}

/**
 * The Tapmore mark (brand kit mark.svg): three QR finder corners in
 * currentColor (the brand green, or green-on-dark) with a clay dot in the
 * fourth corner, where the guest taps. Next to the "tapmore" wordmark it is
 * the kit's horizontal logo. Below 24px it's the kit's pixel-tuned favicon:
 * a tile in currentColor with the corners in --mark-ink.
 */
export function BrandMark({ size }: { size?: number }) {
  if (size !== undefined && size < 24) {
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
        <rect width="32" height="32" rx="7" fill="currentColor" />
        <g fill="none" stroke="var(--mark-ink, #fff)" strokeWidth="2">
          <rect x="7" y="7" width="7" height="7" rx="1.5" />
          <rect x="18" y="7" width="7" height="7" rx="1.5" />
          <rect x="7" y="18" width="7" height="7" rx="1.5" />
        </g>
        <g fill="var(--mark-ink, #fff)">
          <rect x="9" y="9" width="3" height="3" rx=".5" />
          <rect x="20" y="9" width="3" height="3" rx=".5" />
          <rect x="9" y="20" width="3" height="3" rx=".5" />
        </g>
        <circle cx="21.5" cy="21.5" r="4.5" fill="var(--mark-dot, #C9682C)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="9">
        <rect x="8.5" y="8.5" width="41" height="41" rx="11" />
        <rect x="70.5" y="8.5" width="41" height="41" rx="11" />
        <rect x="8.5" y="70.5" width="41" height="41" rx="11" />
      </g>
      <g fill="currentColor">
        <rect x="20" y="20" width="18" height="18" rx="5" />
        <rect x="82" y="20" width="18" height="18" rx="5" />
        <rect x="20" y="82" width="18" height="18" rx="5" />
      </g>
      <circle cx="91" cy="91" r="20" fill="var(--mark-dot, #C9682C)" />
    </svg>
  );
}

export type SocialPlatform = "facebook" | "instagram" | "tripadvisor" | "youtube";

export const FeatureGlyphs = {
  wifi: Wifi,
  sudoku: Grid3x3,
  suggestionBox: Archive,
  feedback: MessageSquareMore,
  list: List,
  calendar: Calendar,
  globe: Globe,
  cart: ShoppingCart,
  link: LinkIcon,
};

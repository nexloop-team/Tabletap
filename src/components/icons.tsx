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

/** Product brand mark for the footer lockup: a steaming cup. */
/**
 * A bistro table seen side on (which also reads as a T) with the tap as a dot.
 * The tile takes currentColor; the table and dot read --mark-ink / --mark-dot
 * so each surface can recolour them. Below 32px the dot and foot are dropped.
 */
export function BrandMark({ size }: { size?: number }) {
  if (size !== undefined && size < 32) {
    return (
      <svg viewBox="0 0 72 72" width={size} height={size} aria-hidden>
        <rect width="72" height="72" rx="18" fill="currentColor" />
        <path d="M16 25h40M36 25v24" stroke="var(--mark-ink, #fff)" strokeWidth="9" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} aria-hidden>
      <rect width="72" height="72" rx="20" fill="currentColor" />
      <path d="M18 25h36M36 25v22M27 49h18" stroke="var(--mark-ink, #fff)" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="53" cy="13.5" r="4.5" fill="var(--mark-dot, #F2B48A)" />
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

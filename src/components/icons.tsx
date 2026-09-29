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
export function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 11h12v4a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5v-4z" fill="currentColor" fillOpacity="0.15" />
      <path d="M17 12h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M9 3.5c0 1.5 1.5 1.5 1.5 3S9 8 9 8M13 3.5c0 1.5 1.5 1.5 1.5 3S13 8 13 8" />
    </svg>
  );
}

export type SocialPlatform = "facebook" | "instagram" | "tripadvisor" | "youtube";

/** 56px rounded tiles; drawn locally rather than hot-linking brand PNGs. */
export function SocialTile({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 56 56" aria-hidden>
          <rect width="56" height="56" rx="12" fill="#1877F2" />
          <path d="M31.2 45V30.6h4.8l.7-5.6h-5.5v-3.6c0-1.6.5-2.7 2.8-2.7h3V13.7c-.5-.1-2.3-.2-4.3-.2-4.3 0-7.2 2.6-7.2 7.4V25h-4.8v5.6h4.8V45h5.5z" fill="#fff" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 56 56" aria-hidden>
          <defs>
            <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
              <stop offset="0" stopColor="#FDF497" />
              <stop offset="0.05" stopColor="#FDF497" />
              <stop offset="0.45" stopColor="#FD5949" />
              <stop offset="0.6" stopColor="#D6249F" />
              <stop offset="0.9" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect width="56" height="56" rx="12" fill="url(#ig-grad)" />
          <rect x="14" y="14" width="28" height="28" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
          <circle cx="28" cy="28" r="6.5" fill="none" stroke="#fff" strokeWidth="3" />
          <circle cx="36" cy="20" r="1.8" fill="#fff" />
        </svg>
      );
    case "tripadvisor":
      return (
        <svg viewBox="0 0 56 56" aria-hidden>
          <rect width="56" height="56" rx="12" fill="#fff" stroke="rgba(0,0,0,0.08)" />
          <circle cx="20" cy="30" r="7.5" fill="none" stroke="#000" strokeWidth="2.6" />
          <circle cx="36" cy="30" r="7.5" fill="none" stroke="#000" strokeWidth="2.6" />
          <circle cx="20" cy="30" r="2.6" fill="#34E0A1" />
          <circle cx="36" cy="30" r="2.6" fill="#34E0A1" />
          <path d="M11 22.5c4.5-4 10.5-5.5 17-5.5s12.5 1.5 17 5.5" fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 56 56" aria-hidden>
          <rect width="56" height="56" rx="12" fill="#fff" stroke="rgba(0,0,0,0.08)" />
          <rect x="11" y="16" width="34" height="24" rx="7" fill="#FF0000" />
          <path d="M25 22.5v11l9-5.5z" fill="#fff" />
        </svg>
      );
  }
}

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

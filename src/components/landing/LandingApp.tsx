"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BRAND } from "@/config/brand";
import { createTracker } from "@/lib/analytics";
import { deviceMemory, parseCardCredentials, subscribeNever, type CardCredentials } from "@/lib/browser";
import { createTranslator, type Locale } from "@/lib/i18n";
import { linkLabel } from "@/lib/landing-copy";
import { rememberReferral } from "@/lib/referral";
import { computeTheme } from "@/lib/theme";
import {
  buildFeatures,
  findExternalLink,
  isRewardsOnly,
  menuExternalUrl,
  primaryMenu,
  resolvedTagline,
  resolvedTitle,
  safeImageUrl,
  sanitiseExternalUrl,
  type FeatureKey,
  type LinkFeature,
} from "@/lib/venue/features";
import type { PublicVenue } from "@/lib/venue/types";
import { BrandMark, FeatureGlyphs, FilledHeart, GoogleG, LINK_ICON_TOKENS, LinkIconGlyph, MenuGlyph, type LinkIconToken } from "../icons";
import { AppDialog } from "./AppDialog";
import { ActionCard, ExpandableCard, LinkCard, useSheet } from "./FeatureCard";
import { MyCard } from "./loyalty/MyCard";
import { FEEDBACK_TEXTAREA_ID, FeedbackSheet } from "./feedback/FeedbackSheet";
import { LandingContext, useLanding, type DialogContent, type LandingSession, type Membership } from "./LandingContext";
import { LoyaltySheet } from "./loyalty/LoyaltySheet";
import { RewardsSheet } from "./loyalty/RewardsJoinForm";
import { SocialLinks } from "./SocialLinks";
import { SudokuSheet } from "./sudoku/SudokuSheet";
import { useGoogleReview } from "./useGoogleReview";
import { WifiSheet } from "./wifi/WifiSheet";

export type FeedbackVariant = "box" | "anon";

/** Cookie holding the feedback-card A/B bucket; read on the server so the label never flickers. */
export const FEEDBACK_VARIANT_COOKIE = "tt_cta";

const TINT = { loyalty: "#D94D66", menu: "#FF9500", wifi: "#4DC778", link: "#9C27B0" };

/**
 * iOS only raises the keyboard for a focus() made inside the tap itself, and
 * the textarea is still collapsed at that moment. Focus a throwaway input now
 * (keyboard opens), then hand focus to the textarea once the sheet has grown.
 */
function focusFeedbackKeepingKeyboard() {
  const temp = document.createElement("input");
  temp.setAttribute("aria-hidden", "true");
  temp.tabIndex = -1;
  Object.assign(temp.style, { position: "fixed", top: "0", left: "0", width: "0", height: "0", opacity: "0", border: "0", padding: "0", fontSize: "16px" });
  document.body.appendChild(temp);
  temp.focus({ preventScroll: true });
  setTimeout(() => {
    const area = document.getElementById(FEEDBACK_TEXTAREA_ID);
    if (area) {
      area.focus({ preventScroll: true });
      area.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    temp.remove();
  }, 500);
}

function Header({ venue }: { venue: PublicVenue }) {
  const cover = safeImageUrl(venue.branding.coverImageUrl);
  const logo = safeImageUrl(venue.branding.logoUrl);
  const title = resolvedTitle(venue.branding, venue.name);
  const tagline = resolvedTagline(venue.branding);
  const showRow = !!(logo || title || tagline);
  const rowClass = ["header-row", logo ? "" : "no-logo", cover ? "" : "no-cover"].filter(Boolean).join(" ");

  return (
    <header>
      {cover && (
        <div className="cover">
          {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
          <img src={cover} alt="" fetchPriority="high" />
        </div>
      )}
      {showRow && (
        <div className={rowClass}>
          {logo && (
            <div className={`logo-circle${cover ? "" : " no-cover"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
              <img src={logo} alt="" />
            </div>
          )}
          {(title || tagline) && (
            <div className="header-text">
              {title && <h1>{title}</h1>}
              {tagline && <p className="tagline">{tagline}</p>}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function linkIconToken(icon: string | null | undefined): LinkIconToken {
  return (LINK_ICON_TOKENS as readonly string[]).includes(icon ?? "") ? (icon as LinkIconToken) : "link";
}

const MENU_ICONS: Record<string, keyof typeof FeatureGlyphs> = {
  view_price_list: "list",
  our_services: "list",
  book_now: "calendar",
  visit_website: "globe",
  order_online: "cart",
};

function MenuCardIcon({ token, custom }: { token: string | null | undefined; custom: boolean }) {
  if (custom) return <FeatureGlyphs.link aria-hidden strokeWidth={2} />;
  const glyph = token ? MENU_ICONS[token] : undefined;
  if (!glyph) return <MenuGlyph />;
  const Icon = FeatureGlyphs[glyph];
  return <Icon aria-hidden strokeWidth={2} />;
}

/** Polls only while the sheet is open. */
function MyCardSheet({ credentials, onMissing }: { credentials: CardCredentials; onMissing: () => void }) {
  const { isOpen } = useSheet();
  const { membership, t } = useLanding();
  return (
    <div className="sheet-inner">
      {membership?.response.confirmationPending && <p className="confirm-notice">{t("check_inbox_confirm")}</p>}
      <MyCard credentials={credentials} active={isOpen} onMissing={onMissing} />
    </div>
  );
}

function FeatureList({ features }: { features: FeatureKey[] }) {
  const { venue, t, track, theme, feedbackVariant } = useLanding();
  const review = useGoogleReview();
  const router = useRouter();
  // A member who joined (or opened their card link) on this device sees their card here.
  const storedCardRaw = useSyncExternalStore(subscribeNever, () => deviceMemory.cardRaw(venue.id), () => null);
  const [cardGone, setCardGone] = useState(false);
  const storedCard = useMemo(() => (cardGone ? null : parseCardCredentials(storedCardRaw)), [storedCardRaw, cardGone]);
  const forgetCard = useCallback(() => setCardGone(true), []);

  return (
    <div className="feature-grid">
      {features.map((feature, position) => {
        const tapped = () => track("feature_card_tapped", { feature: feature.startsWith("link:") ? "link" : feature });

        switch (feature) {
          case "loyalty":
            if (storedCard && !isRewardsOnly(venue)) {
              return (
                <ExpandableCard
                  key={feature}
                  feature={feature}
                  label={t("feature_my_card")}
                  icon={<FilledHeart />}
                  tint={TINT.loyalty}
                  lazy
                  onToggle={(open) => {
                    if (open) tapped();
                  }}
                >
                  <MyCardSheet credentials={storedCard} onMissing={forgetCard} />
                </ExpandableCard>
              );
            }
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={t("feature_loyalty")}
                icon={<FilledHeart />}
                tint={TINT.loyalty}
                onToggle={(open) => {
                  if (!open) return;
                  tapped();
                  if (isRewardsOnly(venue)) track("rewards_join_shown", { context: "home" });
                  else track("loyalty_signup_shown");
                }}
              >
                {isRewardsOnly(venue) ? <RewardsSheet /> : <LoyaltySheet />}
              </ExpandableCard>
            );

          case "menu": {
            const menu = primaryMenu(venue);
            const external = sanitiseExternalUrl(menuExternalUrl(venue));
            const custom = !!menu?.linkLabelCustom?.trim();
            return (
              <ActionCard
                key={feature}
                feature={feature}
                label={linkLabel(menu?.linkLabelToken, menu?.linkLabelCustom, t, "feature_menu")}
                icon={<MenuCardIcon token={menu?.linkLabelToken} custom={custom} />}
                tint={TINT.menu}
                onActivate={() => {
                  tapped();
                  if (external) {
                    track("menu_external_url_tapped", { label_token: menu?.linkLabelToken ?? null, is_custom: custom });
                    // Without "noopener" in the features string, a blocked popup is detectable (null).
                    const opened = window.open(external, "_blank");
                    if (opened) opened.opener = null;
                    else window.location.href = external;
                    return;
                  }
                  router.push(`/menu${window.location.search}`);
                }}
              />
            );
          }

          case "wifi":
            return (
              <ExpandableCard key={feature} feature={feature} label={t("feature_wifi")} icon={<FeatureGlyphs.wifi aria-hidden strokeWidth={2} />} tint={TINT.wifi} onToggle={(open) => open && tapped()}>
                <WifiSheet />
              </ExpandableCard>
            );

          case "sudoku":
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={t("feature_sudoku")}
                icon={<FeatureGlyphs.sudoku aria-hidden strokeWidth={2} />}
                tint={theme.isLightCards ? "#7D59D9" : "#B79BFF"}
                lazy
                onToggle={(open) => open && tapped()}
              >
                <SudokuSheet />
              </ExpandableCard>
            );

          case "feedback": {
            const Glyph = feedbackVariant === "anon" ? FeatureGlyphs.feedback : FeatureGlyphs.suggestionBox;
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={t(feedbackVariant === "anon" ? "feature_feedback_anon" : "feature_feedback_box")}
                icon={<Glyph aria-hidden strokeWidth={2} />}
                tint={theme.accentBlue}
                onToggle={(open) => {
                  if (!open) return;
                  focusFeedbackKeepingKeyboard();
                  tapped();
                  track("feedback_cta_tapped", { variant: `cta_${feedbackVariant}` });
                  track("feedback_expanded");
                }}
              >
                <FeedbackSheet />
              </ExpandableCard>
            );
          }

          case "google_review":
            return (
              <ActionCard
                key={feature}
                feature={feature}
                label={t("feature_google_review")}
                icon={<GoogleG />}
                tint={null}
                onActivate={() => {
                  tapped();
                  review.open("landing_page");
                }}
              />
            );

          default: {
            const link = findExternalLink(venue, feature as LinkFeature);
            const href = sanitiseExternalUrl(link?.url);
            if (!link || !href) return null;
            const isCustom = !!link.labelCustom?.trim();
            return (
              <LinkCard
                key={feature}
                href={href}
                label={linkLabel(link.labelToken, link.labelCustom, t, "feature_menu_website")}
                icon={<LinkIconGlyph token={linkIconToken(link.icon)} />}
                tint={TINT.link}
                onClick={() => {
                  tapped();
                  track("external_link_tapped", { link_id: link.id, label_token: link.labelToken ?? null, is_custom: isCustom, position });
                }}
              />
            );
          }
        }
      })}
    </div>
  );
}

export interface LandingAppProps {
  venue: PublicVenue;
  locale: Locale;
  /** The `s` query param: which QR code / table was scanned. */
  source: string;
  feedbackVariant: FeedbackVariant;
  /** The bucket was freshly drawn on the server and must be remembered. */
  persistVariant: boolean;
}

/**
 * The customer landing page: header, feature cards, social row, footer.
 * The venue arrives server-rendered, so there is no loading flash and the
 * theme is already applied by the time this hydrates.
 */
export function LandingApp({ venue, locale, source, feedbackVariant, persistVariant }: LandingAppProps) {
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);
  const track = useMemo(() => createTracker({ venueId: venue.id, source, page: "s" }), [venue.id, source]);
  const theme = useMemo(() => computeTheme(venue.branding), [venue.branding]);
  const features = useMemo(() => buildFeatures(venue), [venue]);

  // Device memory lives in localStorage, which the server can't see.
  const rememberedCustomerId = useSyncExternalStore(subscribeNever, () => deviceMemory.customerId(venue.id), () => null);
  const [joinedCustomerId, setJoinedCustomerId] = useState<string | null>(null);
  const knownCustomerId = joinedCustomerId ?? rememberedCustomerId;
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loyaltyDone, setLoyaltyDoneState] = useState(false);
  const [dialog, setDialog] = useState<DialogContent | null>(null);

  // An invite link (`?ref=`) counts if the friend joins at any point in this visit.
  useEffect(() => rememberReferral(venue.id), [venue.id]);

  useEffect(() => {
    if (persistVariant) document.cookie = `${FEEDBACK_VARIANT_COOKIE}=${feedbackVariant}; path=/; max-age=31536000; SameSite=Lax`;
  }, [persistVariant, feedbackVariant]);

  useEffect(() => {
    track("screen_viewed", { screen_name: "landing" });
    track("landing_opened", { features_shown: features.join(","), landing_variant: `cta_${feedbackVariant}` });
    const external = menuExternalUrl(venue);
    if (external && !sanitiseExternalUrl(external)) track("menu_external_url_open_failed", { reason: "invalid_url" });
    // Once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const session = useMemo<LandingSession>(
    () => ({
      venue,
      locale,
      t,
      tf,
      track,
      source,
      theme,
      feedbackVariant,
      knownCustomerId,
      rememberCustomer: setJoinedCustomerId,
      membership,
      setMembership,
      loyaltyDone,
      setLoyaltyDone: () => setLoyaltyDoneState(true),
      showDialog: setDialog,
    }),
    [venue, locale, t, tf, track, source, theme, feedbackVariant, knownCustomerId, membership, loyaltyDone],
  );

  return (
    <LandingContext.Provider value={session}>
      <div className="landing" data-style={theme.style ?? undefined}>
        <main className="page-wrapper">
          <Header venue={venue} />
          {venue.announcement?.text && (
            <p className="announcement" role="note">
              <Megaphone aria-hidden />
              <span>{venue.announcement.text}</span>
            </p>
          )}
          <FeatureList features={features} />
          <SocialLinks context="landing" className="landing-row" />
          {venue.showPoweredBy !== false && (
            <Link className="powered-by" href="/" aria-label={tf("powered_by", { brand: BRAND.name })}>
              <BrandMark />
              {BRAND.name}
            </Link>
          )}
        </main>
      </div>
      <AppDialog content={dialog} okLabel={t("ok")} onClose={() => setDialog(null)} />
    </LandingContext.Provider>
  );
}

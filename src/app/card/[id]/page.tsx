import type { Metadata } from "next";
import { CardLive } from "@/components/card/CardLive";
import { InviteFriend } from "@/components/card/InviteFriend";
import { FilledHeart } from "@/components/icons";
import { ThemeStyle } from "@/components/ThemeStyle";
import { createTranslator } from "@/lib/i18n";
import { hasLoyaltyProgram, safeImageUrl } from "@/lib/venue/features";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import { findCardForViewer } from "@/server/repositories/loyalty-cards";
import { ensureReferralCode } from "@/server/repositories/retention";
import { findVenue } from "@/server/repositories/venues";
import { firstParam, requestLocale, serverOrigin } from "@/server/request";
import { qrSvg } from "@/server/services/qr";
import "@/styles/landing.css";
import "@/styles/pages.css";

export const metadata: Metadata = {
  title: "Your card",
  robots: { index: false, follow: false },
  // The URL carries the card's access token; never send it onwards.
  referrer: "no-referrer",
};

/** Largest stamp grid drawn; bigger programmes show progress as text only. */
const MAX_DRAWN_STAMPS = 20;

/** `/card/<id>?t=<token>` — the member's card, linked from their enrolment email. */
export default async function CardPage({ params, searchParams }: PageProps<"/card/[id]">) {
  const { id } = await params;
  const token = firstParam((await searchParams).t);
  const locale = await requestLocale();
  const { t, tf } = createTranslator(locale);

  const card = token ? findCardForViewer(id, token) : null;
  const venue = card ? findVenue(card.venue_id) : null;
  if (!card || !venue) {
    return (
      <main className="page-wrapper simple-page">
        <div className="error-box" role="alert">
          {t("card_not_found")}
        </div>
      </main>
    );
  }

  const logo = safeImageUrl(venue.branding.logoUrl);
  const holder = card.first_name?.trim() || card.name?.trim() || "";
  const program = hasLoyaltyProgram(venue) ? venue.loyaltyProgram! : null;
  const tiers = programTiers(program);
  const goal = stampGoal(tiers);
  // Staff scan this on a paired till device; the device pairing is what authorises the stamp.
  const origin = await serverOrigin();
  const staffQr = program ? await qrSvg(`${origin}/staff/stamp?c=${card.id}`) : null;
  const referral = program?.referral?.enabled ? program.referral : null;
  const inviteUrl = referral ? `${origin}/s?i=${encodeURIComponent(venue.shortCode)}&ref=${ensureReferralCode(card.id)}&s=invite` : null;
  const nextTier = tiers.find((tier) => card.stamps < tier.stampsRequired);
  const readyTier = [...tiers].reverse().find((tier) => card.stamps >= tier.stampsRequired);
  const since = new Date(`${card.created_at.replace(" ", "T")}Z`);
  const sinceText = Number.isNaN(since.getTime()) ? "" : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(since);

  return (
    <>
      <ThemeStyle branding={venue.branding} />
      <main className="page-wrapper simple-page">
        <article className="member-card">
          <div className="member-card-head">
            {logo ? (
              <div className="member-card-logo">
                {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
                <img src={logo} alt="" />
              </div>
            ) : (
              <div className="member-card-logo heart">
                <FilledHeart />
              </div>
            )}
            <div>
              <h1>{venue.name}</h1>
              <p>{holder ? tf("card_greeting", { name: holder }) : t("card_title")}</p>
            </div>
          </div>

          {program ? (
            <>
              {goal > 0 && goal <= MAX_DRAWN_STAMPS && (
                <ol className="stamp-grid" aria-label={tf("card_progress", { stamps: Math.min(card.stamps, goal), required: goal })}>
                  {Array.from({ length: goal }, (_, i) => (
                    <li key={i} className={i < card.stamps ? "filled" : ""}>
                      {i < card.stamps ? <FilledHeart /> : i + 1}
                    </li>
                  ))}
                </ol>
              )}
              <p className="member-card-progress">{tf("card_progress", { stamps: Math.min(card.stamps, goal), required: goal })}</p>
              {readyTier && <p className="member-card-ready">{tf("card_reward_ready", { reward: readyTier.rewardName })}</p>}
              {nextTier && !readyTier && (
                <p className="sub-text">{tf("card_next_reward", { count: nextTier.stampsRequired - card.stamps, reward: nextTier.rewardName })}</p>
              )}
              {tiers.length > 1 && (
                <ul className="tier-list">
                  {tiers.map((tier) => (
                    <li key={`${tier.rewardName}-${tier.stampsRequired}`} className={card.stamps >= tier.stampsRequired ? "unlocked" : ""}>
                      <span>{tier.rewardName}</span>
                      <span>{card.stamps >= tier.stampsRequired ? t("card_unlocked") : `${tier.stampsRequired}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            sinceText && <p className="member-card-progress">{tf("card_member", { date: sinceText })}</p>
          )}

          <CardLive
            venueId={venue.id}
            cardId={card.id}
            token={token}
            stamps={card.stamps}
            qrSvg={staffQr}
            labels={{ show: t("card_show_staff"), hide: t("card_hide_staff"), hint: t("card_staff_hint"), added: t("card_stamp_added"), redeemed: t("card_reward_used") }}
          />
          {referral && inviteUrl && (
            <InviteFriend
              url={inviteUrl}
              venueName={venue.name}
              labels={{
                title: t("card_invite_title"),
                body:
                  tf("card_invite_body", { stamps: referral.referrerStamps }) +
                  (referral.friendStamps > 0 ? ` ${tf("card_invite_friend", { stamps: referral.friendStamps })}` : ""),
                share: t("card_invite_share"),
                copied: t("copied"),
              }}
            />
          )}
          <p className="member-card-foot">{program ? t("card_show") : t("card_show_rewards")}</p>
          <p className="member-card-number">{tf("card_number", { number: card.id.slice(-8).toUpperCase() })}</p>
        </article>
      </main>
    </>
  );
}

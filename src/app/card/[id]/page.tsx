import type { Metadata } from "next";
import { FilledHeart } from "@/components/icons";
import { ThemeStyle } from "@/components/ThemeStyle";
import { createTranslator } from "@/lib/i18n";
import { hasLoyaltyProgram, safeImageUrl } from "@/lib/venue/features";
import type { LoyaltyProgram } from "@/lib/venue/types";
import { findCardForViewer } from "@/server/repositories/loyalty-cards";
import { findVenue } from "@/server/repositories/venues";
import { firstParam, requestLocale } from "@/server/request";
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

function tiersOf(program: LoyaltyProgram) {
  const tiers = program.rewardTiers?.length ? program.rewardTiers : [{ rewardName: program.rewardName, stampsRequired: program.stampsRequired }];
  return [...tiers].filter((tier) => tier.stampsRequired > 0).sort((a, b) => a.stampsRequired - b.stampsRequired);
}

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
  const tiers = program ? tiersOf(program) : [];
  const goal = tiers.length ? tiers[tiers.length - 1].stampsRequired : 0;
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

          <p className="member-card-foot">{program ? t("card_show") : t("card_show_rewards")}</p>
          <p className="member-card-number">{tf("card_number", { number: card.id.slice(-8).toUpperCase() })}</p>
        </article>
      </main>
    </>
  );
}

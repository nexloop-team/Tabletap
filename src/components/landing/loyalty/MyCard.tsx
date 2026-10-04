"use client";

import { QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InviteFriend } from "@/components/card/InviteFriend";
import { FilledHeart } from "@/components/icons";
import { api, ApiRequestError } from "@/lib/api/client";
import type { MemberCardView } from "@/lib/api/contracts";
import { deviceMemory, type CardCredentials } from "@/lib/browser";
import { useLanding } from "../LandingContext";

const POLL_MS = 5000;
const MAX_DRAWN_STAMPS = 20;

/**
 * The member's card, right on the venue's page: stamps, rewards, the code
 * staff scan, and the invite link. Refreshes while it's on screen so a
 * stamp added at the till shows up straight away.
 */
export function MyCard({ credentials, active = true, onMissing }: { credentials: CardCredentials; active?: boolean; onMissing?: () => void }) {
  const { venue, t, tf, track } = useLanding();
  const [card, setCard] = useState<MemberCardView | null>(null);
  const [failed, setFailed] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const known = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await api.getCard(credentials.cardId, credentials.token);
        if (stopped) return;
        if (known.current !== null && next.stamps !== known.current) {
          setToast(next.stamps > known.current ? tf("card_stamp_added", { count: next.stamps - known.current }) : t("card_reward_used"));
          setTimeout(() => setToast(null), 4000);
        }
        known.current = next.stamps;
        setCard(next);
        setFailed(false);
      } catch (error) {
        if (stopped) return;
        if (error instanceof ApiRequestError && error.status === 404) {
          // The card was removed (or the venue reset it): stop showing it here.
          deviceMemory.forgetCard(venue.id);
          onMissing?.();
        }
        setFailed(true);
      }
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, credentials.cardId, credentials.token, venue.id, t, tf, onMissing]);

  if (!card) return <p className="sub-text my-card-status">{failed ? t("card_not_found") : t("loading")}</p>;

  const next = card.tiers.find((tier) => !tier.unlocked);
  const ready = [...card.tiers].reverse().find((tier) => tier.unlocked);

  return (
    <div className="my-card">
      {toast && (
        <div className="card-toast" role="status">
          {toast}
        </div>
      )}
      <p className="my-card-holder">{card.holder ? tf("card_greeting", { name: card.holder }) : t("card_title")}</p>

      {card.goal > 0 && (
        <>
          {card.goal <= MAX_DRAWN_STAMPS && (
            <ol
              className="stamp-grid"
              style={{ gridTemplateColumns: `repeat(${Math.min(card.goal, 5)}, minmax(0, 56px))`, justifyContent: "center" }}
              aria-label={tf("card_progress", { stamps: Math.min(card.stamps, card.goal), required: card.goal })}>
              {Array.from({ length: card.goal }, (_, i) => (
                <li key={i} className={i < card.stamps ? "filled" : ""}>
                  {i < card.stamps ? <FilledHeart /> : i + 1}
                </li>
              ))}
            </ol>
          )}
          <p className="member-card-progress">{tf("card_progress", { stamps: Math.min(card.stamps, card.goal), required: card.goal })}</p>
          {ready && <p className="member-card-ready">{tf("card_reward_ready", { reward: ready.rewardName })}</p>}
          {next && !ready && <p className="sub-text">{tf("card_next_reward", { count: next.stampsRequired - card.stamps, reward: next.rewardName })}</p>}
          {card.tiers.length > 1 && (
            <ul className="tier-list">
              {card.tiers.map((tier) => (
                <li key={`${tier.rewardName}-${tier.stampsRequired}`} className={tier.unlocked ? "unlocked" : ""}>
                  <span>{tier.rewardName}</span>
                  <span>{tier.unlocked ? t("card_unlocked") : `${tier.stampsRequired}`}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {card.staffQrSvg && (
        <div className="card-staff">
          {showCode ? (
            <>
              <div className="card-staff-qr" dangerouslySetInnerHTML={{ __html: card.staffQrSvg }} />
              <p className="sub-text">{t("card_staff_hint")}</p>
              <button type="button" className="card-staff-btn secondary" onClick={() => setShowCode(false)}>
                {t("card_hide_staff")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="card-staff-btn"
              onClick={() => {
                setShowCode(true);
                track("card_staff_code_shown", { context: "landing" });
              }}
            >
              <QrCode aria-hidden />
              {t("card_show_staff")}
            </button>
          )}
        </div>
      )}

      {card.invite && (
        <InviteFriend
          url={card.invite.url}
          venueName={card.venueName}
          labels={{
            title: t("card_invite_title"),
            body:
              tf("card_invite_body", { stamps: card.invite.referrerStamps }) +
              (card.invite.friendStamps > 0 ? ` ${tf("card_invite_friend", { stamps: card.invite.friendStamps })}` : ""),
            share: t("card_invite_share"),
            copied: t("copied"),
          }}
        />
      )}
    </div>
  );
}

/** Joined just now (e.g. after feedback or the Wi-Fi offer): open the card in place rather than a new page. */
export function MyCardToggle({ credentials }: { credentials: CardCredentials }) {
  const { t } = useLanding();
  const [open, setOpen] = useState(false);
  return open ? (
    <MyCard credentials={credentials} />
  ) : (
    <button type="button" className="wallet-btn" onClick={() => setOpen(true)}>
      {t("view_card")}
    </button>
  );
}

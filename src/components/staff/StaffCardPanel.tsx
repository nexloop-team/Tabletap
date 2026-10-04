"use client";

import { Gift, Loader2, Minus, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { StaffCardView } from "@/lib/api/staff-contracts";

/** The till screen for one card: add stamps, hand out a reward, or undo a slip. */
export function StaffCardPanel({ initial }: { initial: StaffCardView }) {
  const [card, setCard] = useState(initial);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const [confirmAnother, setConfirmAnother] = useState<string | null>(null);

  async function act(run: () => Promise<StaffCardView>, done: (next: StaffCardView) => string) {
    setBusy(true);
    setMessage(null);
    setConfirmAnother(null);
    try {
      const next = await run();
      setCard(next);
      setCount(1);
      setMessage({ tone: "ok", text: done(next) });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) setConfirmAnother(error.message);
      else setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const stamp = (force = false) =>
    act(
      () => dashboardApi.staffStamp({ cardId: card.cardId, count, force }),
      (next) => `Added ${next.stamps - card.stamps} stamp${next.stamps - card.stamps === 1 ? "" : "s"}. ${next.stamps}/${next.goal} now.`,
    );
  const unlocked = card.tiers.filter((tier) => tier.unlocked);
  const room = Math.max(0, card.goal - card.stamps);

  return (
    <div className="staff-panel">
      <section className="card staff-guest">
        <div className="hint">{card.venueName} member</div>
        <h1>{card.guestName || "Guest"}</h1>
        <p className="muted">{card.guestEmail}</p>
        <div className="staff-count" aria-live="polite">
          <strong>{card.stamps}</strong>
          <span>/ {card.goal} stamps</span>
        </div>
        <ol className="staff-dots" aria-hidden>
          {Array.from({ length: Math.min(card.goal, 30) }, (_, i) => (
            <li key={i} className={i < card.stamps ? "on" : ""} />
          ))}
        </ol>
      </section>

      {message && (
        <div className={`notice notice-${message.tone}`} role="status">
          {message.text}
        </div>
      )}
      {confirmAnother && (
        <div className="notice notice-warn" role="alert">
          <span>{confirmAnother}</span>
          <button type="button" className="btn btn-sm" onClick={() => stamp(true)} disabled={busy}>
            Yes, add stamp
          </button>
        </div>
      )}

      {unlocked.length > 0 && (
        <section className="card">
          <h2 className="staff-h2">
            <Gift aria-hidden /> Reward ready
          </h2>
          <div className="stack">
            {unlocked.map((tier) => (
              <button
                key={tier.index}
                type="button"
                className="btn btn-primary btn-block staff-big"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Give ${tier.rewardName} now? This uses ${tier.stampsRequired} stamps.`)) return;
                  void act(() => dashboardApi.staffRedeem({ cardId: card.cardId, tierIndex: tier.index }), () => `${tier.rewardName} redeemed. Enjoy!`);
                }}
              >
                Redeem {tier.rewardName} ({tier.stampsRequired} stamps)
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        {room === 0 ? (
          <p className="muted">This card is full. Redeem the reward to start collecting again.</p>
        ) : (
          <>
            <div className="staff-stepper">
              <button type="button" className="btn btn-icon" aria-label="Fewer stamps" disabled={busy || count <= 1} onClick={() => setCount((c) => c - 1)}>
                <Minus aria-hidden />
              </button>
              <span aria-live="polite">{count}</span>
              <button type="button" className="btn btn-icon" aria-label="More stamps" disabled={busy || count >= Math.min(5, room)} onClick={() => setCount((c) => c + 1)}>
                <Plus aria-hidden />
              </button>
            </div>
            <button type="button" className="btn btn-primary btn-block staff-big" disabled={busy} onClick={() => stamp()}>
              {busy ? <Loader2 className="spin" aria-hidden /> : <Plus aria-hidden />}
              Add {count} stamp{count === 1 ? "" : "s"}
            </button>
          </>
        )}
        {card.undoable && (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() => act(() => dashboardApi.staffUndo({ cardId: card.cardId }), () => "Undone.")}
          >
            <Undo2 aria-hidden /> Undo last {card.undoable.kind === "redeem" ? `reward (${card.undoable.rewardName})` : `stamp${card.undoable.delta === 1 ? "" : "s"}`}
          </button>
        )}
      </section>
    </div>
  );
}

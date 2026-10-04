"use client";

import { QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deviceMemory } from "@/lib/browser";

const POLL_MS = 5000;

/**
 * The member card's live part: the "Show to staff" code, and a quiet poll
 * that notices stamps added at the till and refreshes the card with a toast.
 */
export function CardLive({
  venueId,
  cardId,
  token,
  stamps,
  qrSvg,
  labels,
}: {
  venueId: string;
  cardId: string;
  token: string;
  stamps: number;
  /** Server-generated QR for staff; null when the venue has no stamp card. */
  qrSvg: string | null;
  labels: { show: string; hide: string; hint: string; added: string; redeemed: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const known = useRef(stamps);

  useEffect(() => {
    known.current = stamps;
  }, [stamps]);

  // Opening the emailed link teaches this phone the card, so the venue's
  // own page shows it from now on instead of the join form.
  useEffect(() => deviceMemory.rememberCard(venueId, { cardId, token }), [venueId, cardId, token]);

  useEffect(() => {
    if (!qrSvg) return;
    let stopped = false;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { stamps: latest } = (await response.json()) as { stamps: number };
        if (latest === known.current) return;
        const diff = latest - known.current;
        known.current = latest;
        setToast(diff > 0 ? labels.added.replace("{count}", String(diff)) : labels.redeemed);
        setTimeout(() => setToast(null), 4000);
        router.refresh();
      } catch {
        /* offline at the till is fine; try again next tick */
      }
    }
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [cardId, token, qrSvg, labels.added, labels.redeemed, router]);

  if (!qrSvg) return null;
  return (
    <div className="card-staff">
      {toast && (
        <div className="card-toast" role="status">
          {toast}
        </div>
      )}
      {open ? (
        <>
          <div className="card-staff-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="sub-text">{labels.hint}</p>
          <button type="button" className="card-staff-btn secondary" onClick={() => setOpen(false)}>
            {labels.hide}
          </button>
        </>
      ) : (
        <button type="button" className="card-staff-btn" onClick={() => setOpen(true)}>
          <QrCode aria-hidden />
          {labels.show}
        </button>
      )}
    </div>
  );
}

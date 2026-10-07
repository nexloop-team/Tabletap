"use client";

import { Ban, Crown, ExternalLink, LayoutDashboard, Loader2, MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ToggleEvent } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { AdminVenueRequest } from "@/lib/api/account-contracts";
import { useConfirm, type ConfirmOptions } from "./confirm";

/** Row actions for a venue in the operator console: open it, plus a menu of account changes behind a confirm. */
export function AdminVenueActions({
  venueId,
  name,
  guestUrl,
  status,
  plan,
}: {
  venueId: string;
  name: string;
  guestUrl: string;
  status: "active" | "suspended";
  plan: "free" | "pro";
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const onScroll = useRef<(() => void) | null>(null);

  /** The menu lives in the top layer (so the scrolling table can't clip it); pin it under the trigger, flipping up near the bottom. */
  function place() {
    const box = trigger.current?.getBoundingClientRect();
    const el = menu.current;
    if (!box || !el) return;
    const below = box.bottom + 4 + el.offsetHeight <= window.innerHeight;
    el.style.top = `${below ? box.bottom + 4 : Math.max(8, box.top - 4 - el.offsetHeight)}px`;
    el.style.left = `${Math.max(8, Math.min(box.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8))}px`;
  }

  function onToggle(event: ToggleEvent<HTMLDivElement>) {
    if (event.newState === "open") {
      place();
      onScroll.current = () => menu.current?.hidePopover();
      window.addEventListener("scroll", onScroll.current, { capture: true, passive: true });
      window.addEventListener("resize", onScroll.current, { passive: true });
    } else if (onScroll.current) {
      window.removeEventListener("scroll", onScroll.current, { capture: true });
      window.removeEventListener("resize", onScroll.current);
      onScroll.current = null;
    }
  }

  async function apply(body: AdminVenueRequest, question: ConfirmOptions) {
    menu.current?.hidePopover();
    if (!(await confirm(question))) return;
    setPending(true);
    setError(null);
    try {
      await dashboardApi.adminUpdateVenue(venueId, body);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="row-actions">
      <div className="inline nowrap">
        <Link className="btn btn-sm" href={`/dashboard/${venueId}`} title="See the owner's dashboard, read-only">
          View as owner
        </Link>
        <button
          ref={trigger}
          type="button"
          className="btn btn-sm btn-icon"
          popoverTarget={menuId}
          aria-label={`More actions for ${name}`}
          disabled={pending}
        >
          {pending ? <Loader2 className="spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
        </button>
      </div>
      <div ref={menu} id={menuId} popover="auto" className="menu" onToggle={onToggle}>
        <Link className="menu-item" href={`/dashboard/${venueId}`}>
          <LayoutDashboard aria-hidden /> View as owner (read-only)
        </Link>
        <a className="menu-item" href={guestUrl} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden /> View guest page
        </a>
        <div className="menu-sep" role="separator" />
        {plan === "pro" ? (
          <button
            type="button"
            className="menu-item"
            onClick={() =>
              apply(
                { plan: "free" },
                { title: `Remove Pro from ${name}?`, body: "Loyalty, guest capture and other Pro features switch off. This doesn't cancel a Stripe subscription.", confirmLabel: "Remove Pro", danger: true },
              )
            }
          >
            <XCircle aria-hidden /> Remove Pro
          </button>
        ) : (
          <button
            type="button"
            className="menu-item"
            onClick={() => apply({ plan: "pro" }, { title: `Give ${name} Pro for free?`, body: "Every Pro feature switches on straight away, with no charge.", confirmLabel: "Comp Pro" })}
          >
            <Crown aria-hidden /> Comp Pro
          </button>
        )}
        {status === "active" ? (
          <button
            type="button"
            className="menu-item danger"
            onClick={() =>
              apply({ status: "suspended" }, { title: `Suspend ${name}?`, body: "Its guest page goes offline for every QR code until you restore it.", confirmLabel: "Suspend venue", danger: true })
            }
          >
            <Ban aria-hidden /> Suspend venue
          </button>
        ) : (
          <button
            type="button"
            className="menu-item"
            onClick={() => apply({ status: "active" }, { title: `Restore ${name}?`, body: "Its guest page comes back online straight away.", confirmLabel: "Restore venue" })}
          >
            <RotateCcw aria-hidden /> Restore venue
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

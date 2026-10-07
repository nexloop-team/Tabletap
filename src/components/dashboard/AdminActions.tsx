"use client";

import { Ban, CalendarPlus, ExternalLink, Gift, LayoutDashboard, Loader2, MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ToggleEvent } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { AdminVenueRequest } from "@/lib/api/account-contracts";
import type { VenueSegment } from "@/server/admin";
import { useConfirm, type ConfirmOptions } from "./confirm";

const TRIAL_EXTENSION_DAYS = 7;

/** Row actions for a venue in the operator console: open it, plus a menu of account changes behind a confirm. */
export function AdminVenueActions({
  venueId,
  name,
  guestUrl,
  status,
  segment,
}: {
  venueId: string;
  name: string;
  guestUrl: string;
  status: "active" | "suspended";
  segment: VenueSegment;
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
        <Link className="btn btn-sm" href={`/dashboard/${venueId}`} title="View as owner (read-only)" aria-label={`View ${name} as owner (read-only)`}>
          View
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
        {segment === "free" && (
          <button
            type="button"
            className="menu-item"
            onClick={() =>
              apply(
                { freeAccess: false },
                { title: `Remove free access from ${name}?`, body: "Unless it subscribes or still has trial days left, its guest page goes offline straight away.", confirmLabel: "Remove access", danger: true },
              )
            }
          >
            <XCircle aria-hidden /> Remove free access
          </button>
        )}
        {(segment === "trial" || segment === "unpaid") && (
          <>
            <button
              type="button"
              className="menu-item"
              onClick={() =>
                apply(
                  { extendTrialDays: TRIAL_EXTENSION_DAYS },
                  {
                    title: `Give ${name} ${TRIAL_EXTENSION_DAYS} more trial days?`,
                    body: segment === "unpaid" ? "Its trial restarts from today, so the guest page comes back online now." : "They're added to the end of the current trial.",
                    confirmLabel: "Extend trial",
                  },
                )
              }
            >
              <CalendarPlus aria-hidden /> Extend trial by {TRIAL_EXTENSION_DAYS} days
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => apply({ freeAccess: true }, { title: `Give ${name} free access?`, body: "Every feature stays on with no charge until you remove it.", confirmLabel: "Give free access" })}
            >
              <Gift aria-hidden /> Give free access
            </button>
          </>
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

import { AlertTriangle, Ban, CheckCircle2, Clock, Gift, PowerOff } from "lucide-react";
import type { AdminVenue } from "@/server/admin";

/** Subscription state for a venue row. Icon + text, never colour alone. */
export function SegmentBadge({ venue }: { venue: AdminVenue }) {
  if (venue.segment === "suspended")
    return (
      <span className="badge badge-danger">
        <Ban aria-hidden /> Suspended
      </span>
    );
  if (venue.pastDue)
    return (
      <span className="badge badge-warn">
        <AlertTriangle aria-hidden /> Payment failing
      </span>
    );
  if (venue.segment === "paying")
    return (
      <span className="badge badge-ok">
        <CheckCircle2 aria-hidden /> Paying
      </span>
    );
  if (venue.segment === "free")
    return (
      <span className="badge badge-pro">
        <Gift aria-hidden /> Free access
      </span>
    );
  if (venue.segment === "trial")
    return (
      <span className="badge badge-info">
        <Clock aria-hidden /> Trial{venue.trialDays !== null ? ` · ${venue.trialDays}d left` : ""}
      </span>
    );
  return (
    <span className="badge badge-danger">
      <PowerOff aria-hidden /> Unpaid · offline
    </span>
  );
}

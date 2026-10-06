import { AlertTriangle, Ban, Clock, Crown } from "lucide-react";
import type { AdminVenue } from "@/server/admin";

/** Plan and billing state for a venue row. Icon + text, never colour alone. */
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
      <span className="badge badge-pro">
        <Crown aria-hidden /> Pro
      </span>
    );
  if (venue.segment === "trial")
    return (
      <span className="badge badge-info">
        <Clock aria-hidden /> Trial{venue.trialDays !== null ? ` · ${venue.trialDays}d left` : ""}
      </span>
    );
  return <span className="badge">Free</span>;
}

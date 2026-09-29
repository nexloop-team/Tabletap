"use client";

import { useCallback } from "react";
import { copyToClipboard } from "@/lib/browser";
import { sanitiseExternalUrl } from "@/lib/venue/features";
import { useLanding } from "./LandingContext";

/** Demo venues point at the reserved `.invalid` TLD; those links explain themselves instead of leaving. */
function isPlaceholder(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".invalid");
  } catch {
    return false;
  }
}

/**
 * Opens the venue's Google review form. With `feedbackText`, the guest's
 * feedback is copied first so they can paste it into the review.
 */
export function useGoogleReview() {
  const { venue, t, track, showDialog } = useLanding();
  const url = sanitiseExternalUrl(venue.socialLinks.google);

  const open = useCallback(
    (fromContext: string, feedbackText?: string) => {
      if (!url) return;
      if (feedbackText) void copyToClipboard(feedbackText).catch(() => {});
      const placeholder = isPlaceholder(url);
      track("google_review_tapped", { from_context: fromContext, placeholder });
      if (placeholder) {
        showDialog({ title: t("demo_reviews_title"), message: t("demo_reviews_body") });
        return;
      }
      window.open(url, "_blank", "noopener");
    },
    [url, t, track, showDialog],
  );

  return { url, open };
}

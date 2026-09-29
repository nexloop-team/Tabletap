"use client";

import { useEffect, useState } from "react";
import { hasLoyaltyProgram, isRewardsOnly } from "@/lib/venue/features";
import { useSheet } from "../FeatureCard";
import { SuccessPanel } from "../forms";
import { useLanding } from "../LandingContext";
import { RewardsJoinForm, RewardsJoinedPanel } from "../loyalty/RewardsJoinForm";
import { SocialLinks, hasSocialLinks } from "../SocialLinks";
import { useGoogleReview } from "../useGoogleReview";
import { FreeStampJoin } from "./FreeStampJoin";

/** Positive enough to ask for a public review. */
const POSITIVE_THRESHOLD = 0.5;

function GoogleReviewButton({ feedbackText, context }: { feedbackText: string; context: string }) {
  const { t } = useLanding();
  const review = useGoogleReview();
  return (
    <button type="button" className="google-btn" onClick={() => review.open(context, feedbackText)}>
      {t("leave_google_review")}
    </button>
  );
}

/** The softer, secondary review ask shown beneath a loyalty prompt. */
function ReviewNudge({ feedbackText, context }: { feedbackText: string; context: string }) {
  const { t } = useLanding();
  return (
    <div className="review-prompt">
      <p>{t("tap_to_review")}</p>
      <GoogleReviewButton feedbackText={feedbackText} context={context} />
    </div>
  );
}

/**
 * After feedback, route the guest by sentiment. The first matching branch wins:
 *  1. stamp card not yet joined → free-stamp join (+ review nudge if positive)
 *  2. rewards-only, not joined  → rewards join (+ review nudge if positive)
 *  3. positive + Google link    → Google review as the main ask, socials below
 *  4. positive, socials only    → social links
 *  otherwise just the thank-you.
 */
export function FeedbackThankYou({ text, score }: { text: string; score: number }) {
  const { venue, t, tf, track, loyaltyDone, membership } = useLanding();
  const { close } = useSheet();
  const review = useGoogleReview();

  const positive = score > POSITIVE_THRESHOLD;
  const showGoogle = positive && !!review.url;
  // Decided once, when the thank-you appears: joining below must not swap the branch out from under the guest.
  const [branch] = useState(() => {
    if (hasLoyaltyProgram(venue) && !loyaltyDone) return "loyalty";
    if (isRewardsOnly(venue) && venue.crm.feedbackCapture && !membership) return "rewards";
    if (showGoogle) return "google";
    if (positive && hasSocialLinks(venue.socialLinks)) return "social";
    return "none";
  });

  useEffect(() => {
    if (showGoogle) track("google_review_prompted", { from_context: "thankyou" });
    if (branch === "rewards") track("rewards_join_shown", { context: "feedback" });
    // Reported once, when the thank-you appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="feedback-thanks">
      <SuccessPanel icon="check" title={t("thank_you")} onClose={close}>
        <p>{t("feedback_sent")}</p>

        {branch === "loyalty" && (
          <>
            <div className="review-prompt">
              <FreeStampJoin />
            </div>
            {showGoogle && <ReviewNudge feedbackText={text} context="loyalty" />}
          </>
        )}

        {branch === "rewards" && (
          <>
            <div className="review-prompt">
              {membership ? (
                <RewardsJoinedPanel membership={membership} />
              ) : (
                <>
                  <p>{tf("rewards_thankyou_prompt", { business: venue.name })}</p>
                  <RewardsJoinForm door="feedback" withBirthday={false} />
                </>
              )}
            </div>
            {showGoogle && <ReviewNudge feedbackText={text} context="thankyou" />}
          </>
        )}

        {branch === "google" && (
          <>
            <p style={{ marginTop: 8 }}>{t("tap_to_review")}</p>
            <GoogleReviewButton feedbackText={text} context="thankyou" />
            <SocialLinks context="thankyou" />
          </>
        )}

        {branch === "social" && (
          <>
            <p style={{ marginTop: 8 }}>{t("glad_enjoyed")}</p>
            <SocialLinks context="thankyou" />
          </>
        )}
      </SuccessPanel>
    </div>
  );
}

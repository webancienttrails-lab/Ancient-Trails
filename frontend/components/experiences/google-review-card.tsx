import type { ReactNode } from "react";
import { resolveGoogleReviewUrl, type GoogleBusinessReviewsSettings } from "../../lib/google-review-url";

export function GoogleReviewCard({ googleReviewUrl, businessReviews, reviewerName, className, children }: {
  googleReviewUrl?: string;
  businessReviews?: GoogleBusinessReviewsSettings;
  reviewerName: string;
  className?: string;
  children: ReactNode;
}) {
  const href = resolveGoogleReviewUrl(googleReviewUrl, businessReviews);
  const Element = href ? "a" : "article";
  return (
    <Element className={className} href={href || undefined} target={href ? "_blank" : undefined}
      rel={href ? "noopener noreferrer" : undefined}
      aria-label={href ? "Read " + reviewerName + "'s review on Google (opens in a new tab)" : undefined}>
      {children}
    </Element>
  );
}

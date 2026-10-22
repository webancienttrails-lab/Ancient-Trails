"use client";

import { useEffect, useState } from "react";
import { formatReviewTime, getReviewTimestamp, getReviewTimeLabel } from "../../lib/review-time";

export function ReviewTimestamp({ googleReviewPublishedAt, googleReviewTimeDescription, googleReviewUrl, createdAt, className }: {
  googleReviewPublishedAt?: string | null;
  googleReviewTimeDescription?: string;
  googleReviewUrl?: string;
  createdAt?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const timestamp = getReviewTimestamp(googleReviewPublishedAt, googleReviewUrl, createdAt, googleReviewTimeDescription);
  const dateLabel = formatReviewTime(timestamp, now);
  const label = getReviewTimeLabel({ googleReviewPublishedAt, googleReviewTimeDescription, googleReviewUrl, createdAt }, now);
  const title = dateLabel ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp)) : undefined;
  return <span className={className} title={title}>{label}</span>;
}

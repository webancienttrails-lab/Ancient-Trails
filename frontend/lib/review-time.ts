export function getReviewTimestamp(googlePublishedAt?: string | null, googleReviewUrl?: string, createdAt?: string, googleTimeDescription?: string): string {
  // Never present an admin import date as the date a linked Google review was published.
  return googlePublishedAt || ((googleReviewUrl?.trim() || googleTimeDescription?.trim()) ? "" : createdAt || "");
}

export function formatReviewTime(value: string, now: number): string {
  const timestamp = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(timestamp) || timestamp > now) return "";
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [365 * 86400, "year"], [30 * 86400, "month"], [7 * 86400, "week"],
    [86400, "day"], [3600, "hour"], [60, "minute"],
  ];
  const [size, unit] = units.find(([size]) => seconds >= size)!;
  return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(-Math.floor(seconds / size), unit);
}

export function getReviewTimeLabel(review: {
  googleReviewPublishedAt?: string | null;
  googleReviewTimeDescription?: string;
  googleReviewUrl?: string;
  createdAt?: string;
}, now: number): string {
  const timestamp = getReviewTimestamp(review.googleReviewPublishedAt, review.googleReviewUrl, review.createdAt, review.googleReviewTimeDescription);
  return formatReviewTime(timestamp, now) || review.googleReviewTimeDescription?.trim() || (review.googleReviewUrl?.trim() ? "On Google" : "");
}

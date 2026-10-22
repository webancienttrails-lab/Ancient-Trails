// Keep this allowlist in sync across the backend, admin and frontend apps.
export function isGoogleReviewUrl(value: string): boolean {
  const source = value.trim();
  if (!source || source.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(source)) return false;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if ([...url.searchParams.keys()].some(key => ["url", "continue", "redirect", "redirect_url", "redirect_uri", "link", "ofl", "afl", "ifl", "target"].includes(key.toLowerCase()))) return false;
    const host = url.hostname;
    const path = url.pathname;
    if (host === "maps.app.goo.gl" || host === "share.google") return /^\/[A-Za-z0-9_-]+\/?$/.test(path);
    if (host === "goo.gl") return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(path);
    if (host === "g.page") return /^\/(?:r\/)?[A-Za-z0-9_-]+\/review\/?$/.test(path);
    if (host === "search.google.com") return /^\/local\/reviews\/?$/.test(path) && Boolean(url.searchParams.get("placeid") || url.searchParams.get("cid") || url.searchParams.get("ludocid"));
    if (!["google.com", "www.google.com", "maps.google.com", "google.co.in", "www.google.co.in", "maps.google.co.in"].includes(host)) return false;
    if (/^\/maps\/contrib\/[0-9]+\/reviews\/?$/.test(path)) return true;
    if (/^\/maps\/(?:reviews|place)(?:\/|$)/.test(path)) return true;
    return (path === "/maps" || path === "/maps/" || (host.startsWith("maps.") && path === "/")) && Boolean(url.searchParams.get("cid") || url.searchParams.get("ludocid") || url.searchParams.get("placeid") || url.searchParams.get("q")?.startsWith("place_id:"));
  } catch { return false; }
}

export function isGoogleBusinessReviewsUrl(value: string): boolean {
  if (!isGoogleReviewUrl(value)) return false;
  const url = new URL(value.trim());
  if (url.hostname === "share.google") return false;
  // A fallback must not send every traveller to another person's individual review.
  return !/^\/maps\/(?:reviews|contrib)(?:\/|$)/.test(url.pathname) && ![...url.searchParams.keys()].some(key => key.toLowerCase() === "reviewid");
}

export type GoogleBusinessReviewsSettings = {
  googleBusinessReviewsUrl?: string;
  googleBusinessReviewsVerified?: boolean;
};

export function resolveGoogleReviewUrl(individualUrl?: string, business: GoogleBusinessReviewsSettings = {}): string {
  if (individualUrl && isGoogleReviewUrl(individualUrl)) return individualUrl.trim();
  const fallback = business.googleBusinessReviewsUrl;
  return business.googleBusinessReviewsVerified === true && fallback && isGoogleBusinessReviewsUrl(fallback) ? fallback.trim() : "";
}

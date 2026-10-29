// Set SITE_URL (or NEXT_PUBLIC_SITE_URL) when using a different public domain.
export function getSiteOrigin(): string {
  const value = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://ancienttrails.tech";
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("SITE_URL must be an absolute HTTP or HTTPS URL");
  }
  return url.origin;
}

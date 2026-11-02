// Keep Google Maps URL handling consistent across the three apps.
export function isGoogleMapsUrl(value: string): boolean {
  if (!value || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if ([...url.searchParams.keys()].some(key => ["url", "continue", "redirect", "redirect_uri", "link", "ofl", "afl", "ifl", "target"].includes(key.toLowerCase()))) return false;
    if (url.hostname === "maps.app.goo.gl") return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (url.hostname === "goo.gl") return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (!["google.com", "www.google.com", "maps.google.com", "google.co.in", "www.google.co.in", "maps.google.co.in"].includes(url.hostname)) return false;
    return /^\/maps(?:\/|$)/.test(url.pathname) || (url.hostname.startsWith("maps.") && url.pathname === "/");
  } catch { return false; }
}

export function getGoogleMapsEmbedUrl(value: string): string | null {
  if (!isGoogleMapsUrl(value)) return null;
  const url = new URL(value);
  if (/^\/maps\/embed(?:\/|$)/.test(url.pathname)) return url.toString();
  const placeCoordinates = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(value);
  const viewportCoordinates = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(value);
  const coordinates = placeCoordinates || viewportCoordinates;
  let query = url.searchParams.get("query") || url.searchParams.get("q") || "";
  const placeId = url.searchParams.get("query_place_id") || url.searchParams.get("place_id");
  if (placeId) query = "place_id:" + placeId;
  else if (coordinates) {
    const latitude=Number(coordinates[1]), longitude=Number(coordinates[2]);
    if (Math.abs(latitude)>90 || Math.abs(longitude)>180) return null;
    query = latitude + "," + longitude;
  }
  if (!query) {
    const place = /^\/maps\/place\/([^/]+)/.exec(url.pathname);
    if (place) { try { query = decodeURIComponent(place[1].replace(/\+/g," ")); } catch { return null; } }
  }
  if (!query) return null;
  return "https://maps.google.com/maps?q=" + encodeURIComponent(query) + "&z=14&output=embed";
}

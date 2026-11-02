import { isGoogleMapsUrl, getGoogleMapsEmbedUrl } from "../utils/destination-map";
import type { DestinationPageContent } from "./destination-page-content";

const cache = new Map<string, { expires: number; result: Promise<string | null> }>();
export async function resolveDestinationMapUrl(source: string): Promise<string | null> {
  if (!isGoogleMapsUrl(source)) return null;
  const direct = getGoogleMapsEmbedUrl(source);
  if (direct) return direct;
  const cached = cache.get(source);
  if (cached && cached.expires > Date.now()) return cached.result;
  const result = (async () => {
    try {
      const signal = AbortSignal.timeout(4000);
      let current = source;
      for (let hop=0; hop<5; hop++) {
        if (!isGoogleMapsUrl(current)) return null;
        const embed = getGoogleMapsEmbedUrl(current);
        if (embed) return embed;
        const response = await fetch(current, { redirect: "manual", signal });
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (response.status < 300 || response.status >= 400 || !location) return null;
        current = new URL(location,current).toString();
      }
    } catch { /* The saved address remains available if Google cannot be reached. */ }
    return null;
  })();
  if (cache.size>=256) cache.delete(cache.keys().next().value!);
  cache.set(source,{expires:Date.now()+60000,result});
  const embed = await result;
  if (embed) cache.set(source,{expires:Date.now()+24*60*60*1000,result});
  return embed;
}

export async function resolveDestinationMapContent(content: DestinationPageContent) {
  const legacyLink = isGoogleMapsUrl(content.mapImage || "") ? content.mapImage : "";
  const mapLink = content.mapLink || legacyLink;
  if (!mapLink) return content;
  const mapEmbedUrl = await resolveDestinationMapUrl(mapLink);
  return { ...content, mapLink, ...(legacyLink ? {mapImage:""} : {}), ...(mapEmbedUrl ? {mapEmbedUrl} : {}) };
}

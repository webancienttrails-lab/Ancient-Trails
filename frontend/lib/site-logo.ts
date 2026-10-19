"use client";

import { apiBaseUrl, apiRequest } from "@/lib/api";

export const defaultSiteLogo = "/Header Logo.png";
let logo = "", revision = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let loading: Promise<string> | undefined;
const changeKey = "ancient-trails-site-logo-change";
export function resolveSiteLogo(source?: string) {
  return source?.startsWith("/uploads/") ? apiBaseUrl + source : source || defaultSiteLogo;
}
export function publishSiteLogo(source?: string) {
  if (logo !== (source || "")) { logo = source || ""; for (const listener of listeners) listener(); }
}
export function announceSiteLogo(source?: string) {
  revision++; publishSiteLogo(source);
  try { localStorage.setItem(changeKey, Date.now() + ":" + Math.random()); } catch { /* Settings still work without storage. */ }
}
export async function fetchSiteLogoUrl() {
  const startedAtRevision = revision;
  if (!loading) loading = apiRequest<{ settings: { logo?: string } }>("/api/site-settings", { cache: "no-store" })
    .then(result => { if (startedAtRevision === revision) publishSiteLogo(result.data.settings.logo); return resolveSiteLogo(logo); })
    .catch(() => resolveSiteLogo(logo)).finally(() => { loading = undefined; });
  return loading;
}
const refresh = () => { if (document.visibilityState === "visible") void fetchSiteLogoUrl(); };
const storageChanged = (event: StorageEvent) => { if (event.key === changeKey) refresh(); };
export function subscribeSiteLogo(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void fetchSiteLogoUrl(); timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); window.addEventListener("storage", storageChanged); document.addEventListener("visibilitychange", refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("storage", storageChanged); document.removeEventListener("visibilitychange", refresh); }
  };
}
export const getSiteLogoSnapshot = () => resolveSiteLogo(logo);

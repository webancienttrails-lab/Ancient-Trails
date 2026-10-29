import { sessionFetch, ApiError, apiBaseUrl, apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type SiteContactSettings = {
  emailId: string;
  landline: string;
  officeAddress: string;
  primaryCalling: string;
  secondaryCalling: string;
  whatsapp: string;
};

export type SiteSocialLinks = { facebook: string; instagram: string; linkedin: string; youtube: string; };

export type SiteSettings = {
  quoteAssistanceTitle?: string;
  logo?: string;
  googleBusinessReviewsUrl?: string;
  googleBusinessReviewsVerified?: boolean;
  id: string;
  key: string;
  contact: SiteContactSettings;
  socialLinks: SiteSocialLinks;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SiteSettingsPayload = {
  quoteAssistanceTitle?: string;
  contact: SiteContactSettings;
  socialLinks?: SiteSocialLinks;
  googleBusinessReviewsUrl?: string;
  googleBusinessReviewsVerified?: boolean;
};

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.sessionId) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    "X-Session-Id": session.sessionId,
  };
}

export async function getAdminSiteSettings() {
  return apiRequest<{ settings: SiteSettings }>("/api/admin/site-settings", {
    headers: getAdminHeaders(),
  });
}

export async function updateAdminSiteSettings(payload: SiteSettingsPayload) {
  return apiRequest<{ settings: SiteSettings }>("/api/admin/site-settings", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function uploadAdminSiteLogo(file: File) {
  const body = new FormData(); body.append("logo", file);
  const response = await sessionFetch(apiBaseUrl + "/api/admin/site-settings/logo", { method: "POST", headers: getAdminHeaders(), body, credentials: "include" });
  const result = await response.json();
  if (!response.ok) throw new ApiError(response.status, result.message || "Unable to upload logo");
  return result as { data: { settings: SiteSettings } };
}
export function resetAdminSiteLogo() {
  return apiRequest<{ settings: SiteSettings }>("/api/admin/site-settings/logo", { method: "DELETE", headers: getAdminHeaders() });
}

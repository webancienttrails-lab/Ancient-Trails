import { apiRequest } from "@/lib/api";

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
  logo?: string;
  id: string;
  key: string;
  contact: SiteContactSettings;
  socialLinks: SiteSocialLinks;
  createdAt: string | null;
  updatedAt: string | null;
};

export const defaultSiteContactSettings: SiteContactSettings = {
  emailId: "Holidays@ancient.com",
  landline: "43131313",
  officeAddress:
    "387/1, Vinayak Apartments, Narayan Peth, Near Modi Ganpati Temple, Pune - 411030, Maharashtra, India",
  primaryCalling: "011-43033003",
  secondaryCalling: "",
  whatsapp: "",
};

export function getContactCallDisplay(contact: SiteContactSettings) {
  return [contact.primaryCalling, contact.landline]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
}

export function getTelephoneHref(value: string) {
  const phone = value.replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : "#";
}

export function getContactEmailDisplay(contact: SiteContactSettings) {
  const email = contact.emailId.trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : defaultSiteContactSettings.emailId;
}

export function getMailtoHref(value: string) {
  return `mailto:${value}`;
}

export async function getPublicSiteSettings() {
  return apiRequest<{ settings: SiteSettings }>("/api/site-settings", {
    cache: "no-store",
  });
}

import { saveSiteLogo } from "../services/site-logo-upload";
import type { Request, Response } from "express";
import { z } from "zod";

import {
  SiteSettings,
  defaultSocialLinks,
  type ISiteContactSettings,
  type SiteSettingsDocument,
} from "../models/siteSettings.model";

import { HttpError } from "../utils/httpError";

const siteSettingsKey = "site";

const defaultContactSettings: ISiteContactSettings = {
  emailId: "Holidays@ancient.com",
  landline: "43131313",
  officeAddress: "387/1, Vinayak Apartments, Narayan Peth, Near Modi Ganpati Temple, Pune - 411030, Maharashtra, India",
  primaryCalling: "011-43033003",
  secondaryCalling: "",
  whatsapp: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactSettingsPayloadSchema = z.object({
  emailId: z
    .string()
    .trim()
    .max(160)
    .refine((value) => !value || emailPattern.test(value), {
      message: "Email ID must be a valid email address",
    })
    .default(""),
  landline: z.string().trim().max(40).default(""),
  officeAddress: z.string().trim().max(500).default(""),
  primaryCalling: z.string().trim().max(40).default(""),
  secondaryCalling: z.string().trim().max(40).default(""),
  whatsapp: z.string().trim().max(40).default(""),
});

const socialUrlSchema = z.string().trim().max(500).refine(value => {
  if (!value) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "Enter a valid http or https social media URL").default("");
const socialLinksPayloadSchema = z.object({
  facebook: socialUrlSchema, instagram: socialUrlSchema, linkedin: socialUrlSchema, youtube: socialUrlSchema,
});

const siteSettingsPayloadSchema = z.object({
  contact: contactSettingsPayloadSchema,
  socialLinks: socialLinksPayloadSchema.optional(),
});

function getContactSettings(settings?: SiteSettingsDocument | null): ISiteContactSettings {
  const contact = settings?.contact as
    | (ISiteContactSettings & { toObject?: () => ISiteContactSettings })
    | undefined;
  const contactSettings =
    typeof contact?.toObject === "function" ? contact.toObject() : contact || {};

  const mergedSettings = {
    ...defaultContactSettings,
    ...contactSettings,
  };

  return {
    ...mergedSettings,
    emailId: emailPattern.test(mergedSettings.emailId)
      ? mergedSettings.emailId
      : defaultContactSettings.emailId,
  };
}

function formatSiteSettings(settings?: SiteSettingsDocument | null) {
  return {
    logo: settings?.logo || "",
    contact: getContactSettings(settings),
    socialLinks: {
      facebook: settings?.socialLinks?.facebook ?? defaultSocialLinks.facebook,
      instagram: settings?.socialLinks?.instagram ?? defaultSocialLinks.instagram,
      linkedin: settings?.socialLinks?.linkedin ?? defaultSocialLinks.linkedin,
      youtube: settings?.socialLinks?.youtube ?? defaultSocialLinks.youtube,
    },
    id: settings?._id.toString() || siteSettingsKey,
    key: siteSettingsKey,
    createdAt: settings?.createdAt || null,
    updatedAt: settings?.updatedAt || null,
  };
}

async function getOrCreateSiteSettings() {
  const settings = await SiteSettings.findOneAndUpdate(
    { key: siteSettingsKey },
    {
      $setOnInsert: {
        contact: defaultContactSettings,
        key: siteSettingsKey,
      },
    },
    {
      new: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

  return settings;
}

export async function getSiteSettings(
  _request: Request,
  response: Response
): Promise<void> {
  const settings = await getOrCreateSiteSettings();

  response.status(200).json({
    success: true,
    message: "Site settings fetched successfully",
    data: {
      settings: formatSiteSettings(settings),
    },
  });
}

export async function updateSiteSettings(
  request: Request,
  response: Response
): Promise<void> {
  const parsed = siteSettingsPayloadSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Validation failed", parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })));
  const payload = parsed.data;
  const settings = await SiteSettings.findOneAndUpdate(
    { key: siteSettingsKey },
    {
      $set: {
        contact: payload.contact,
        ...(payload.socialLinks !== undefined ? { socialLinks: payload.socialLinks } : {}),
        key: siteSettingsKey,
      },
    },
    {
      new: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

  response.status(200).json({
    success: true,
    message: "Site settings updated successfully",
    data: {
      settings: formatSiteSettings(settings),
    },
  });
}

export async function uploadSiteLogo(request: Request, response: Response): Promise<void> {
  const logo = await saveSiteLogo(request.file);
  const settings = await SiteSettings.findOneAndUpdate({ key: siteSettingsKey }, { $set: { logo }, $setOnInsert: { key: siteSettingsKey, contact: defaultContactSettings } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  response.status(200).json({ success: true, message: "Site logo updated successfully", data: { settings: formatSiteSettings(settings) } });
}
export async function resetSiteLogo(_request: Request, response: Response): Promise<void> {
  const settings = await SiteSettings.findOneAndUpdate({ key: siteSettingsKey }, { $set: { logo: "" }, $setOnInsert: { key: siteSettingsKey, contact: defaultContactSettings } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  response.status(200).json({ success: true, message: "Default site logo restored", data: { settings: formatSiteSettings(settings) } });
}

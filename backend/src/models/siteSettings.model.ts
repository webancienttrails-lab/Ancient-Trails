import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import { isGoogleBusinessReviewsUrl } from "../utils/google-review-url";

export interface ISiteContactSettings {
  emailId: string;
  landline: string;
  officeAddress: string;
  primaryCalling: string;
  secondaryCalling: string;
  whatsapp: string;
}

export interface ISiteSocialLinks { facebook: string; instagram: string; linkedin: string; youtube: string; }

export const defaultSocialLinks: ISiteSocialLinks = {
  facebook: "https://www.facebook.com/ancienttrails",
  instagram: "https://www.instagram.com/ancienttrails",
  linkedin: "",
  youtube: "https://www.youtube.com/@ancienttrails",
};

export interface ISiteSettings {
  quoteAssistanceTitle?: string;
  logo: string;
  googleBusinessReviewsUrl?: string;
  googleBusinessReviewsVerified?: boolean;
  key: string;
  contact: ISiteContactSettings;
  socialLinks: ISiteSocialLinks;
  createdAt: Date;
  updatedAt: Date;
}

export type SiteSettingsDocument = HydratedDocument<ISiteSettings>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const contactSettingsSchema = new Schema<ISiteContactSettings>(
  {
    emailId: {
      ...trimmedString,
      maxlength: 160,
    },
    landline: {
      ...trimmedString,
      maxlength: 40,
    },
    officeAddress: {
      ...trimmedString,
      maxlength: 500,
    },
    primaryCalling: {
      ...trimmedString,
      maxlength: 40,
    },
    secondaryCalling: {
      ...trimmedString,
      maxlength: 40,
    },
    whatsapp: {
      ...trimmedString,
      maxlength: 40,
    },
  },
  {
    _id: false,
  }
);

const socialLinksSchema = new Schema<ISiteSocialLinks>({
  facebook: { ...trimmedString, maxlength: 500, default: defaultSocialLinks.facebook },
  instagram: { ...trimmedString, maxlength: 500, default: defaultSocialLinks.instagram },
  linkedin: { ...trimmedString, maxlength: 500 },
  youtube: { ...trimmedString, maxlength: 500, default: defaultSocialLinks.youtube },
}, { _id: false });

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    quoteAssistanceTitle: { ...trimmedString, maxlength: 160, default: "Looking for assistance?" },
    logo: { ...trimmedString, maxlength: 500 },
    googleBusinessReviewsUrl: { ...trimmedString, maxlength: 2048, validate: { validator: (value: string) => !value || isGoogleBusinessReviewsUrl(value), message: "Enter a valid HTTPS Google reviews URL" } },
    googleBusinessReviewsVerified: { type: Boolean, default: false },
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 40,
    },
    socialLinks: { type: socialLinksSchema, default: () => ({ ...defaultSocialLinks }) },
    contact: {
      type: contactSettingsSchema,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

siteSettingsSchema.index({ key: 1 }, { unique: true });

export const SiteSettings =
  (models.SiteSettings as Model<ISiteSettings> | undefined) ||
  model<ISiteSettings>("SiteSettings", siteSettingsSchema);

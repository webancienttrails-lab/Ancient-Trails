import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import { isGoogleReviewUrl } from "../utils/google-review-url";

export enum ExperienceStatus {
  DRAFT = "Draft",
  PUBLISHED = "Published",
}

export interface IExperience {
  experienceId: string;
  tourId: string;
  travellerName: string;
  travellerEmail: string;
  title: string;
  writtenReview: string;
  googleReviewUrl?: string;
  googleReviewPublishedAt?: Date | null;
  googleReviewTimeDescription?: string;
  thingsToKnow: string[];
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  travellerVideoTitles: string[];
  attractionPhotoGallery: ExperienceAttractionPhoto[];
  ratingItinerary: number;
  ratingLocalTransport: number;
  ratingAccommodation: number;
  ratingTourExpert: number;
  overallRating: number;
  status: ExperienceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ExperienceDocument = HydratedDocument<IExperience>;

export type ExperienceAttractionPhoto = {
  image: string;
  name: string;
};

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const requiredTrimmedString = {
  type: String,
  required: true,
  trim: true,
};

const trimmedStringList = {
  type: [String],
  default: [],
  set: (values: string[] = []) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))),
};

const indexedTrimmedStringList = {
  type: [String],
  default: [],
  set: (values: string[] = []) => values.map((value) => value.trim()),
};

const ratingField = {
  type: Number,
  min: 1,
  max: 5,
  required: true,
  default: 5,
};

export function calculateExperienceOverallRating(
  ratings: Pick<
    IExperience,
    | "ratingAccommodation"
    | "ratingItinerary"
    | "ratingLocalTransport"
    | "ratingTourExpert"
  >
): number {
  const values = [
    ratings.ratingItinerary,
    ratings.ratingLocalTransport,
    ratings.ratingAccommodation,
    ratings.ratingTourExpert,
  ].map((value) => Math.min(5, Math.max(1, Number(value) || 1)));

  const total = values.reduce((sum, value) => sum + value, 0);

  return Number((total / values.length).toFixed(1));
}

const attractionPhotoSchema = new Schema<ExperienceAttractionPhoto>(
  {
    image: {
      ...requiredTrimmedString,
      maxlength: 500,
    },
    name: {
      ...trimmedString,
      maxlength: 120,
    },
  },
  {
    _id: false,
  }
);

const experienceSchema = new Schema<IExperience>(
  {
    experienceId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    tourId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    travellerName: {
      ...trimmedString,
      maxlength: 120,
    },
    travellerEmail: {
      ...trimmedString,
      lowercase: true,
      maxlength: 160,
    },
    title: {
      ...trimmedString,
      maxlength: 160,
    },
    writtenReview: {
      ...trimmedString,
      maxlength: 3000,
    },
    googleReviewUrl: {
      ...trimmedString,
      maxlength: 2048,
      validate: { validator: (value: string) => !value || isGoogleReviewUrl(value), message: "Enter a valid HTTPS Google review URL" },
    },
    googleReviewTimeDescription: { ...trimmedString, maxlength: 80 },
    googleReviewPublishedAt: {
      type: Date,
      default: null,
      validate: { validator: (value: Date | null) => !value || value.getTime() <= Date.now(), message: "Google review publication date cannot be in the future" },
    },
    thingsToKnow: trimmedStringList,
    travellerPhotoGallery: trimmedStringList,
    travellerVideos: trimmedStringList,
    travellerVideoTitles: indexedTrimmedStringList,
    attractionPhotoGallery: {
      type: [attractionPhotoSchema],
      default: [],
    },
    ratingItinerary: ratingField,
    ratingLocalTransport: ratingField,
    ratingAccommodation: ratingField,
    ratingTourExpert: ratingField,
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
      default: 5,
    },
    status: {
      type: String,
      enum: Object.values(ExperienceStatus),
      required: true,
      default: ExperienceStatus.DRAFT,
    },
  },
  {
    timestamps: true,
  }
);

experienceSchema.index({ experienceId: 1 }, { unique: true });
experienceSchema.index({ tourId: 1 });
experienceSchema.index({ status: 1 });
experienceSchema.index({
  tourId: "text",
  travellerName: "text",
  writtenReview: "text",
  travellerVideoTitles: "text",
  "attractionPhotoGallery.name": "text",
});

experienceSchema.pre("validate", function syncOverallRating() {
  this.overallRating = calculateExperienceOverallRating(this);
});

experienceSchema.virtual("tour", {
  ref: "Tour",
  localField: "tourId",
  foreignField: "tourId",
  justOne: true,
});

experienceSchema.set("toJSON", { virtuals: true });
experienceSchema.set("toObject", { virtuals: true });

export const Experience =
  (models.Experience as Model<IExperience> | undefined) ||
  model<IExperience>("Experience", experienceSchema);

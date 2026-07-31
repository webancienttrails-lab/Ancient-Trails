import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export enum DestinationType {
  DOMESTIC = "Domestic",
  INTERNATIONAL = "International",
}

export interface IDestination {
  destinationId: string;
  destinationName: string;
  destinationType: DestinationType;
  countryRegion: string;
  state: string;
  city: string;
  primaryHeritageFocus: string;
  unescoSite: boolean;
  keyLandmarks: string[];
  recommendedDurationDays: number;
  shortDescription: string;
  dressCode: string;
  footwear: string;
  permits: string;
  idRequirement: string;
  restrictions: string;
  bannerImage: string;
  galleryImages: string[];
  photos?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type DestinationDocument = HydratedDocument<IDestination>;

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

const destinationSchema = new Schema<IDestination>(
  {
    destinationId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    destinationName: {
      ...requiredTrimmedString,
      maxlength: 120,
    },
    destinationType: {
      type: String,
      enum: Object.values(DestinationType),
      required: true,
      default: DestinationType.DOMESTIC,
    },
    countryRegion: {
      ...requiredTrimmedString,
      maxlength: 120,
    },
    state: {
      ...trimmedString,
      maxlength: 100,
    },
    city: {
      ...trimmedString,
      maxlength: 100,
    },
    primaryHeritageFocus: {
      ...trimmedString,
      maxlength: 160,
    },
    unescoSite: {
      type: Boolean,
      default: false,
      required: true,
    },
    keyLandmarks: {
      type: [String],
      default: [],
      set: (values: string[]) =>
        values.map((value) => value.trim()).filter(Boolean),
    },
    recommendedDurationDays: {
      type: Number,
      min: 1,
      max: 365,
      required: true,
      default: 1,
    },
    shortDescription: {
      ...trimmedString,
      maxlength: 800,
    },
    dressCode: {
      ...trimmedString,
      maxlength: 240,
    },
    footwear: {
      ...trimmedString,
      maxlength: 240,
    },
    permits: {
      ...trimmedString,
      maxlength: 240,
    },
    idRequirement: {
      ...trimmedString,
      maxlength: 240,
    },
    restrictions: {
      ...trimmedString,
      maxlength: 400,
    },
    bannerImage: {
      ...trimmedString,
      maxlength: 500,
    },
    galleryImages: {
      type: [String],
      default: [],
      set: (values: string[]) =>
        values.map((value) => value.trim()).filter(Boolean),
    },
    photos: {
      type: [String],
      default: [],
      set: (values: string[]) =>
        values.map((value) => value.trim()).filter(Boolean),
    },
  },
  {
    timestamps: true,
  }
);

destinationSchema.index({ destinationId: 1 }, { unique: true });
destinationSchema.index({ destinationName: "text", city: "text", state: "text" });
destinationSchema.index({ destinationType: 1 });
destinationSchema.index({ countryRegion: 1 });

destinationSchema.virtual("tours", {
  ref: "Tour",
  localField: "destinationId",
  foreignField: "destinationId",
});

destinationSchema.set("toJSON", { virtuals: true });
destinationSchema.set("toObject", { virtuals: true });

export const Destination =
  (models.Destination as Model<IDestination> | undefined) ||
  model<IDestination>("Destination", destinationSchema);

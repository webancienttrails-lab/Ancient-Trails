import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface IMegaMenuReference {
  referenceId: string;
  sortOrder: number;
}

export interface IMegaMenuRegion {
  description: string;
  href: string;
  image: string;
  sortOrder: number;
  title: string;
}

export interface IMegaMenuPage {
  pageKey: string;
  destinationIndia: IMegaMenuReference[];
  destinationIndiaRegions: IMegaMenuRegion[];
  destinationInternational: IMegaMenuReference[];
  destinationInternationalRegions: IMegaMenuRegion[];
  destinationTopCities: IMegaMenuReference[];
  tourHeritage: IMegaMenuReference[];
  tourShortTrails: IMegaMenuReference[];
  createdAt: Date;
  updatedAt: Date;
}

export type MegaMenuPageDocument = HydratedDocument<IMegaMenuPage>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const requiredReferenceString = {
  type: String,
  required: true,
  trim: true,
  uppercase: true,
};

const sortOrderField = {
  type: Number,
  min: 0,
  max: 99,
  default: 0,
};

const megaMenuReferenceSchema = new Schema<IMegaMenuReference>(
  {
    referenceId: {
      ...requiredReferenceString,
      maxlength: 40,
    },
    sortOrder: sortOrderField,
  },
  {
    _id: true,
  }
);

const megaMenuRegionSchema = new Schema<IMegaMenuRegion>(
  {
    title: {
      ...trimmedString,
      required: true,
      maxlength: 80,
    },
    description: {
      ...trimmedString,
      maxlength: 180,
    },
    image: {
      ...trimmedString,
      maxlength: 300,
    },
    href: {
      ...trimmedString,
      maxlength: 220,
    },
    sortOrder: sortOrderField,
  },
  {
    _id: true,
  }
);

const megaMenuPageSchema = new Schema<IMegaMenuPage>(
  {
    pageKey: {
      ...trimmedString,
      default: "main",
      immutable: true,
      required: true,
    },
    tourHeritage: {
      type: [megaMenuReferenceSchema],
      default: [],
    },
    tourShortTrails: {
      type: [megaMenuReferenceSchema],
      default: [],
    },
    destinationIndia: {
      type: [megaMenuReferenceSchema],
      default: [],
    },
    destinationIndiaRegions: {
      type: [megaMenuRegionSchema],
      default: [],
    },
    destinationInternational: {
      type: [megaMenuReferenceSchema],
      default: [],
    },
    destinationInternationalRegions: {
      type: [megaMenuRegionSchema],
      default: [],
    },
    destinationTopCities: {
      type: [megaMenuReferenceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

megaMenuPageSchema.index({ pageKey: 1 }, { unique: true });

export const MegaMenuPage =
  (models.MegaMenuPage as Model<IMegaMenuPage> | undefined) ||
  model<IMegaMenuPage>("MegaMenuPage", megaMenuPageSchema);

import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface IHomeUpcomingTour {
  departureId: string;
  sortOrder: number;
  tourId: string;
}

export interface IHomeTrendingDestination {
  destinationId: string;
  markerX: number;
  markerY: number;
  sortOrder: number;
}

export interface IHomePage {
  pageKey: string;
  trendingDestinations: IHomeTrendingDestination[];
  upcomingTours: IHomeUpcomingTour[];
  createdAt: Date;
  updatedAt: Date;
}

export type HomePageDocument = HydratedDocument<IHomePage>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const requiredCodeString = {
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

const homeUpcomingTourSchema = new Schema<IHomeUpcomingTour>(
  {
    tourId: {
      ...requiredCodeString,
      maxlength: 40,
    },
    departureId: {
      ...trimmedString,
      uppercase: true,
      maxlength: 40,
    },
    sortOrder: sortOrderField,
  },
  {
    _id: true,
  }
);

const homeTrendingDestinationSchema = new Schema<IHomeTrendingDestination>(
  {
    destinationId: {
      ...requiredCodeString,
      maxlength: 40,
    },
    markerX: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    markerY: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    sortOrder: sortOrderField,
  },
  {
    _id: true,
  }
);

const homePageSchema = new Schema<IHomePage>(
  {
    pageKey: {
      ...trimmedString,
      default: "home",
      immutable: true,
      required: true,
    },
    upcomingTours: {
      type: [homeUpcomingTourSchema],
      default: [],
    },
    trendingDestinations: {
      type: [homeTrendingDestinationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

homePageSchema.index({ pageKey: 1 }, { unique: true });

export const HomePage =
  (models.HomePage as Model<IHomePage> | undefined) ||
  model<IHomePage>("HomePage", homePageSchema);

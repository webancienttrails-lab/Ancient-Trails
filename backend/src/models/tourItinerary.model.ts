import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface ITourItineraryDay {
  dayNumber: number;
  title: string;
  summary: string;
  placesVisited: string[];
  transport: string;
  walkingDifficulty: string;
  meals: string;
}

export interface ITourItinerary {
  tourId: string;
  itinerarySummary: string;
  days: ITourItineraryDay[];
  createdAt: Date;
  updatedAt: Date;
}

export type TourItineraryDocument = HydratedDocument<ITourItinerary>;

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

const tourItineraryDaySchema = new Schema<ITourItineraryDay>(
  {
    dayNumber: {
      type: Number,
      min: 1,
      max: 365,
      required: true,
    },
    title: {
      ...requiredTrimmedString,
      maxlength: 140,
    },
    summary: {
      ...trimmedString,
      maxlength: 1000,
    },
    placesVisited: trimmedStringList,
    transport: {
      ...trimmedString,
      maxlength: 240,
    },
    walkingDifficulty: {
      ...trimmedString,
      maxlength: 240,
    },
    meals: {
      ...trimmedString,
      maxlength: 400,
    },
  },
  {
    _id: false,
  }
);

const tourItinerarySchema = new Schema<ITourItinerary>(
  {
    tourId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    itinerarySummary: {
      ...trimmedString,
      maxlength: 3000,
    },
    days: {
      type: [tourItineraryDaySchema],
      default: [],
      validate: {
        validator: (days: ITourItineraryDay[]) => days.length <= 365,
        message: "Itinerary cannot have more than 365 days",
      },
    },
  },
  {
    timestamps: true,
  }
);

tourItinerarySchema.index({ tourId: 1 }, { unique: true });
tourItinerarySchema.index({
  tourId: "text",
  itinerarySummary: "text",
  "days.title": "text",
  "days.summary": "text",
  "days.placesVisited": "text",
});

tourItinerarySchema.virtual("tour", {
  ref: "Tour",
  localField: "tourId",
  foreignField: "tourId",
  justOne: true,
});

tourItinerarySchema.set("toJSON", { virtuals: true });
tourItinerarySchema.set("toObject", { virtuals: true });

export const TourItinerary =
  (models.TourItinerary as Model<ITourItinerary> | undefined) ||
  model<ITourItinerary>("TourItinerary", tourItinerarySchema);

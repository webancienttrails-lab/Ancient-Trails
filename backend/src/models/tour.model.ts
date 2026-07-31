import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface ITour {
  tourId: string;
  tourName: string;
  tourType: string;
  destinationId: string;
  durationDn: string;
  category: string;
  difficulty: string;
  bestSeason: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  expertId: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TourDocument = HydratedDocument<ITour>;

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
  set: (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))),
};

const tourSchema = new Schema<ITour>(
  {
    tourId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    tourName: {
      ...requiredTrimmedString,
      maxlength: 140,
    },
    tourType: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    destinationId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    durationDn: {
      ...requiredTrimmedString,
      maxlength: 40,
    },
    category: {
      ...trimmedString,
      maxlength: 100,
    },
    difficulty: {
      ...trimmedString,
      maxlength: 80,
    },
    bestSeason: {
      ...trimmedString,
      maxlength: 120,
    },
    description: {
      ...trimmedString,
      maxlength: 3000,
    },
    inclusions: trimmedStringList,
    exclusions: trimmedStringList,
    expertId: {
      ...trimmedString,
      uppercase: true,
      maxlength: 40,
    },
    notes: {
      ...trimmedString,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

tourSchema.index({ tourId: 1 }, { unique: true });
tourSchema.index({
  tourName: "text",
  tourType: "text",
  destinationId: "text",
  category: "text",
  difficulty: "text",
  expertId: "text",
});
tourSchema.index({ destinationId: 1 });
tourSchema.index({ expertId: 1 });

tourSchema.virtual("destination", {
  ref: "Destination",
  localField: "destinationId",
  foreignField: "destinationId",
  justOne: true,
});

tourSchema.virtual("departures", {
  ref: "TourDeparture",
  localField: "tourId",
  foreignField: "tourId",
});

tourSchema.virtual("bookings", {
  ref: "Booking",
  localField: "tourId",
  foreignField: "tourId",
});

tourSchema.set("toJSON", { virtuals: true });
tourSchema.set("toObject", { virtuals: true });

export const Tour =
  (models.Tour as Model<ITour> | undefined) || model<ITour>("Tour", tourSchema);

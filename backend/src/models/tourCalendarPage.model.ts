import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface ITourCalendarFestival {
  title: string;
  date: Date;
  description: string;
  sortOrder: number;
}

export interface ITourCalendarPage {
  pageKey: string;
  festivals: ITourCalendarFestival[];
  createdAt: Date;
  updatedAt: Date;
}

export type TourCalendarPageDocument = HydratedDocument<ITourCalendarPage>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const festivalSchema = new Schema<ITourCalendarFestival>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      ...trimmedString,
      maxlength: 300,
    },
    sortOrder: {
      type: Number,
      min: 0,
      max: 999,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const tourCalendarPageSchema = new Schema<ITourCalendarPage>(
  {
    pageKey: {
      ...trimmedString,
      default: "tour-calendar",
      immutable: true,
      required: true,
    },
    festivals: {
      type: [festivalSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

tourCalendarPageSchema.index({ pageKey: 1 }, { unique: true });

export const TourCalendarPage =
  (models.TourCalendarPage as Model<ITourCalendarPage> | undefined) ||
  model<ITourCalendarPage>("TourCalendarPage", tourCalendarPageSchema);

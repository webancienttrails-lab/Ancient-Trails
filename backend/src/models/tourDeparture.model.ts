import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface ITourDeparture {
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: Date;
  returnDate: Date;
  seatsAvailable: number;
  priceAdult: number;
  priceChild: number;
  singleOccupancy: number;
  depositType: string;
  depositValue: number;
  balanceDueDaysBefore: number;
  earlyBirdOffer: string;
  bookingDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TourDepartureDocument = HydratedDocument<ITourDeparture>;

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

const nonNegativeNumber = {
  type: Number,
  min: 0,
  default: 0,
};

const tourDepartureSchema = new Schema<ITourDeparture>(
  {
    departureId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    tourId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    destinationId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    departureDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
      required: true,
    },
    seatsAvailable: {
      ...nonNegativeNumber,
      max: 100000,
    },
    priceAdult: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    priceChild: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    singleOccupancy: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    depositType: {
      ...trimmedString,
      maxlength: 80,
    },
    depositValue: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    balanceDueDaysBefore: {
      ...nonNegativeNumber,
      max: 3650,
    },
    earlyBirdOffer: {
      ...trimmedString,
      maxlength: 500,
    },
    bookingDeadline: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

tourDepartureSchema.index({ departureId: 1 }, { unique: true });
tourDepartureSchema.index({ tourId: 1 });
tourDepartureSchema.index({ destinationId: 1 });
tourDepartureSchema.index({ departureDate: 1 });
tourDepartureSchema.index({ bookingDeadline: 1 });

tourDepartureSchema.virtual("tour", {
  ref: "Tour",
  localField: "tourId",
  foreignField: "tourId",
  justOne: true,
});

tourDepartureSchema.virtual("destination", {
  ref: "Destination",
  localField: "destinationId",
  foreignField: "destinationId",
  justOne: true,
});

tourDepartureSchema.set("toJSON", { virtuals: true });
tourDepartureSchema.set("toObject", { virtuals: true });

export const TourDeparture =
  (models.TourDeparture as Model<ITourDeparture> | undefined) ||
  model<ITourDeparture>("TourDeparture", tourDepartureSchema);

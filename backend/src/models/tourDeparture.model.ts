import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import {
  departureStatuses,
  depositAppliesToValues,
  depositTypes,
  type ChildPricingRule,
  type DepartureStatus,
  type DepositAppliesTo,
  type DepositType,
  type RoomPolicy,
} from "../services/departure/departure.types";

export interface ITourDeparture {
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: Date | null;
  returnDate: Date | null;
  seatsAvailable: number;
  priceAdult: number;
  priceExtraBed: number;
  priceChildWithoutExtraBed: number;
  singleOccupancy: number;
  depositType: DepositType;
  depositValue: number;
  depositAppliesTo: DepositAppliesTo;
  balanceDueDaysBefore: number;
  earlyBirdOffer: string | null;
  bookingDeadline: Date | null;
  status: DepartureStatus;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
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

const nullableDate = {
  type: Date,
  default: null,
};

const childPricingRuleSchema = new Schema<ChildPricingRule>(
  {
    minAge: {
      type: Number,
      required: true,
      min: 0,
      max: 120,
    },
    maxAge: {
      type: Number,
      required: true,
      min: 0,
      max: 120,
    },
    allowExtraBed: {
      type: Boolean,
      default: true,
    },
    allowWithoutExtraBed: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

const roomPolicySchema = new Schema<RoomPolicy>(
  {
    allowChildBedSharing: {
      type: Boolean,
      default: true,
    },
    maxChildrenWithoutExtraBedPerRoom: {
      type: Number,
      min: 0,
      max: 10,
      default: 1,
    },
    allowExtraBed: {
      type: Boolean,
      default: true,
    },
    allowChildSingleRoom: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

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
    departureDate: nullableDate,
    returnDate: nullableDate,
    seatsAvailable: {
      ...nonNegativeNumber,
      max: 100000,
    },
    priceAdult: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    priceExtraBed: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    priceChildWithoutExtraBed: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    singleOccupancy: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    depositType: {
      type: String,
      enum: depositTypes,
      default: "fixed",
    },
    depositValue: {
      ...nonNegativeNumber,
      max: 100000000,
    },
    depositAppliesTo: {
      type: String,
      enum: depositAppliesToValues,
      default: "per_person",
    },
    balanceDueDaysBefore: {
      ...nonNegativeNumber,
      max: 3650,
    },
    earlyBirdOffer: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    bookingDeadline: nullableDate,
    status: {
      type: String,
      enum: departureStatuses,
      default: "scheduled",
    },
    childPricingRules: {
      type: [childPricingRuleSchema],
      default: [],
    },
    roomPolicy: {
      type: roomPolicySchema,
      default: () => ({
        allowChildBedSharing: true,
        maxChildrenWithoutExtraBedPerRoom: 1,
        allowExtraBed: true,
        allowChildSingleRoom: false,
      }),
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
tourDepartureSchema.index({ status: 1 });

tourDepartureSchema.pre("validate", function normalizeDepartureValues() {
  if (this.earlyBirdOffer) {
    const trimmedOffer = this.earlyBirdOffer.trim();

    this.earlyBirdOffer =
      trimmedOffer && trimmedOffer.toUpperCase() !== "NIL" ? trimmedOffer : null;
  } else {
    this.earlyBirdOffer = null;
  }

  if (this.status === "coming_soon") {
    this.departureDate = null;
    this.returnDate = null;
  }

  if (this.status !== "coming_soon") {
    if (!this.departureDate || !this.returnDate) {
      this.invalidate(
        "departureDate",
        "Scheduled departures require departure and return dates."
      );
    } else if (this.returnDate.getTime() <= this.departureDate.getTime()) {
      this.invalidate("returnDate", "Return date must be after departure date.");
    }
  }

  this.childPricingRules.forEach((rule, index) => {
    if (rule.maxAge < rule.minAge) {
      this.invalidate(
        `childPricingRules.${index}.maxAge`,
        "Maximum age must be greater than or equal to minimum age."
      );
    }
  });
});

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

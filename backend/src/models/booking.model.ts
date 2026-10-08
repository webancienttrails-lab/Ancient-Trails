import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type { PricingSnapshot } from "../services/booking/booking.snapshot";

export interface IBookingGuestDetails {
  title: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  email: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  dateOfBirth: Date;
  gender: string;
  address: string;
  panNumber?: string;
}

export interface IBookingChildDetails {
  age: number;
}

export interface IBookingAccommodationDetails {
  singleOccupancyOneRoom: number;
  singleOccupancyTwoRooms: number;
  doubleOccupancy: number;
  twinOccupancy: number;
  tripleOccupancy: number;
}

export interface IBookingTraveller {
  id: string;
  type: "adult" | "child";
  title?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  mobileNumber?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  panNumber?: string;
  ageOnDeparture?: number;
}

export interface IBooking {
  bookingReference?: string;
  pendingBookingKey?: string;
  bookingStatus?:
    | "draft"
    | "payment_pending"
    | "payment_processing"
    | "confirmed"
    | "expired"
    | "cancelled";
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: "advance" | "full";
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: IBookingChildDetails[];
  guestDetails: IBookingGuestDetails[];
  travellers: IBookingTraveller[];
  accommodationDetails: IBookingAccommodationDetails;
  pricingSnapshot?: PricingSnapshot;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  grandTotal?: number;
  depositAmount?: number;
  balanceAmount?: number;
  balanceDueDate?: Date | null;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: "cash" | "cheque" | "neft" | "razorpay";
  paymentProvider?: "razorpay";
  paymentOrderId?: string;
  paymentId?: string;
  paymentSignature?: string;
  paymentCurrency?: string;
  amountPaid?: number;
  paymentCapturedAt?: Date | null;
  heldSeatCount?: number;
  holdExpiresAt?: Date | null;
  recoveryExpiresAt?: Date | null;
  recoveryToken?: string;
  recoveryEmailStatus?: "pending" | "sending" | "sent" | "failed" | "disabled";
  recoveryEmailAttemptedAt?: Date | null;
  recoveryEmailSentAt?: Date | null;
  recoveryEmailError?: string;
  whatsappMarketingConsent?: boolean;
  whatsappRecoveryStatus?:
    | "pending"
    | "sending"
    | "sent"
    | "failed"
    | "disabled";
  whatsappRecoveryAttemptedAt?: Date | null;
  whatsappRecoverySentAt?: Date | null;
  whatsappRecoveryRecipient?: string;
  whatsappRecoveryRequestId?: string;
  whatsappRecoveryError?: string;
  recoveryReminderCount?: number;
  recoveryLastReminderSentAt?: Date | null;
  confirmationToken?: string;
  archivedAt?: Date | null;
  emailBookingConfirmationStatus?:
    | "pending"
    | "sending"
    | "sent"
    | "failed";
  emailBookingConfirmationAttemptedAt?: Date | null;
  emailBookingConfirmationSentAt?: Date | null;
  emailBookingConfirmationRecipient?: string;
  emailBookingConfirmationMessageId?: string;
  emailBookingConfirmationError?: string;
  whatsappBookingConfirmationStatus?:
    | "pending"
    | "sending"
    | "sent"
    | "failed";
  whatsappBookingConfirmationAttemptedAt?: Date | null;
  whatsappBookingConfirmationSentAt?: Date | null;
  whatsappBookingConfirmationRecipient?: string;
  whatsappBookingConfirmationRequestId?: string;
  whatsappBookingConfirmationError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingDocument = HydratedDocument<IBooking>;

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

const guestDetailsSchema = new Schema<IBookingGuestDetails>(
  {
    title: {
      ...requiredTrimmedString,
      maxlength: 20,
    },
    firstName: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    lastName: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    countryCode: {
      ...requiredTrimmedString,
      maxlength: 8,
    },
    mobileNumber: {
      ...requiredTrimmedString,
      maxlength: 20,
    },
    email: {
      ...requiredTrimmedString,
      lowercase: true,
      maxlength: 160,
    },
    emergencyContactName: {
      ...trimmedString,
      maxlength: 120,
    },
    emergencyContactMobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      ...requiredTrimmedString,
      maxlength: 40,
    },
    address: {
      ...requiredTrimmedString,
      maxlength: 500,
    },
    panNumber: {
      ...trimmedString,
      maxlength: 20,
    },
  },
  {
    _id: false,
  }
);

const childDetailsSchema = new Schema<IBookingChildDetails>(
  {
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 17,
    },
  },
  {
    _id: false,
  }
);

const travellerSchema = new Schema<IBookingTraveller>(
  {
    id: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: ["adult", "child"],
      required: true,
    },
    title: {
      ...trimmedString,
      maxlength: 20,
    },
    firstName: {
      ...trimmedString,
      maxlength: 80,
    },
    lastName: {
      ...trimmedString,
      maxlength: 80,
    },
    countryCode: {
      ...trimmedString,
      maxlength: 8,
    },
    mobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    email: {
      ...trimmedString,
      lowercase: true,
      maxlength: 160,
    },
    emergencyContactName: {
      ...trimmedString,
      maxlength: 120,
    },
    emergencyContactMobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      ...trimmedString,
      maxlength: 40,
    },
    address: {
      ...trimmedString,
      maxlength: 500,
    },
    panNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    ageOnDeparture: {
      ...nonNegativeNumber,
      max: 120,
    },
  },
  {
    _id: false,
  }
);

const accommodationDetailsSchema = new Schema<IBookingAccommodationDetails>(
  {
    singleOccupancyOneRoom: {
      ...nonNegativeNumber,
      max: 100,
    },
    singleOccupancyTwoRooms: {
      ...nonNegativeNumber,
      max: 100,
    },
    doubleOccupancy: {
      ...nonNegativeNumber,
      max: 100,
    },
    twinOccupancy: {
      ...nonNegativeNumber,
      max: 100,
    },
    tripleOccupancy: {
      ...nonNegativeNumber,
      max: 100,
    },
  },
  {
    _id: false,
  }
);

const bookingSchema = new Schema<IBooking>(
  {
    tourId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    bookingReference: {
      ...trimmedString,
      uppercase: true,
      maxlength: 40,
    },
    pendingBookingKey: {
      ...trimmedString,
      maxlength: 128,
    },
    bookingStatus: {
      type: String,
      enum: [
        "draft",
        "payment_pending",
        "payment_processing",
        "confirmed",
        "expired",
        "cancelled",
      ],
      default: "payment_pending",
    },
    departureId: {
      ...trimmedString,
      uppercase: true,
      maxlength: 40,
    },
    selectedAccommodationOptionId: {
      ...trimmedString,
      maxlength: 200,
    },
    paymentOption: {
      type: String,
      enum: ["advance", "full"],
      default: "advance",
    },
    totalGuest: {
      ...nonNegativeNumber,
      min: 1,
      max: 1000,
      required: true,
    },
    adultCount: {
      ...nonNegativeNumber,
      max: 1000,
      required: true,
    },
    childCount: {
      ...nonNegativeNumber,
      max: 1000,
      required: true,
    },
    childDetails: {
      type: [childDetailsSchema],
      default: [],
    },
    guestDetails: {
      type: [guestDetailsSchema],
      default: [],
      validate: {
        validator(values: IBookingGuestDetails[]) {
          return values.length > 0;
        },
        message: "At least one guest detail is required",
      },
    },
    travellers: {
      type: [travellerSchema],
      default: [],
    },
    accommodationDetails: {
      type: accommodationDetailsSchema,
      required: true,
      default: {},
    },
    pricingSnapshot: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    subtotal: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    gstPercentage: {
      ...nonNegativeNumber,
      max: 100,
    },
    gstAmount: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    grandTotal: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    depositAmount: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    balanceAmount: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    balanceDueDate: {
      type: Date,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "cheque", "neft", "razorpay"],
      default: undefined,
    },
    paymentProvider: {
      type: String,
      enum: ["razorpay"],
      default: undefined,
    },
    paymentOrderId: {
      ...trimmedString,
      maxlength: 120,
    },
    paymentId: {
      ...trimmedString,
      maxlength: 120,
    },
    paymentSignature: {
      ...trimmedString,
      maxlength: 256,
    },
    paymentCurrency: {
      ...trimmedString,
      uppercase: true,
      maxlength: 10,
    },
    amountPaid: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    paymentCapturedAt: {
      type: Date,
      default: null,
    },
    heldSeatCount: {
      ...nonNegativeNumber,
      max: 100000,
    },
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    recoveryExpiresAt: {
      type: Date,
      default: null,
    },
    recoveryToken: {
      ...trimmedString,
      maxlength: 128,
    },
    recoveryEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "disabled"],
      default: "pending",
    },
    recoveryEmailAttemptedAt: {
      type: Date,
      default: null,
    },
    recoveryEmailSentAt: {
      type: Date,
      default: null,
    },
    recoveryEmailError: {
      ...trimmedString,
      maxlength: 500,
    },
    whatsappMarketingConsent: {
      type: Boolean,
      default: true,
    },
    whatsappRecoveryStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "disabled"],
      default: "pending",
    },
    whatsappRecoveryAttemptedAt: {
      type: Date,
      default: null,
    },
    whatsappRecoverySentAt: {
      type: Date,
      default: null,
    },
    whatsappRecoveryRecipient: {
      ...trimmedString,
      maxlength: 20,
    },
    whatsappRecoveryRequestId: {
      ...trimmedString,
      maxlength: 160,
    },
    whatsappRecoveryError: {
      ...trimmedString,
      maxlength: 500,
    },
    recoveryReminderCount: {
      ...nonNegativeNumber,
      max: 10,
    },
    recoveryLastReminderSentAt: {
      type: Date,
      default: null,
    },
    confirmationToken: {
      ...trimmedString,
      maxlength: 128,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    emailBookingConfirmationStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    emailBookingConfirmationAttemptedAt: {
      type: Date,
      default: null,
    },
    emailBookingConfirmationSentAt: {
      type: Date,
      default: null,
    },
    emailBookingConfirmationRecipient: {
      ...trimmedString,
      lowercase: true,
      maxlength: 160,
    },
    emailBookingConfirmationMessageId: {
      ...trimmedString,
      maxlength: 200,
    },
    emailBookingConfirmationError: {
      ...trimmedString,
      maxlength: 500,
    },
    whatsappBookingConfirmationStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    whatsappBookingConfirmationAttemptedAt: {
      type: Date,
      default: null,
    },
    whatsappBookingConfirmationSentAt: {
      type: Date,
      default: null,
    },
    whatsappBookingConfirmationRecipient: {
      ...trimmedString,
      maxlength: 20,
    },
    whatsappBookingConfirmationRequestId: {
      ...trimmedString,
      maxlength: 160,
    },
    whatsappBookingConfirmationError: {
      ...trimmedString,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ tourId: 1 });
bookingSchema.index({ bookingReference: 1 }, { sparse: true });
bookingSchema.index({ pendingBookingKey: 1 }, { unique: true, sparse: true });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ departureId: 1 });
bookingSchema.index({ "guestDetails.email": 1 });
bookingSchema.index({ paymentOrderId: 1 }, { sparse: true });
bookingSchema.index({ paymentId: 1 }, { sparse: true });
bookingSchema.index({ confirmationToken: 1 }, { sparse: true });
bookingSchema.index({ recoveryToken: 1 }, { sparse: true });
bookingSchema.index({ holdExpiresAt: 1 });
bookingSchema.index({ recoveryExpiresAt: 1 });
bookingSchema.index({ archivedAt: 1 });
bookingSchema.index({ emailBookingConfirmationStatus: 1 });
bookingSchema.index({ whatsappBookingConfirmationStatus: 1 });
bookingSchema.index({ whatsappRecoveryStatus: 1 });
bookingSchema.index({
  tourId: "text",
  "guestDetails.firstName": "text",
  "guestDetails.lastName": "text",
  "guestDetails.email": "text",
  "guestDetails.mobileNumber": "text",
});

bookingSchema.virtual("tour", {
  ref: "Tour",
  localField: "tourId",
  foreignField: "tourId",
  justOne: true,
});

bookingSchema.set("toJSON", { virtuals: true });
bookingSchema.set("toObject", { virtuals: true });

export const Booking =
  (models.Booking as Model<IBooking> | undefined) ||
  model<IBooking>("Booking", bookingSchema);

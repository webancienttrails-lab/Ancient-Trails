import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

import type { IBooking } from "./booking.model";

export type BookingPaymentSessionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired";

export type BookingDraft = Omit<IBooking, "createdAt" | "updatedAt">;

export interface IBookingPaymentSession {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  receipt: string;
  amount: number;
  amountRupees: number;
  currency: string;
  status: BookingPaymentSessionStatus;
  bookingDraft: BookingDraft;
  bookingId?: Types.ObjectId;
  failureReason?: string;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingPaymentSessionDocument =
  HydratedDocument<IBookingPaymentSession>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const bookingPaymentSessionSchema = new Schema<IBookingPaymentSession>(
  {
    razorpayOrderId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true,
    },
    razorpayPaymentId: {
      ...trimmedString,
      maxlength: 120,
    },
    razorpaySignature: {
      ...trimmedString,
      maxlength: 256,
    },
    receipt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      max: 100000000000,
    },
    amountRupees: {
      type: Number,
      required: true,
      min: 1,
      max: 1000000000,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 10,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
    },
    bookingDraft: {
      type: Schema.Types.Mixed,
      required: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: undefined,
    },
    failureReason: {
      ...trimmedString,
      maxlength: 500,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bookingPaymentSessionSchema.index({ bookingId: 1 }, { sparse: true });

export const BookingPaymentSession =
  (models.BookingPaymentSession as
    | Model<IBookingPaymentSession>
    | undefined) ||
  model<IBookingPaymentSession>(
    "BookingPaymentSession",
    bookingPaymentSessionSchema
  );

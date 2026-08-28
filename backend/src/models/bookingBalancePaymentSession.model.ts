import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

export type BookingBalancePaymentSessionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired";

export interface IBookingBalancePaymentSession {
  bookingId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  receipt: string;
  amount: number;
  amountRupees: number;
  currency: string;
  status: BookingBalancePaymentSessionStatus;
  failureReason?: string;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingBalancePaymentSessionDocument =
  HydratedDocument<IBookingBalancePaymentSession>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const bookingBalancePaymentSessionSchema =
  new Schema<IBookingBalancePaymentSession>(
    {
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
      },
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

bookingBalancePaymentSessionSchema.index({ bookingId: 1 });

export const BookingBalancePaymentSession =
  (models.BookingBalancePaymentSession as
    | Model<IBookingBalancePaymentSession>
    | undefined) ||
  model<IBookingBalancePaymentSession>(
    "BookingBalancePaymentSession",
    bookingBalancePaymentSessionSchema
  );

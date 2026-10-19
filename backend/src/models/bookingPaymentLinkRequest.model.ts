import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

export type BookingPaymentLinkPurpose =
  | "final"
  | "additional"
  | "partial"
  | "custom";

export type BookingPaymentLinkStatus =
  | "created"
  | "sent"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type BookingPaymentLinkWhatsappStatus =
  | "pending"
  | "sent"
  | "failed";

export interface IBookingPaymentLinkRequest {
  bookingId: Types.ObjectId;
  purpose: BookingPaymentLinkPurpose;
  purposeLabel: string;
  obligationKey: string;
  amount: number;
  amountRupees: number;
  currency: string;
  description: string;
  razorpayPaymentLinkId: string;
  razorpayPaymentId?: string;
  razorpayReferenceId: string;
  paymentLinkUrl: string;
  status: BookingPaymentLinkStatus;
  whatsappStatus: BookingPaymentLinkWhatsappStatus;
  whatsappRecipient: string;
  whatsappRequestId?: string;
  whatsappError?: string;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  failureReason?: string;
  additionalChargeAppliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingPaymentLinkRequestDocument =
  HydratedDocument<IBookingPaymentLinkRequest>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const bookingPaymentLinkRequestSchema =
  new Schema<IBookingPaymentLinkRequest>(
    {
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
      },
      purpose: {
        type: String,
        enum: ["final", "additional", "partial", "custom"],
        required: true,
      },
      purposeLabel: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
      },
      obligationKey: {
        type: String,
        required: true,
        trim: true,
        maxlength: 220,
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
      description: {
        ...trimmedString,
        maxlength: 500,
      },
      razorpayPaymentLinkId: {
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
      razorpayReferenceId: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
        unique: true,
      },
      paymentLinkUrl: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
      },
      status: {
        type: String,
        enum: ["created", "sent", "paid", "failed", "expired", "cancelled"],
        default: "created",
      },
      whatsappStatus: {
        type: String,
        enum: ["pending", "sent", "failed"],
        default: "pending",
      },
      whatsappRecipient: {
        ...trimmedString,
        maxlength: 20,
      },
      whatsappRequestId: {
        ...trimmedString,
        maxlength: 160,
      },
      whatsappError: {
        ...trimmedString,
        maxlength: 500,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      paidAt: {
        type: Date,
        default: null,
      },
      cancelledAt: {
        type: Date,
        default: null,
      },
      failureReason: {
        ...trimmedString,
        maxlength: 500,
      },
      additionalChargeAppliedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

bookingPaymentLinkRequestSchema.index({ bookingId: 1, createdAt: -1 });
bookingPaymentLinkRequestSchema.index({ bookingId: 1, obligationKey: 1 });
bookingPaymentLinkRequestSchema.index({ status: 1 });

export const BookingPaymentLinkRequest =
  (models.BookingPaymentLinkRequest as
    | Model<IBookingPaymentLinkRequest>
    | undefined) ||
  model<IBookingPaymentLinkRequest>(
    "BookingPaymentLinkRequest",
    bookingPaymentLinkRequestSchema
  );

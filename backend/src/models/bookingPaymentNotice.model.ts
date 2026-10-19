import { model, models, Schema, type Model, type Types } from "mongoose";
export interface IBookingPaymentNotice {
  _id: string;
  bookingId: Types.ObjectId;
  kind: "remaining_payment_reminder" | "tour_full_payment_confirmation" | "airfare_payment_link";
  channel: "email" | "whatsapp";
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  attemptedAt?: Date | null;
  nextAttemptAt: Date;
  sentAt?: Date | null;
  error?: string;
  paymentLinkUrl?: string;
}
const schema = new Schema<IBookingPaymentNotice>({
  _id: { type: String, required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
  kind: { type: String, required: true, enum: ["remaining_payment_reminder", "tour_full_payment_confirmation", "airfare_payment_link"] },
  channel: { type: String, required: true, enum: ["email", "whatsapp"] },
  status: { type: String, enum: ["pending", "sending", "sent", "failed"], default: "pending" },
  attempts: { type: Number, default: 0 }, attemptedAt: { type: Date, default: null },
  nextAttemptAt: { type: Date, default: Date.now }, sentAt: { type: Date, default: null },
  error: { type: String, default: "" }, paymentLinkUrl: { type: String, default: "" },
}, { timestamps: true });
schema.index({ bookingId: 1, kind: 1, channel: 1 });
export const BookingPaymentNotice = (models.BookingPaymentNotice as Model<IBookingPaymentNotice> | undefined)
  || model<IBookingPaymentNotice>("BookingPaymentNotice", schema);

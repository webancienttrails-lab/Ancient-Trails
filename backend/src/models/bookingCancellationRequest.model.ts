import { model, models, Schema, type Model, type Types } from "mongoose";
import type { CancellationEstimate } from "../services/booking/booking.cancellation-estimate";

export interface IBookingCancellationRequest {
  bookingId: Types.ObjectId; reason: string; status: "requested" | "processing" | "refund_initiated" | "offline_refund_recorded";
  estimate: CancellationEstimate; requestedAt: Date; refundPercentage?: number; refundAmount?: number;
  refundMode?: "razorpay" | "offline"; adminNote?: string; processedAt?: Date;
  refundSegments?: Array<{ paymentId: string; amountPaise: number; receipt: string; refundId?: string; status: string }>;
}
const schema = new Schema<IBookingCancellationRequest>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["requested", "processing", "refund_initiated", "offline_refund_recorded"], default: "requested" },
  estimate: { type: Schema.Types.Mixed, required: true },
  requestedAt: { type: Date, default: Date.now },
  refundPercentage: { type: Number, min: 0, max: 100 },
  refundAmount: { type: Number, min: 0 },
  refundMode: { type: String, enum: ["razorpay", "offline"] },
  adminNote: { type: String, maxlength: 1000 },
  processedAt: { type: Date },
  refundSegments: { type: [{ _id: false, paymentId: String, amountPaise: Number, receipt: String, refundId: String, status: String }], default: [] },
});
export const BookingCancellationRequest = (models.BookingCancellationRequest as Model<IBookingCancellationRequest> | undefined)
  || model<IBookingCancellationRequest>("BookingCancellationRequest", schema);

import { model, models, Schema, type Model, type Types } from "mongoose";
import type { CancellationEstimate } from "../services/booking/booking.cancellation-estimate";

export interface IBookingCancellationRequest {
  bookingId: Types.ObjectId; reason: string; status: "requested";
  estimate: CancellationEstimate; requestedAt: Date;
}
const schema = new Schema<IBookingCancellationRequest>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["requested"], default: "requested" },
  estimate: { type: Schema.Types.Mixed, required: true },
  requestedAt: { type: Date, default: Date.now },
});
export const BookingCancellationRequest = (models.BookingCancellationRequest as Model<IBookingCancellationRequest> | undefined)
  || model<IBookingCancellationRequest>("BookingCancellationRequest", schema);

import { model, models, Schema, type Model } from "mongoose";

interface IBookingReferenceCounter {
  _id: string;
  value: number;
}

const counterSchema = new Schema<IBookingReferenceCounter>({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
}, { versionKey: false });

export const BookingReferenceCounter =
  (models.BookingReferenceCounter as Model<IBookingReferenceCounter> | undefined) ||
  model<IBookingReferenceCounter>("BookingReferenceCounter", counterSchema);
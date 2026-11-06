import { model, models, Schema, type Model, type Types } from "mongoose";

export interface IBookingReceiptShare {
  bookingId: Types.ObjectId;
  receiptId: string;
  tokenHash: string;
  filename: string;
  pdf: Buffer;
  expiresAt: Date;
}
const schema = new Schema<IBookingReceiptShare>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  receiptId: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  pdf: { type: Buffer, required: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
export const BookingReceiptShare = (models.BookingReceiptShare as Model<IBookingReceiptShare>) || model<IBookingReceiptShare>("BookingReceiptShare", schema);

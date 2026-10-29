import crypto from "node:crypto";
import { model, models, Schema, type Model } from "mongoose";
import { HttpError } from "../../utils/httpError";

interface OrderLock { _id: string; token: string; expiresAt: Date }
const schema = new Schema<OrderLock>({
  _id: { type: String, required: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const BookingOrderLock = (models.BookingOrderLock as Model<OrderLock> | undefined)
  || model<OrderLock>("BookingOrderLock", schema);

// The database lock also protects requests handled by another server process.
export async function withPaymentOrderLock<T>(scope: string, action: () => Promise<T>): Promise<T> {
  const token = crypto.randomUUID();
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      await BookingOrderLock.create({ _id: scope, token, expiresAt: new Date(Date.now() + 120000) });
      break;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      if (Date.now() >= deadline) throw new HttpError(409, "A payment order is already being created. Please retry shortly.");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  try { return await action(); }
  finally { await BookingOrderLock.deleteOne({ _id: scope, token }); }
}

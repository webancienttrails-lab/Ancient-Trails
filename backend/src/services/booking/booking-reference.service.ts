import { mongo, type ClientSession } from "mongoose";
import { BookingReferenceCounter } from "../../models/bookingReferenceCounter.model";
import { HttpError } from "../../utils/httpError";

export async function allocateBookingReference(tourType: string, session?: ClientSession) {
  const type = tourType.trim().toLowerCase();
  const prefix = type === "domestic" ? "D" : type === "international" ? "I" : null;
  if (!prefix) throw new HttpError(400, "Tour type must be Domestic or International to generate a booking ID");

  const filter = { _id: `booking:${prefix}` };
  const update = { $inc: { value: 1 } };
  let counter;
  try {
    counter = await BookingReferenceCounter.findOneAndUpdate(filter, update, {
      new: true, upsert: true, ...(session ? { session } : {}),
    });
  } catch (error) {
    // Concurrent first bookings can both try to insert the same counter.
    // Transactions retry as a whole; outside a transaction, increment the winning insert.
    if (session || !(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
    counter = await BookingReferenceCounter.findOneAndUpdate(filter, update, { new: true });
  }
  if (!counter || !Number.isSafeInteger(counter.value) || counter.value <= 0) {
    throw new HttpError(500, "Booking ID could not be generated");
  }
  return `AT-${prefix}${String(counter.value).padStart(4, "0")}`;
}
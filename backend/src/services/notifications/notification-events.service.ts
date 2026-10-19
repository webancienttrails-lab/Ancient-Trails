import mongoose from "mongoose";
import { Booking } from "../../models/booking.model";
import { User } from "../../models/user.model";
import { Tour } from "../../models/tour.model";
import { TourItinerary } from "../../models/tourItinerary.model";
import { TourDeparture } from "../../models/tourDeparture.model";
import { NotificationCursor, NotificationEvent } from "../../models/notification.model";
import { notificationKey } from "./notification-security";
import { bookingNotificationEvents } from "./notification-policy";

const processStartedAt = new Date();
let activation: Date | undefined;
export async function notificationActivationDate() {
  if (!activation) {
    const record = await NotificationCursor.findOneAndUpdate({ _id: "activation" }, { $setOnInsert: { at: processStartedAt } }, { upsert: true, new: true });
    activation = new Date(record!.at!);
  }
  return activation;
}
export async function stageNotificationEvent(key: string, kind: string, payload: Record<string, unknown>) {
  await NotificationEvent.updateOne({ _id: notificationKey(key) }, { $setOnInsert: {
    kind, payload, status: "pending", attempts: 0, nextAttemptAt: new Date(), createdAt: new Date(),
  } }, { upsert: true }).catch(error => { if (error?.code !== 11000) throw error; });
}
const pending = new Set<string>();
function background(key: string, action: () => Promise<unknown>) {
  if (mongoose.connection.readyState !== 1 || pending.has(key)) return;
  pending.add(key);
  setImmediate(() => { void action().catch(() => console.error("[notifications] Source event will be reconciled on the next maintenance run")).finally(() => pending.delete(key)); });
}
export async function recordBookingNotificationEvents(id: string) {
  const booking = await Booking.findById(id);
  if (!booking) return;
  for (const event of bookingNotificationEvents(booking, await notificationActivationDate())) await stageNotificationEvent(event.key, event.kind, event.payload);
}
export function queueBookingNotifications(id: string) { background("booking:" + id, () => recordBookingNotificationEvents(id)); }
export async function recordCustomerRegistration(id: string) {
  const user = await User.findById(id);
  if (!user || !user.roles.includes("traveller") || user.createdAt < await notificationActivationDate()) return;
  await stageNotificationEvent("registration:" + id, "customer_registered", { userId: id });
}
export function queueCustomerRegistration(id: string) { background("user:" + id, () => recordCustomerRegistration(id)); }

const fields: Record<string, string[]> = {
  tour: ["tourName", "description", "inclusions", "exclusions", "reportingAndDropping", "flightDetails", "accommodationDetails"],
  departure: ["departureDate", "returnDate", "status"],
  itinerary: ["itinerarySummary", "days"],
};
export function tourContentFingerprint(source: string, value: Record<string, any>) {
  return notificationKey(...(fields[source] || []).map(field => JSON.stringify(value[field] ?? null)));
}
async function recordTourChange(source: string, before: Record<string, any> | null, after: Record<string, any>) {
  const fingerprint = tourContentFingerprint(source, after), id = String(after._id || after.id);
  if (before && fingerprint !== tourContentFingerprint(source, before)) {
    await stageNotificationEvent(["tour-update", source, id, new Date(after.updatedAt || Date.now()).toISOString(), fingerprint].join(":"), "tour_update", {
      tourId: after.tourId, ...(source === "departure" ? { departureId: after.departureId } : {}),
      title: "Important tour update", body: source === "departure" ? "The dates or status of your booked departure have changed. Please review your booking or contact Ancient Trails." : "Important information for your booked tour has been updated. Please review the tour details or contact Ancient Trails.",
    });
  }
  await NotificationCursor.updateOne({ _id: "content:" + source + ":" + id }, { $set: { fingerprint } }, { upsert: true });
}
export function queueTourUpdate(source: "tour" | "departure" | "itinerary", before: Record<string, any>, after: Record<string, any>) {
  background("tour:" + source + ":" + String(after._id), () => recordTourChange(source, before, after));
}
export async function reconcileNotificationStream(name: "bookings" | "users") {
  const started = await notificationActivationDate();
  const state = await NotificationCursor.findOneAndUpdate({ _id: name }, { $setOnInsert: { at: started, lastId: "000000000000000000000000" } }, { upsert: true, new: true });
  const field = name === "users" ? "createdAt" : "updatedAt";
  const model: any = name === "users" ? User : Booking;
  // A transaction can commit after this checkpoint was advanced by another record.
  // Replay an overlapping window even after downtime; stable event IDs make this safe.
  const replayStart = new Date(Math.max(started.getTime(), new Date(state!.at!).getTime() - 15 * 60000));
  for await (const row of model.find({ [field]: { $gte: replayStart, $lte: state!.at } }).sort({ [field]: 1, _id: 1 }).cursor()) {
    if (name === "users") await recordCustomerRegistration(row.id); else await recordBookingNotificationEvents(row.id);
  }
  const rows = await model.find({ $or: [{ [field]: { $gt: state!.at } }, { [field]: state!.at, _id: { $gt: new mongoose.Types.ObjectId(state!.lastId!) } }] }).sort({ [field]: 1, _id: 1 }).limit(200);
  for (const row of rows) {
    if (name === "users") await recordCustomerRegistration(row.id); else await recordBookingNotificationEvents(row.id);
    await NotificationCursor.updateOne({ _id: name }, { $set: { at: row[field], lastId: row.id } });
  }
}
export async function reconcileNotificationSources() {
  await reconcileNotificationStream("users"); await reconcileNotificationStream("bookings");
  const now = Date.now(); let lastId = "000000000000000000000000";
  // Reuse the existing due-date policy, including its India-calendar seven-day window.
  for (;;) {
    const bookings = await Booking.find({ _id: { $gt: new mongoose.Types.ObjectId(lastId) }, bookingStatus: "confirmed", paymentStatus: "paid", amountPaid: { $gt: 0 }, balanceAmount: { $gt: 0 },
      $or: [{ balanceDueDate: { $gte: new Date(now - 86400000), $lte: new Date(now + 8 * 86400000) } }, { "pricingSnapshot.balanceDueDate": { $gte: new Date(now - 86400000), $lte: new Date(now + 8 * 86400000) } }],
    }).sort({ _id: 1 }).limit(100);
    for (const booking of bookings) await recordBookingNotificationEvents(booking.id);
    if (bookings.length < 100) break; lastId = bookings[bookings.length - 1]!.id;
  }
  for (const [source, model] of [["tour", Tour], ["departure", TourDeparture], ["itinerary", TourItinerary]] as const) {
    for await (const doc of (model as any).find({}).cursor()) {
      const state = await NotificationCursor.findById("content:" + source + ":" + doc.id);
      const fingerprint = tourContentFingerprint(source, doc);
      if (state?.fingerprint && state.fingerprint !== fingerprint) {
        await stageNotificationEvent(["tour-update", source, doc.id, new Date(doc.updatedAt).toISOString(), fingerprint].join(":"), "tour_update", {
          tourId: doc.tourId, ...(source === "departure" ? { departureId: doc.departureId } : {}), title: "Important tour update", body: "Important information for your booked tour has changed. Please review your booking and tour details.",
        });
      }
      await NotificationCursor.updateOne({ _id: "content:" + source + ":" + doc.id }, { $set: { fingerprint } }, { upsert: true });
    }
  }
}

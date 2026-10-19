import { randomUUID } from "node:crypto";
import { Booking, type BookingDocument } from "../../models/booking.model";
import { User, UserStatus } from "../../models/user.model";
import { Tour } from "../../models/tour.model";
import { BookingBalancePaymentSession } from "../../models/bookingBalancePaymentSession.model";
import { BookingPaymentSession } from "../../models/bookingPaymentSession.model";
import { SmartCollectTransfer } from "../../models/smartCollect.model";
import { BookingPaymentLinkRequest } from "../../models/bookingPaymentLinkRequest.model";
import { Notification, NotificationEvent, PushDelivery, PushRegistration, type INotificationEvent, type NotificationAudience } from "../../models/notification.model";
import { getMessaging } from "firebase-admin/messaging";
import { getFirebaseApp } from "../firebase-admin.service";
import { FIREBASE_PUSH_PROJECT, decryptRegistration, invalidRegistrationCode, notificationKey, retryDate, safeNotificationUrl } from "./notification-security";
import { reconcileNotificationSources } from "./notification-events.service";
import { indiaDateKey, paymentLifecycleState } from "../booking/booking.payment-lifecycle-policy";
import { isAdminRole } from "../../middleware/adminAuth";

const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
async function admins() { return User.find({ status: UserStatus.ACTIVE, $or: [{ roles: { $in: ["admin", "super_admin", "staff", "expert"] } }, { roles: /_admin$/ }] }); }
export async function bookingNotificationCustomer(booking: BookingDocument) {
  if (booking.notificationOwnerId) return User.findOne({ _id: booking.notificationOwnerId, status: UserStatus.ACTIVE, roles: "traveller" });
  const lead = booking.guestDetails[0], country = (lead?.countryCode || "91").replace(/\D/g, ""), number = (lead?.mobileNumber || "").replace(/\D/g, "");
  const canonical = number.length === 10 ? country + number : number;
  if (!/^\d{10,15}$/.test(canonical)) return null;
  // Match a verified lead-traveller phone; an editable email alone is not an ownership proof.
  const user = await User.findOne({ mobileNumber: canonical, isMobileVerified: true, status: UserStatus.ACTIVE, roles: "traveller" });
  if (user) {
    const result = await Booking.updateOne({ _id: booking._id, notificationOwnerId: { $exists: false } }, { $set: { notificationOwnerId: user.id } });
    if (result.matchedCount === 0) {
      // Another event may have pinned ownership while this lead-phone lookup was running.
      const bound = await Booking.findById(booking._id).select("notificationOwnerId");
      return bound?.notificationOwnerId ? User.findOne({ _id: bound.notificationOwnerId, status: UserStatus.ACTIVE, roles: "traveller" }) : null;
    }
  }
  return user;
}
async function notify(event: INotificationEvent, userId: string, audience: NotificationAudience, title: string, body: string, url: string) {
  const id = notificationKey(event._id, userId, audience);
  await Notification.updateOne({ _id: id }, { $setOnInsert: { recipientId: userId, audience, eventId: event._id, kind: event.kind,
    title: title.slice(0, 160), body: body.slice(0, 1500), url: audience === "customer" && ["booking_cancelled", "refund_confirmed"].includes(event.kind) ? "/me/notifications/" + id : safeNotificationUrl(url, audience), readAt: null, createdAt: event.createdAt,
  } }, { upsert: true }).catch(error => { if (error?.code !== 11000) throw error; });
  const devices = await PushRegistration.find({ userId, audience, active: true, lastSeenAt: { $gte: new Date(Date.now() - 90 * 86400000) } });
  for (const device of devices) await PushDelivery.updateOne({ _id: notificationKey(id, device.id, device.bindingId) }, { $setOnInsert: {
    notificationId: id, registrationId: device.id, bindingId: device.bindingId, status: "pending", attempts: 0, nextAttemptAt: new Date(),
  } }, { upsert: true }).catch(error => { if (error?.code !== 11000) throw error; });
}
async function notifyBooking(event: INotificationEvent, booking: BookingDocument, title: string, body: string, adminOnly = false, customerOnly = false) {
  if (!customerOnly) for (const admin of await admins()) await notify(event, admin.id, "admin", title, body, "/bookings/view?bookingId=" + booking.id);
  if (!adminOnly) { const customer = await bookingNotificationCustomer(booking); if (customer) await notify(event, customer.id, "customer", title, body, "/me/bookings/" + booking.id); }
}
export async function materializeNotificationEvent(event: INotificationEvent) {
  if (event.kind === "customer_registered") {
    const user = await User.findById(event.payload.userId);
    if (!user || !user.roles.includes("traveller")) return;
    for (const admin of await admins()) await notify(event, admin.id, "admin", "New customer registration", [user.firstName, user.lastName].filter(Boolean).join(" ") || "A new customer has registered.", "/users");
    return;
  }
  if (event.kind === "tour_update") {
    const query = { tourId: event.payload.tourId, ...(event.payload.departureId ? { departureId: event.payload.departureId } : {}), bookingStatus: "confirmed" as const, paymentStatus: "paid" as const, amountPaid: { $gt: 0 }, archivedAt: null };
    for await (const booking of Booking.find(query).cursor()) {
      // A recurring tour edit should not alert customers whose trip has already ended.
      const end = booking.pricingSnapshot?.returnDate || booking.pricingSnapshot?.departureDate;
      if (end && Number.isFinite(new Date(end).getTime()) && indiaDateKey(new Date(end)) < indiaDateKey(new Date())) continue;
      if (event.createdAt && booking.createdAt && booking.createdAt > event.createdAt) continue;
      const customer = await bookingNotificationCustomer(booking);
      if (customer) await notify(event, customer.id, "customer", event.payload.title || "Important tour update", event.payload.body || "Please review the latest details for your booked tour.", "/me/bookings/" + booking.id);
    }
    return;
  }
  if (event.kind === "refund_candidate") {
    // The signature has already been checked. Independently verify the provider record before notifying anyone.
    const { createRazorpayClient } = await import("../../controllers/booking.controller.js");
    const razorpay = createRazorpayClient(), refund = await razorpay.refunds.fetch(event.payload.refundId);
    if (refund.id !== event.payload.refundId || refund.status !== "processed") throw new Error("refund-not-yet-processed");
    if (!refund.payment_id || refund.currency !== "INR" || Number(refund.amount) <= 0) throw new Error("invalid-refund-record");
    const payment = await razorpay.payments.fetch(refund.payment_id);
    if (payment.id !== refund.payment_id || !["captured", "refunded"].includes(payment.status) || payment.currency !== "INR" || Number(payment.amount) < Number(refund.amount)) throw new Error("refund-payment-mismatch");
    let booking = await Booking.findOne({ $or: [{ paymentId: refund.payment_id }, { "collectionHistory.paymentId": refund.payment_id }] });
    if (!booking) { const link = await BookingPaymentLinkRequest.findOne({ razorpayPaymentId: refund.payment_id, status: "paid" }); if (link) booking = await Booking.findById(link.bookingId); }
    if (!booking) {
      const [balance, initial, transfer] = await Promise.all([
        BookingBalancePaymentSession.findOne({ razorpayPaymentId: refund.payment_id, status: "paid" }),
        BookingPaymentSession.findOne({ razorpayPaymentId: refund.payment_id, status: "paid" }),
        SmartCollectTransfer.findOne({ paymentId: refund.payment_id, status: { $in: ["applied", "review"] } }),
      ]);
      const bookingId = balance?.bookingId || initial?.bookingId || transfer?.bookingId;
      if (bookingId) booking = await Booking.findById(bookingId);
    }
    if (!booking) throw new Error("refund-booking-not-found");
    const verified = { ...event, _id: event._id, createdAt: event.createdAt, kind: "refund_confirmed" };
    await notifyBooking(verified, booking, "Refund confirmed", (booking.bookingReference || booking.id) + ": a verified refund of " + currency(Number(refund.amount) / 100) + " has been processed.");
    return;
  }
  const booking = await Booking.findById(event.payload.bookingId);
  if (!booking) return;
  const ref = booking.bookingReference || booking.id, tour = await Tour.findOne({ tourId: booking.tourId }), name = tour?.tourName || booking.tourId;
  switch (event.kind) {
    case "booking_confirmed":
      if (booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid") await notifyBooking(event, booking, "Booking confirmed", ref + " for " + name + " is confirmed."); break;
    case "advance_payment_received":
    case "full_payment_received":
      if (["cancelled", "expired"].includes(booking.bookingStatus || "")) break;
      await notifyBooking(event, booking, event.kind === "full_payment_received" ? "Full payment received" : "Advance payment received", ref + ": amount paid to date " + currency(Number(event.payload.amountPaid)) + "."); break;
    case "booking_cancelled":
      if (booking.bookingStatus === "cancelled") await notifyBooking(event, booking, "Booking cancelled", ref + " for " + name + " has been cancelled. " + (booking.cancellation?.reason || "")); break;
    case "offline_payment_pending":
      if (booking.bookingStatus === "payment_pending" && booking.paymentStatus === "pending") await notifyBooking(event, booking, "Offline payment needs verification", ref + " for " + name + " is awaiting verification.", true); break;
    case "remaining_payment_reminder": {
      const state = paymentLifecycleState(booking);
      if (state.reminderDue && indiaDateKey(state.dueDate!) === event.payload.dueDate) await notifyBooking(event, booking, "Remaining payment reminder", ref + ": " + currency(state.balance) + " is due on " + new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" }).format(state.dueDate!) + ". Open your booking to pay.", false, true);
    }
  }
}
export async function deliverPush(delivery: { notificationId: string; registrationId: string; bindingId: string }) {
  const [notice, device] = await Promise.all([Notification.findById(delivery.notificationId), PushRegistration.findById(delivery.registrationId).select("+encryptedIdentifier")]);
  if (!notice || !device?.active || device.bindingId !== delivery.bindingId || device.userId !== notice.recipientId || device.audience !== notice.audience) return "skipped";
  if (["remaining_payment_reminder", "offline_payment_pending"].includes(notice.kind)) {
    const event = await NotificationEvent.findById(notice.eventId);
    const booking = event?.payload.bookingId ? await Booking.findById(event.payload.bookingId) : null;
    if (!booking) return "skipped";
    if (notice.kind === "remaining_payment_reminder") {
      const state = paymentLifecycleState(booking);
      if (!state.reminderDue || indiaDateKey(state.dueDate!) !== event?.payload.dueDate) return "skipped";
    } else if (booking.bookingStatus !== "payment_pending" || booking.paymentStatus !== "pending") return "skipped";
  }
  const user = await User.findById(device.userId);
  if (!user || user.status !== "active" || !(device.audience === "admin" ? user.roles.some(isAdminRole) : user.roles.includes("traveller"))) return "skipped";
  if (!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true")) throw new Error("push-credentials-not-configured");
  const app = getFirebaseApp(); if (app.options.projectId !== FIREBASE_PUSH_PROJECT) throw new Error("push-project-mismatch");
  try {
    await getMessaging(app).send({ fid: decryptRegistration(device.encryptedIdentifier), data: {
      notificationId: notice._id, bindingId: device.bindingId, title: notice.title, body: "Open your Ancient Trails notification inbox to view this update.", url: safeNotificationUrl(notice.url, notice.audience),
    }, webpush: { headers: { TTL: "86400", Urgency: "normal" } } });
    return "sent";
  } catch (error) {
    const code = (error as { code?: string }).code || "unknown";
    if (invalidRegistrationCode(code)) { await PushRegistration.updateOne({ _id: device._id, bindingId: device.bindingId }, { $set: { active: false } }); return "invalid"; }
    throw new Error(code);
  }
}
let running = false, lastScan = 0;
export async function runNotificationMaintenance() {
  if (running) return; running = true;
  try {
    if (Date.now() - lastScan >= 60000) { try { await reconcileNotificationSources(); lastScan = Date.now(); } catch { console.error("[notifications] Source reconciliation will retry"); } }
    for (const [model, action, limit] of [[NotificationEvent, materializeNotificationEvent, 25], [PushDelivery, deliverPush, 75]] as const) {
      for (let index = 0; index < limit; index++) {
        const now = new Date(), leaseToken = randomUUID();
        const job = await (model as any).findOneAndUpdate({ nextAttemptAt: { $lte: now }, $or: [{ status: "pending" }, { status: "sending", leaseUntil: { $lt: now } }] }, { $set: { status: "sending", leaseToken, leaseUntil: new Date(Date.now() + 120000) }, $inc: { attempts: 1 } }, { new: true, sort: { nextAttemptAt: 1 } });
        if (!job) break;
        const heartbeat = setInterval(() => { void (model as any).updateOne({ _id: job._id, leaseToken }, { $set: { leaseUntil: new Date(Date.now() + 120000) } }).catch(() => {}); }, 30000);
        try {
          const outcome = await (action as (value: any) => Promise<unknown>)(job);
          await (model as any).updateOne({ _id: job._id, leaseToken }, { $set: { status: outcome === "invalid" || outcome === "skipped" ? outcome : "sent", completedAt: new Date(), sentAt: new Date(), error: "" }, $unset: { leaseUntil: "", leaseToken: "" } });
        } catch (error) {
          // Store only controlled error codes, never provider responses, credentials, FIDs or tokens.
          const code = error instanceof Error && /^[a-zA-Z0-9/_-]{1,100}$/.test(error.message) ? error.message : "notification-delivery-failed";
          await (model as any).updateOne({ _id: job._id, leaseToken }, { $set: { status: job.attempts >= 10 ? "failed" : "pending", nextAttemptAt: retryDate(job.attempts), error: code }, $unset: { leaseUntil: "", leaseToken: "" } });
        } finally { clearInterval(heartbeat); }
      }
    }
  } catch { console.error("[notifications] Maintenance will retry"); }
  finally { running = false; }
}

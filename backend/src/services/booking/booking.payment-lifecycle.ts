import crypto from "node:crypto";
import type { Types } from "mongoose";
import { Booking, type BookingDocument } from "../../models/booking.model";
import { BookingPaymentNotice, type IBookingPaymentNotice } from "../../models/bookingPaymentNotice.model";
import type { BookingPaymentLinkRequestDocument } from "../../models/bookingPaymentLinkRequest.model";
import { TourDeparture } from "../../models/tourDeparture.model";
import { Tour } from "../../models/tour.model";
import { sendBookingPaymentNoticeEmail, sendTourFullPaymentConfirmationEmail } from "../booking-confirmation-email.service";
import { sendRemainingPaymentReminderWhatsapp, sendTourFullPaymentConfirmationWhatsapp, sendBookingPaymentLinkWhatsapp } from "../msg91-whatsapp.service";
import { indiaDateKey, paymentLifecycleState } from "./booking.payment-lifecycle-policy";

type Kind = IBookingPaymentNotice["kind"];
type Channel = IBookingPaymentNotice["channel"];
export type PaymentLifecycleHooks = {
  withLock: <T>(id: string, action: () => Promise<T>) => Promise<T>;
  prepareLink: (booking: BookingDocument, airfare: boolean, expiresAt: Date) => Promise<BookingPaymentLinkRequestDocument>;
  syncPayments: (ids: Types.ObjectId[]) => Promise<void>;
  closePaidLinks: (booking: BookingDocument) => Promise<void>;
};
const amount = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
const date = (value: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" }).format(value);
export function paymentNoticeKey(bookingId: string, kind: Kind, version: string, channel: Channel) {
  return kind + ":" + crypto.createHash("sha256").update([bookingId, kind, version, channel].join("|")).digest("hex");
}
async function deliver(booking: BookingDocument, kind: Kind, version: string, channel: Channel, now: Date, action: (id: string) => Promise<unknown>) {
  const id = paymentNoticeKey(booking.id, kind, version, channel);
  await BookingPaymentNotice.updateOne({ _id: id }, { $setOnInsert: {
    bookingId: booking._id, kind, channel, status: "pending", attempts: 0, nextAttemptAt: now,
  } }, { upsert: true }).catch((error: unknown) => {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) throw error;
  });
  const claimed = await BookingPaymentNotice.findOneAndUpdate({
    _id: id, nextAttemptAt: { $lte: now },
    $or: [{ status: { $in: ["pending", "failed"] } }, { status: "sending", attemptedAt: { $lt: new Date(now.getTime() - 15 * 60000) } }],
  }, { $set: { status: "sending", attemptedAt: now }, $inc: { attempts: 1 } }, { new: true });
  if (claimed) {
    try {
      await action(id);
      await BookingPaymentNotice.updateOne({ _id: id }, { $set: { status: "sent", sentAt: new Date(), error: "" } });
    } catch (error) {
      await BookingPaymentNotice.updateOne({ _id: id }, { $set: { status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "Payment notification failed",
        nextAttemptAt: new Date(now.getTime() + Math.min(360, 5 * 2 ** Math.min(claimed.attempts - 1, 7)) * 60000),
      } });
      console.error("[booking-payment-notice] Delivery requires retry: " + id);
    }
  }
  return (await BookingPaymentNotice.findById(id))?.status === "sent";
}

export async function processBookingPaymentLifecycle(bookingId: string, hooks: PaymentLifecycleHooks, now = new Date()) {
  await hooks.withLock(bookingId, async () => {
    let booking = await Booking.findById(bookingId);
    if (!booking) return;
    await hooks.syncPayments([booking._id]);
    booking = await Booking.findById(bookingId);
    if (!booking) return;
    const state = paymentLifecycleState(booking, now);
    if (!state.fullyPaid && !state.reminderDue && !state.airfareDue) return;
    const current = booking;
    const lead = booking.guestDetails[0];
    const travellerName = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || "Traveller";
    const recipientEmail = lead?.email?.trim() || "";
    const country = lead?.countryCode?.replace(/\D/g, "") || "91";
    const mobile = lead?.mobileNumber?.replace(/\D/g, "") || "";
    const recipientNumber = mobile.startsWith(country) && mobile.length > 10 ? mobile : country + mobile;
    const tour = await Tour.findOne({ tourId: booking.tourId });
    const tourName = tour?.tourName || booking.tourId;
    const reference = booking.bookingReference || booking.id;
    const kind: Kind = state.fullyPaid ? "tour_full_payment_confirmation" : state.airfareDue ? "airfare_payment_link" : "remaining_payment_reminder";
    const version = state.fullyPaid ? String(state.total) : [state.total, state.paid, state.dueDate ? indiaDateKey(state.dueDate) : "airfare", booking.airFlightCharges || 0].join(":");
    const expiresAt = state.dueDate && state.dueDate > now ? new Date(state.dueDate.getTime() + 86400000) : new Date(now.getTime() + 7 * 86400000);
    let closedLinks: Promise<void> | undefined;
    let linkPromise: Promise<BookingPaymentLinkRequestDocument> | undefined;
    const link = () => linkPromise ||= hooks.prepareLink(current, kind === "airfare_payment_link", expiresAt);
    const channels: Channel[] = kind === "airfare_payment_link" ? ["whatsapp"] : ["email", "whatsapp"];
    const results = await Promise.all(channels.map(channel => deliver(current, kind, version, channel, now, async id => {
      if (channel === "whatsapp" && !/^\d{10,15}$/.test(recipientNumber)) throw new Error("Lead traveller mobile number is missing or invalid");
      if (kind === "tour_full_payment_confirmation") {
        await (closedLinks ||= hooks.closePaidLinks(current));
        const paymentDate = date(current.paymentCapturedAt || now);
        if (channel === "whatsapp") return sendTourFullPaymentConfirmationWhatsapp({ recipientNumber, travellerName, tourName,
          bookingReference: reference, amountPaid: amount(state.paid), paymentDate, crqId: id });
        const departure = current.departureId ? await TourDeparture.findOne({ departureId: current.departureId }) : null;
        const departureDate = departure?.departureDate || current.pricingSnapshot?.departureDate;
        const returnDate = departure?.returnDate || current.pricingSnapshot?.returnDate;
        const durationDays = departureDate && returnDate
          ? Math.round((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / 86400000) : 0;
        return sendTourFullPaymentConfirmationEmail({
          bookingId: current.id, bookingReference: reference, recipientEmail, travellerName, tourName,
          departureDate, returnDate,
          durationLabel: tour?.durationDn || (durationDays > 0 ? (durationDays + 1) + " Days / " + durationDays + " Nights" : "-"),
          travellersLabel: [current.adultCount ? current.adultCount + (current.adultCount === 1 ? " Adult" : " Adults") : "",
            current.childCount ? current.childCount + (current.childCount === 1 ? " Child" : " Children") : ""].filter(Boolean).join(", "),
          totalAmount: state.total, amountPaid: state.paid, balanceAmount: 0,
          confirmedAt: current.paymentCapturedAt || now,
          airFlightCharges: current.airFlightCharges || 0, airfareExcluded: current.airfareExcluded,
          airfareAddedAt: current.airfareAddedAt, airfareIncludedInTotal: current.airfareIncludedInTotal,
        });
      }
      const paymentLink = await link();
      await BookingPaymentNotice.updateOne({ _id: id }, { $set: { paymentLinkUrl: paymentLink.paymentLinkUrl } });
      if (kind === "airfare_payment_link") {
        if (paymentLink.whatsappStatus === "sent") return;
        const result = await sendBookingPaymentLinkWhatsapp({ recipientNumber, travellerName, tourName, bookingReference: reference,
          amount: amount(state.balance), paymentPurpose: "Air-Flight Charges (Additional)", paymentUrl: paymentLink.paymentLinkUrl, crqId: id });
        paymentLink.whatsappStatus = "sent"; paymentLink.whatsappRequestId = result.requestId;
        paymentLink.whatsappRecipient = recipientNumber; paymentLink.whatsappError = "";
        if (paymentLink.status === "created") paymentLink.status = "sent";
        await paymentLink.save();
        return;
      }
      const dueDate = date(state.dueDate!);
      if (channel === "whatsapp") return sendRemainingPaymentReminderWhatsapp({ recipientNumber, travellerName, dueDate, tourName,
        bookingReference: reference, totalAmount: amount(state.total), amountPaid: amount(state.paid), remainingAmount: amount(state.balance),
        paymentUrl: paymentLink.paymentLinkUrl, crqId: id });
      return sendBookingPaymentNoticeEmail({ recipientEmail, subject: "Remaining payment due " + dueDate + " - " + reference, paymentUrl: paymentLink.paymentLinkUrl, lines: [
        "Hello " + travellerName + ",", "Greetings from Ancient Trails!",
        "This is a friendly reminder that the remaining payment for your upcoming tour is due on " + dueDate + ".",
        "Tour: " + tourName, "Booking ID: " + reference, "Total Tour Amount: ?" + amount(state.total),
        "Amount Paid: ?" + amount(state.paid), "Remaining Amount: ?" + amount(state.balance),
        "Kindly complete your remaining payment before the due date to keep your booking payments up to date.",
        "Pay Remaining Amount: " + paymentLink.paymentLinkUrl,
        "If you have already completed the payment, please disregard this reminder.", "Thank you,", "Team Ancient Trails",
      ] });
    })));
    if (results.every(Boolean)) await Booking.updateOne({ _id: bookingId }, { $set: { paymentLifecyclePending: false } });
  });
}

export function queueBookingPaymentLifecycle(booking: BookingDocument, hooks: PaymentLifecycleHooks) {
  const state = paymentLifecycleState(booking);
  if (!state.fullyPaid && !state.airfareDue) return;
  setTimeout(() => {
    void Booking.updateOne({ _id: booking._id, bookingStatus: "confirmed", paymentStatus: "paid" }, { $set: { paymentLifecyclePending: true } })
      .then(() => processBookingPaymentLifecycle(booking.id, hooks))
      .catch(() => console.error("[booking-payment-notice] Scheduled delivery will retry for " + booking.id));
  }, 0);
}
let maintenanceRunning = false;
export async function runBookingPaymentLifecycleMaintenance(hooks: PaymentLifecycleHooks, now = new Date()) {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    // An eight-day UTC envelope covers seven calendar days in India; exact eligibility is checked above.
    const bookings = await Booking.find({ bookingStatus: "confirmed", paymentStatus: "paid", archivedAt: null, $or: [
      { paymentLifecyclePending: true },
      { amountPaid: { $gt: 0 }, balanceDueDate: { $gte: new Date(now.getTime() - 86400000), $lte: new Date(now.getTime() + 8 * 86400000) }, balanceAmount: { $gt: 0 } },
      { amountPaid: { $gt: 0 }, "pricingSnapshot.balanceDueDate": { $gte: new Date(now.getTime() - 86400000), $lte: new Date(now.getTime() + 8 * 86400000) }, balanceAmount: { $gt: 0 } },
    ] }).select("_id").limit(300);
    for (const booking of bookings) {
      try { await processBookingPaymentLifecycle(booking.id, hooks, now); }
      catch { console.error("[booking-payment-notice] Payment maintenance will retry for " + booking.id); }
    }
  } catch {
    console.error("[booking-payment-notice] Unable to load scheduled notices; the next maintenance run will retry");
  } finally { maintenanceRunning = false; }
}

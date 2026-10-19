import { queueBookingNotifications } from "../notifications/notification-events.service";
import { Booking } from "../../models/booking.model";
import { Tour } from "../../models/tour.model";
import { sendBookingAlertEmail } from "../booking-confirmation-email.service";
import { sendOfflineBookingAdminWhatsapp } from "../msg91-whatsapp.service";

export async function notifyOfflineBookingAdmins(bookingId: string) {
  queueBookingNotifications(bookingId);
  await Promise.allSettled((["Email", "Whatsapp"] as const).map(async channel => {
    const status = `offlineAdmin${channel}Status`;
    const attempted = `offlineAdmin${channel}AttemptedAt`;
    const errorField = `offlineAdmin${channel}Error`;
    const booking = await Booking.findOneAndUpdate({
      _id: bookingId, paymentMode: "offline", paymentStatus: "pending", bookingStatus: "payment_pending",
      [status]: { $ne: "sent" },
      $or: [{ [status]: { $ne: "sending" } }, { [attempted]: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }],
    }, { $set: { [status]: "sending", [attempted]: new Date() } }, { new: true });
    if (!booking) return;
    try {
      const tour = await Tour.findOne({ tourId: booking.tourId });
      const lead = booking.guestDetails[0];
      const travellerName = [lead?.title, lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || "Traveller";
      const travellerPhone = [lead?.countryCode, lead?.mobileNumber].filter(Boolean).join(" ");
      const bookingReference = booking.bookingReference || booking._id.toString();
      const tourName = tour?.tourName || booking.tourId;
      const departureDate = booking.pricingSnapshot?.departureDate;
      if (channel === "Email") {
        const result = await sendBookingAlertEmail({
          offlinePending: true,
          bookingId: booking._id.toString(), bookingReference,
          travellerName, travellerPhone, travellerEmail: lead?.email || "", recipientEmail: lead?.email || "",
          tourName, departureDate, returnDate: booking.pricingSnapshot?.returnDate,
          confirmedAt: booking.createdAt,
          totalAmount: booking.grandTotal || 0, amountPaid: 0, balanceAmount: booking.grandTotal || 0,
          balanceDueDate: booking.balanceDueDate,
          travellersLabel: String(booking.totalGuest),
        });
        if (!result.recipients.length) throw new Error("No admin email recipients configured");
      } else {
        await sendOfflineBookingAdminWhatsapp({
          travellerName, bookingReference, tourName, travellerPhone,
          departureDate: departureDate ? new Date(departureDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "To be arranged",
          totalAmount: String(booking.grandTotal || 0),
          totalGuests: String(booking.totalGuest),
          paymentMethod: "Offline (Cash / Cheque)",
        });
      }
      await Booking.updateOne({ _id: booking._id }, { $set: { [status]: "sent", [errorField]: "" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await Booking.updateOne({ _id: booking._id }, { $set: { [status]: "failed", [errorField]: message.slice(0, 500) } });
      console.error(`[offline-booking-${channel}] ${bookingId}: ${message}`);
    }
  }));
}

export async function retryOfflineBookingAlerts() {
  const bookings = await Booking.find({
    paymentMode: "offline", paymentStatus: "pending", bookingStatus: "payment_pending",
    $or: [{ offlineAdminEmailStatus: { $ne: "sent" } }, { offlineAdminWhatsappStatus: { $ne: "sent" } }],
  }).select("_id").limit(25);
  await Promise.allSettled(bookings.map(booking => notifyOfflineBookingAdmins(booking._id.toString())));
}
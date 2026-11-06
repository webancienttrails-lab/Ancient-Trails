import type { Request, Response } from "express";
import { splitBookingGst } from "../services/booking/booking-tax-settings";
import { Booking } from "../models/booking.model";
import { Enquiry } from "../models/enquiry.model";
import { Tour } from "../models/tour.model";
import { TourDeparture } from "../models/tourDeparture.model";
import { buildAdminReport, getReportPeriod, reportRanges, type ReportDays } from "../services/reports.service";
import { HttpError } from "../utils/httpError";

export async function getAdminReport(request: Request, response: Response): Promise<void> {
  const rawDays = request.query.days ?? "30";
  if (typeof rawDays !== "string" || !reportRanges.includes(Number(rawDays) as ReportDays)) {
    throw new HttpError(400, "Select a report period of 30, 90, 180 or 365 days.");
  }
  const days = Number(rawDays) as ReportDays;
  const now = new Date();
  const { previousStart, end } = getReportPeriod(days, now);
  const dates = { $gte: previousStart, $lt: end };
  const [bookings, tours, departures, enquiries] = await Promise.all([
    Booking.find({ createdAt: dates }).select("tourId departureId createdAt bookingStatus paymentStatus paymentCurrency amountPaid totalGuest").lean(),
    Tour.find({}).select("tourId tourName category tourType").lean(),
    TourDeparture.find({}).select("departureId tourId totalSeats seatsAvailable").lean(),
    Enquiry.find({ createdAt: dates }).select("createdAt status").lean(),
  ]);
  response.setHeader("Cache-Control", "private, no-store");
  response.status(200).json({ success: true, message: "Report loaded successfully", data: buildAdminReport({ days, now, bookings, tours, departures, enquiries }) });
}

export async function getAdminReportInvoices(_request: Request, response: Response): Promise<void> {
  const [bookings, tours] = await Promise.all([
    Booking.find({ archivedAt: null }).select("bookingReference tourId createdAt paymentCapturedAt paymentStatus totalGuest guestDetails subtotal gstPercentage gstAmount tcsAmount airFlightCharges grandTotal packageTotal pricingSnapshot").sort({ createdAt: -1 }).lean(),
    Tour.find({}).select("tourId tourName").lean(),
  ]);
  const tourNames = new Map(tours.map(tour => [tour.tourId, tour.tourName]));
  response.setHeader("Cache-Control", "private, no-store");
  response.status(200).json({
    success: true,
    message: "Invoice report loaded successfully",
    data: {
      tours: tours.map(tour => ({ tourId: tour.tourId, tourName: tour.tourName })),
      invoices: bookings.map(booking => ({
        id: String(booking._id),
        invoiceNumber: booking.bookingReference || String(booking._id),
        date: booking.paymentCapturedAt || booking.createdAt,
        clientName: [booking.guestDetails?.[0]?.firstName, booking.guestDetails?.[0]?.lastName].filter(Boolean).join(" ") || booking.guestDetails?.[0]?.email || "Traveller",
        members: booking.totalGuest || 0,
        tourId: booking.tourId,
        tourName: tourNames.get(booking.tourId) || booking.tourId,
        beforeTax: booking.subtotal || 0,
        ...splitBookingGst(booking),
        tcs: booking.tcsAmount || 0,
        withTax: (booking.subtotal || 0) + (booking.gstAmount || 0) + (booking.tcsAmount || 0),
        fare: booking.airFlightCharges || 0,
        total: booking.grandTotal ?? booking.packageTotal ?? 0,
        remark: booking.paymentStatus === "paid" ? "Paid" : booking.paymentStatus === "refunded" ? "Refunded" : "",
      })),
    },
  });
}

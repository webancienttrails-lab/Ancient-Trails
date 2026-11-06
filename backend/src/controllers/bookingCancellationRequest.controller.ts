import { bookingTourModel, bookingDepartureModel } from "../services/booking/booking-tour-scope";
import crypto from "node:crypto";
import mongoose, { type HydratedDocument } from "mongoose";
import type { Request, Response } from "express";
import type { Refunds } from "razorpay/dist/types/refunds";
import { z } from "zod";
import { formatBooking, getAuthenticatedTravellerBookingById } from "./booking.controller";
import { BookingCancellationRequest, type IBookingCancellationRequest } from "../models/bookingCancellationRequest.model";
import { Booking } from "../models/booking.model";
import { BookingPaymentSession } from "../models/bookingPaymentSession.model";
import { BookingPaymentLinkRequest } from "../models/bookingPaymentLinkRequest.model";
import { cancellationEstimate } from "../services/booking/booking.cancellation-estimate";
import { stageNotificationEvent, queueBookingNotifications } from "../services/notifications/notification-events.service";
import { createRazorpayClient, restoreDepartureSeats } from "./booking.controller";
import { HttpError } from "../utils/httpError";

async function preview(request: Request) {
  const booking = await getAuthenticatedTravellerBookingById(request);
  const existingRequest = await BookingCancellationRequest.findOne({ bookingId: booking._id });
  const [tour, departure] = await Promise.all([
    bookingTourModel(booking.tourScope).findOne({ tourId: booking.tourId }),
    booking.departureId ? bookingDepartureModel(booking.tourScope).findOne({ departureId: booking.departureId }) : Promise.resolve(null),
  ]);
  const date = departure?.departureDate || booking.pricingSnapshot?.departureDate;
  const estimate = date ? cancellationEstimate(booking, new Date(date), tour?.cancellationPolicy || []) : null;
  const canRequest = Boolean(estimate && estimate.daysBeforeDeparture > 0
    && !["cancelled", "expired", "draft"].includes(booking.bookingStatus || "")
    && !["cancelled", "completed"].includes(departure?.status || ""));
  const quoteHash = crypto.createHash("sha256").update(JSON.stringify(estimate)).digest("hex");
  return { booking, existingRequest, canRequest, estimate, quoteHash, policyHref: "/terms-and-conditions#cancellation-policy" };
}
function headers(response: Response) { response.setHeader("Cache-Control", "private, no-store"); }
export async function getCancellationRequestPreview(request: Request, response: Response) {
  headers(response);
  const { booking: _booking, ...data } = await preview(request);
  response.json({ success: true, message: "Cancellation estimate fetched", data });
}
export async function requestBookingCancellation(request: Request, response: Response) {
  headers(response);
  const parsed = z.object({ reason: z.string().trim().min(5).max(1000), quoteHash: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Provide a cancellation reason (5-1000 characters) and review the current estimate");
  const state = await preview(request);
  if (state.existingRequest) {
    response.json({ success: true, message: "Your cancellation request is already recorded. Our team will review it.", data: { request: state.existingRequest } });
    return;
  }
  if (!state.canRequest || !state.estimate) throw new HttpError(409, "Cancellation requests are available only for upcoming active bookings");
  if (parsed.data.quoteHash !== state.quoteHash) throw new HttpError(409, "The cancellation estimate has changed. Review the updated amount before confirming.");
  await BookingCancellationRequest.createIndexes();
  const estimate = state.estimate;
  let record: HydratedDocument<IBookingCancellationRequest> | null = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const records = await BookingCancellationRequest.create([{ bookingId: state.booking._id, reason: parsed.data.reason,
        status: "requested" as const, estimate, requestedAt: new Date() }], { session });
      record = records[0];
      await stageNotificationEvent("cancellation-request:" + record.id, "cancellation_requested", {
        bookingId: state.booking.id, requestId: record.id, reason: record.reason,
        estimatedRefund: estimate.estimatedRefund,
      }, session);
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    record = await BookingCancellationRequest.findOne({ bookingId: state.booking._id });
    if (!record) throw error;
  } finally { await session.endSession(); }
  response.status(201).json({ success: true, message: "Cancellation request received. Our team will review it and confirm any manual refund. Your booking has not yet been cancelled.", data: { request: record } });
}

export async function startCancellationRefund(request: Request, response: Response) {
  headers(response);
  const parsed = z.object({ refundPercentage: z.number().min(0).max(100), refundAmount: z.number().positive().max(100_000_000), adminNote: z.string().trim().max(1000).default("") }).strict().safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Enter a valid refund percentage and amount");
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw new HttpError(404, "Booking not found");
  const cancellation = await BookingCancellationRequest.findOne({ bookingId: booking._id });
  if (!cancellation) throw new HttpError(404, "No cancellation request exists for this booking");
  if (["refund_initiated", "offline_refund_recorded"].includes(cancellation.status)) throw new HttpError(409, "This cancellation request has already been processed");
  if (booking.bookingStatus === "cancelled") throw new HttpError(409, "This booking is already cancelled");

  const hasGatewayPayment = Boolean(booking.paymentProvider === "razorpay" || booking.paymentId || booking.collectionHistory?.some(item => item.paymentId));
  const mode = booking.paymentMode === "offline" || (!hasGatewayPayment && booking.paymentMode !== "online") ? "offline" : "razorpay";
  const amountPaise = Math.round(parsed.data.refundAmount * 100);
  if (mode === "offline" && parsed.data.refundAmount > Number(booking.amountPaid || 0)) {
    throw new HttpError(400, "Offline refund cannot exceed the amount recorded as paid");
  }
  let requestDoc = cancellation;
  let segments = cancellation.refundSegments || [];

  if (cancellation.status === "processing") {
    if (cancellation.refundAmount !== parsed.data.refundAmount || cancellation.refundPercentage !== parsed.data.refundPercentage || cancellation.refundMode !== mode) {
      throw new HttpError(409, "A refund attempt is already in progress with a different amount");
    }
  } else if (mode === "razorpay") {
    const paymentIds = [...new Set([...(booking.collectionHistory || []).slice().sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()).map(item => item.paymentId), booking.paymentId || ""].filter(Boolean))];
    if (!paymentIds.length) throw new HttpError(409, "No Razorpay payment is linked to this booking");
    const razorpay = createRazorpayClient();
    const payments = await Promise.all(paymentIds.map(async paymentId => {
      const payment = await razorpay.payments.fetch(paymentId);
      if (payment.currency !== "INR" || !["captured", "refunded"].includes(payment.status)) throw new HttpError(409, "A linked payment is not eligible for an INR refund");
      return { paymentId, available: Math.max(0, Number(payment.amount) - Number(payment.amount_refunded || 0)) };
    }));
    let remaining = amountPaise;
    segments = [];
    for (const payment of payments) {
      const refundAmount = Math.min(remaining, payment.available);
      if (refundAmount <= 0) continue;
      segments.push({ paymentId: payment.paymentId, amountPaise: refundAmount, receipt: `cncl-${String(cancellation._id)}-${crypto.randomBytes(4).toString("hex")}`, status: "pending" });
      remaining -= refundAmount;
      if (!remaining) break;
    }
    if (remaining > 0) throw new HttpError(400, "Refund amount exceeds the remaining refundable Razorpay payment balance");
    const claimed = await BookingCancellationRequest.findOneAndUpdate({ _id: cancellation._id, status: "requested" }, { $set: {
      status: "processing", refundPercentage: parsed.data.refundPercentage, refundAmount: parsed.data.refundAmount,
      refundMode: mode, adminNote: parsed.data.adminNote, refundSegments: segments,
    } }, { returnDocument: "after" });
    if (!claimed) throw new HttpError(409, "This cancellation request is already being processed");
    requestDoc = claimed;
  } else {
    const claimed = await BookingCancellationRequest.findOneAndUpdate({ _id: cancellation._id, status: "requested" }, { $set: {
      status: "processing", refundPercentage: parsed.data.refundPercentage, refundAmount: parsed.data.refundAmount,
      refundMode: mode, adminNote: parsed.data.adminNote, refundSegments: [],
    } }, { returnDocument: "after" });
    if (!claimed) throw new HttpError(409, "This cancellation request is already being processed");
    requestDoc = claimed;
  }

  if (mode === "razorpay") {
    const razorpay = createRazorpayClient();
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.refundId && segment.status !== "failed") continue;
      let refund: Refunds.RazorpayRefund;
      try {
        refund = await razorpay.payments.refund(segment.paymentId, {
          amount: segment.amountPaise,
          receipt: segment.receipt,
          notes: { bookingId: booking.id, cancellationRequestId: String(cancellation._id) },
        });
      } catch (error) {
        const providerError = error as { error?: { description?: string; reason?: string }; message?: string };
        const reason = providerError.error?.description || providerError.error?.reason || providerError.message;
        console.error("Razorpay cancellation refund request failed:", error);
        throw new HttpError(409,
          `Razorpay did not confirm the refund${reason ? `: ${reason}` : ". Check the Razorpay payment and account, then retry."} The request remains recorded so a retry uses the same refund receipt.`,
        );
      }
      if (refund.payment_id !== segment.paymentId || Number(refund.amount) !== segment.amountPaise || refund.currency !== "INR") {
        throw new HttpError(502, "Razorpay returned a refund record that did not match the requested payment and amount");
      }
      const updatedSegments = [...segments];
      updatedSegments[index] = { ...segment, refundId: refund.id, status: refund.status };
      requestDoc.refundSegments = updatedSegments;
      segments = updatedSegments;
      await requestDoc.save();
      if (refund.status === "failed") {
        requestDoc.status = "requested";
        requestDoc.refundPercentage = undefined;
        requestDoc.refundAmount = undefined;
        requestDoc.refundMode = undefined;
        requestDoc.refundSegments = [];
        await requestDoc.save();
        throw new HttpError(502, "Razorpay could not initiate this refund. Review the payment and try again.");
      }
    }
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Booking.findById(booking._id).session(session);
      const currentRequest = await BookingCancellationRequest.findById(cancellation._id).session(session);
      if (!current || !currentRequest) throw new HttpError(404, "Booking or cancellation request no longer exists");
      if (current.bookingStatus !== "cancelled") {
        const seatsToRelease = current.paymentStatus === "paid" ? Math.max(0, current.totalGuest || 0) : Math.max(0, current.heldSeatCount || 0);
        const departureId = current.departureId || current.pricingSnapshot?.departureId || "";
        if (seatsToRelease > 0) {
          const departure = await restoreDepartureSeats(departureId, seatsToRelease, session, current.tourScope);
          if (!departure) throw new HttpError(409, "Booking departure was not found; refund was initiated but seats could not be released");
        }
        current.bookingStatus = "cancelled";
        current.cancellation = { reason: currentRequest.reason, chargePercentage: parsed.data.refundPercentage, requestedBy: "Customer", notes: `Refund ${mode === "razorpay" ? "initiated through Razorpay" : "recorded manually"}: ₹${parsed.data.refundAmount.toLocaleString("en-IN")}.${parsed.data.adminNote ? ` ${parsed.data.adminNote}` : ""}`, cancelledAt: new Date() };
        current.heldSeatCount = 0; current.holdExpiresAt = null; current.recoveryEmailStatus = "disabled"; current.whatsappRecoveryStatus = "disabled"; current.pendingBookingKey = undefined;
        if (parsed.data.refundAmount >= Number(current.amountPaid || 0) && Number(current.amountPaid || 0) > 0) current.paymentStatus = "refunded";
        await current.save({ session });
        await BookingPaymentSession.updateMany({ bookingId: current._id, status: "pending" }, { $set: { failureReason: "Booking cancelled", status: "expired" } }, { session });
        await BookingPaymentLinkRequest.updateMany({ bookingId: current._id, status: { $in: ["created", "sent"] } }, { $set: { failureReason: "Booking cancelled", status: "cancelled" } }, { session });
      }
      currentRequest.status = mode === "razorpay" ? "refund_initiated" : "offline_refund_recorded";
      currentRequest.processedAt = new Date();
      await currentRequest.save({ session });
    });
  } catch (error) {
    console.error("Cancellation refund was accepted but booking finalization failed:", error);
    throw new HttpError(409,
      "The refund decision is saved, but the booking could not be finalized. Retry to complete cancellation; any confirmed Razorpay refund will not be sent again.",
    );
  } finally { await session.endSession(); }
  queueBookingNotifications(booking.id);
  const latestRequest = await BookingCancellationRequest.findById(cancellation._id).lean();
  const savedBooking = await Booking.findById(booking._id);
  response.status(200).json({ success: true, message: mode === "razorpay" ? "Refund initiated through Razorpay and booking cancelled" : "Offline refund recorded and booking cancelled", data: {
    request: latestRequest ? { ...latestRequest, id: String(latestRequest._id) } : null,
    booking: savedBooking ? { ...formatBooking(savedBooking), cancellationRequest: latestRequest ? { ...latestRequest, id: String(latestRequest._id) } : null } : null,
    refundMode: mode,
  } });
}

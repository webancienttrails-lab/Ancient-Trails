import crypto from "node:crypto";
import mongoose, { type HydratedDocument } from "mongoose";
import type { Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedTravellerBookingById } from "./booking.controller";
import { BookingCancellationRequest, type IBookingCancellationRequest } from "../models/bookingCancellationRequest.model";
import { Tour } from "../models/tour.model";
import { TourDeparture } from "../models/tourDeparture.model";
import { cancellationEstimate } from "../services/booking/booking.cancellation-estimate";
import { stageNotificationEvent } from "../services/notifications/notification-events.service";
import { HttpError } from "../utils/httpError";

async function preview(request: Request) {
  const booking = await getAuthenticatedTravellerBookingById(request);
  const existingRequest = await BookingCancellationRequest.findOne({ bookingId: booking._id });
  const [tour, departure] = await Promise.all([
    Tour.findOne({ tourId: booking.tourId }),
    booking.departureId ? TourDeparture.findOne({ departureId: booking.departureId }) : Promise.resolve(null),
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

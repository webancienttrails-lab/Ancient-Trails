import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Booking } from "../models/booking.model";
import { HttpError } from "../utils/httpError";

export const bookingInvoicePayloadSchema = z.object({
  invoiceOverrides: z.record(
    z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
    z.string().max(4000)
  ).refine((fields) => Object.keys(fields).length <= 200 && Object.values(fields).join("").length <= 64000, "Invoice edits are too large"),
}).strict();

export async function updateBookingInvoice(request: Request, response: Response): Promise<void> {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, "Invalid booking ID");
  const parsed = bookingInvoicePayloadSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Invalid invoice fields", parsed.error.flatten());
  const payload = parsed.data;
  const booking = await Booking.findOneAndUpdate(
    { _id: request.params.id, archivedAt: null },
    { $set: { invoiceOverrides: payload.invoiceOverrides } },
    { returnDocument: "after", runValidators: true }
  );
  if (!booking) throw new HttpError(404, "Booking not found");
  response.json({ success: true, message: "Invoice saved", data: { invoiceOverrides: booking.invoiceOverrides || {} } });
}

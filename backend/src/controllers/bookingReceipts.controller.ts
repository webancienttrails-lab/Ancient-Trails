import crypto from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Booking } from "../models/booking.model";
import { BookingReceiptShare } from "../models/bookingReceiptShare.model";
import { getBookingReceipts } from "../services/booking/booking.receipts";
import { HttpError } from "../utils/httpError";
import { getAuthenticatedTravellerBookingById } from "./booking.controller";

export const receiptPdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } });
async function findBooking(id: unknown) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid booking ID");
  const booking = await Booking.findOne({ _id: id, archivedAt: null });
  if (!booking) throw new HttpError(404, "Booking not found");
  return booking;
}
export async function listBookingReceipts(request: Request, response: Response): Promise<void> {
  const booking = await findBooking(request.params.id);
  response.json({ success: true, message: "Payment receipts loaded", data: { receipts: await getBookingReceipts(booking) } });
}

export async function listTravellerPaymentReceipts(request: Request, response: Response): Promise<void> {
  const booking = await getAuthenticatedTravellerBookingById(request);
  if (booking.archivedAt) throw new HttpError(404, "Booking not found");
  response.setHeader("Cache-Control", "private, no-store");
  response.json({ success: true, message: "Payment receipts loaded", data: { receipts: await getBookingReceipts(booking) } });
}

export function receiptShareBaseUrl(request: Request): string {
  const url = new URL(process.env.PAYMENT_RECEIPT_PUBLIC_BASE_URL || `${request.protocol}://${request.get("host")}`);
  if (url.protocol !== "https:" || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i.test(url.hostname) || url.username || url.password) {
    throw new HttpError(503, "WhatsApp receipt links need a public HTTPS backend address. Configure PAYMENT_RECEIPT_PUBLIC_BASE_URL before sharing.");
  }
  return url.origin + url.pathname.replace(/\/$/, "");
}

export async function shareBookingReceipt(request: Request, response: Response): Promise<void> {
  const booking = await findBooking(request.params.id);
  const receipt = (await getBookingReceipts(booking)).find((item) => item.id === request.params.receiptId);
  if (!receipt) throw new HttpError(404, "Payment receipt not found");
  if (!request.file || request.file.mimetype !== "application/pdf" || request.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new HttpError(400, "A valid receipt PDF is required");
  }
  const lead = booking.guestDetails[0];
  const mobile = (lead?.mobileNumber || "").replace(/\D/g, "");
  const country = (lead?.countryCode || "91").replace(/\D/g, "");
  const recipient = mobile.startsWith(country) && mobile.length > 10 ? mobile : country + mobile;
  if (!mobile || !/^[1-9]\d{6,14}$/.test(recipient)) throw new HttpError(400, "The lead traveller's WhatsApp number is missing or invalid");
  const baseUrl = receiptShareBaseUrl(request);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const filename = receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, "_") + "-Payment-Receipt.pdf";
  await BookingReceiptShare.create({ bookingId: booking._id, receiptId: receipt.id,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"), filename, pdf: request.file.buffer, expiresAt });
  const downloadUrl = `${baseUrl}/api/bookings/payment-receipts/${token}.pdf`;
  const message = `Hello ${lead?.firstName || "Traveller"},\nHere is your Ancient Trails payment receipt ${receipt.receiptNumber} for ${receipt.currency} ${receipt.amount.toLocaleString("en-IN")}.\nBooking: ${booking.bookingReference || booking.id}\n${downloadUrl}\nThis receipt download link is valid for 7 days.\nThank you for travelling with Ancient Trails.`;
  response.json({ success: true, message: "Receipt ready to share on WhatsApp", data: {
    whatsappUrl: `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`, recipient, expiresAt,
  } });
}

export async function downloadSharedBookingReceipt(request: Request, response: Response): Promise<void> {
  const token = String(request.params.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, "Receipt link is invalid or expired");
  const share = await BookingReceiptShare.findOne({ tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: { $gt: new Date() } }).select("+pdf");
  if (!share || !await Booking.exists({ _id: share.bookingId, archivedAt: null })) throw new HttpError(404, "Receipt link is invalid or expired");
  response.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${share.filename}"`,
    "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  response.send(share.pdf);
}

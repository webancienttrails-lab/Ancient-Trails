import crypto from "node:crypto";
import mongoose from "mongoose";
import type { Request, Response } from "express";
import { z } from "zod";
import { Booking, type BookingDocument } from "../models/booking.model";
import { SmartCollectAccount, SmartCollectTransfer } from "../models/smartCollect.model";
import { BookingPaymentSession } from "../models/bookingPaymentSession.model";
import { BookingBalancePaymentSession } from "../models/bookingBalancePaymentSession.model";
import { BookingPaymentLinkRequest } from "../models/bookingPaymentLinkRequest.model";
import { HttpError } from "../utils/httpError";
import {
  createSmartCollectBookingDraft, formatBooking, getRazorpayCredentials,
  getAuthenticatedTravellerPaidBookingById, withBookingCollectionLock,
  reserveDepartureSeats, restoreDepartureSeats, recordAirfareCollection, queueBookingConfirmationNotifications,
} from "./booking.controller";
import { createSmartCollectGateway, verifySmartCollectSignature } from "../services/smart-collect/gateway";
import { createIdentifier, closeIdentifier, processBankPayment, reconcileIdentifier, assertAccountOwnership, closeCompletedIdentifier } from "../services/smart-collect/collection";
import { outstanding, paise, requiredInitialPayment } from "../services/smart-collect/policy";
import { notifyBankInstructions, notifyBankReceipts } from "../services/smart-collect/notifications";

const hooks = {
  reserveSeats: reserveDepartureSeats, restoreSeats: restoreDepartureSeats,
  recordCollection: recordAirfareCollection, notifyConfirmation: queueBookingConfirmationNotifications,
};
function gateway() {
  const keys = getRazorpayCredentials();
  return createSmartCollectGateway(keys.keyId, keys.keySecret);
}
function enabled() {
  if (process.env.RAZORPAY_SMART_COLLECT_ENABLED !== "true") throw new HttpError(503, "Bank transfer is not currently available");
}
function validBookingId(request: Request) {
  const id = String(request.params.id);
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid booking ID");
  return id;
}
async function customerBooking(request: Request) {
  const id = validBookingId(request);
  const token = typeof request.query.token === "string" ? request.query.token : "";
  if (token) {
    if (!/^[a-f0-9]{48}$/i.test(token)) throw new HttpError(403, "Invalid booking access token");
    const booking = await Booking.findById(id).select("+bankTransferToken");
    const matches = (value?: string) => !!value && value.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(value), Buffer.from(token));
    if (!booking || !(matches(booking.bankTransferToken) || matches(booking.confirmationToken))) throw new HttpError(403, "Invalid booking access token");
    return booking;
  }
  return getAuthenticatedTravellerPaidBookingById(request);
}
async function adminBooking(request: Request) {
  const booking = await Booking.findById(validBookingId(request)).select("+bankTransferToken");
  if (!booking) throw new HttpError(404, "Booking not found");
  return booking;
}
async function assertNoOtherCollection(bookingId: mongoose.Types.ObjectId) {
  const [initial, balance, link] = await Promise.all([
    BookingPaymentSession.exists({ bookingId, status: "pending" }),
    BookingBalancePaymentSession.exists({ bookingId, status: "pending" }),
    BookingPaymentLinkRequest.exists({ bookingId, status: { $in: ["created", "sent"] } }),
  ]);
  if (initial || balance || link) throw new HttpError(409, "Complete or cancel the existing checkout/payment link before generating bank details");
}
function assertBookable(booking: BookingDocument) {
  if (["cancelled", "expired"].includes(booking.bookingStatus || "") ||
      (booking.paymentStatus !== "paid" && booking.recoveryExpiresAt && booking.recoveryExpiresAt <= new Date())) {
    throw new HttpError(409, "Booking has expired or is cancelled");
  }
  if (outstanding(booking) <= 0) throw new HttpError(409, "Booking is already fully paid");
}
async function ensureToken(booking: BookingDocument) {
  if (!booking.bankTransferToken) {
    booking.bankTransferToken = crypto.randomBytes(24).toString("hex");
    await booking.save();
  }
}
async function details(booking: BookingDocument) {
  const context = gateway();
  const [accounts, transfers] = await Promise.all([
    SmartCollectAccount.find({ bookingId: booking._id, scope: context.scope }).sort({ createdAt: -1 }).lean(),
    SmartCollectTransfer.find({ bookingId: booking._id, scope: context.scope }).sort({ receivedAt: -1 }).lean(),
  ]);
  return {
    booking: formatBooking(booking), environment: context.environment,
    confirmationUrl: booking.bookingStatus === "confirmed" && booking.confirmationToken
      ? "/booking-confirmed/" + booking._id + "?token=" + encodeURIComponent(booking.confirmationToken) : undefined,
    outstandingAmount: outstanding(booking) / 100,
    accounts: accounts.map(account => ({
      id: String(account._id), virtualAccountId: account.virtualAccountId || "",
      bookingReference: account.bookingReference, status: account.status,
      beneficiaryName: account.beneficiaryName, accountNumber: account.accountNumber,
      ifsc: account.ifsc, bankName: account.bankName,
      amountRequested: account.amountRequested / 100, amountReceived: account.amountReceived / 100,
      amountApplied: account.amountApplied / 100, amountReview: account.amountReview / 100,
      expiresAt: account.expiresAt, closedAt: account.closedAt, error: account.error,
      emailInstructionStatus: account.emailInstructionStatus, whatsappInstructionStatus: account.whatsappInstructionStatus,
    })),
    transfers: transfers.map(item => ({
      paymentId: item.paymentId, accountId: String(item.accountId),
      amount: item.amount / 100, amountApplied: item.amountApplied / 100,
      amountReview: item.amountReview / 100, status: item.status, mode: item.mode,
      utr: item.utr, reason: item.reason, receivedAt: item.receivedAt,
    })),
  };
}
export async function bankTransferConfig(_request: Request, response: Response) {
  response.json({ success: true, message: "", data: { enabled: process.env.RAZORPAY_SMART_COLLECT_ENABLED === "true" } });
}
export async function createInitialBankTransfer(request: Request, response: Response) {
  enabled();
  response.setHeader("Cache-Control", "no-store");
  const context = gateway();
  const booking = await createSmartCollectBookingDraft(request.body, context.scope);
  request.params.id = String(booking._id);
  await withBookingCollectionLock(request, async () => {
    const current = await Booking.findById(booking._id).select("+bankTransferToken");
    if (!current) throw new HttpError(404, "Booking not found");
    assertBookable(current);
    await assertNoOtherCollection(current._id);
    const amount = Math.min(outstanding(current), Math.max(0, requiredInitialPayment(current) - paise(current.amountPaid)));
    const account = await createIdentifier(current, amount || outstanding(current), context);
    void notifyBankInstructions(String(account._id)).catch(() => console.error("[smart-collect] Instructions not queued"));
    response.status(201).json({
      success: true, message: "Bank details generated. This booking is not confirmed until payment is verified and seats are available.",
      data: { ...(await details(current)), accessToken: current.bankTransferToken },
    });
  });
}
async function createExisting(request: Request, response: Response, admin: boolean) {
  enabled();
  response.setHeader("Cache-Control", "no-store");
  const owned = admin ? await adminBooking(request) : await customerBooking(request);
  const parsed = z.object({
    purpose: z.enum(["advance", "full", "partial", "final", "additional"]).default("final"),
    amount: z.number().int().positive().max(1000000000).optional(),
  }).strict().safeParse(request.body || {});
  if (!parsed.success) throw new HttpError(400, "Invalid bank-transfer payment request");
  await withBookingCollectionLock(request, async () => {
    const booking = await Booking.findById(owned._id).select("+bankTransferToken");
    if (!booking) throw new HttpError(404, "Booking not found");
    assertBookable(booking);
    await assertNoOtherCollection(booking._id);
    await ensureToken(booking);
    const due = outstanding(booking);
    const amount = parsed.data.purpose === "partial"
      ? (parsed.data.amount ? paise(parsed.data.amount) : 0)
      : parsed.data.purpose === "advance" ? Math.max(0, requiredInitialPayment(booking) - paise(booking.amountPaid)) : due;
    if (!amount || amount > due) throw new HttpError(400, "Enter an amount within the current outstanding balance");
    const account = await createIdentifier(booking, amount, gateway());
    void notifyBankInstructions(String(account._id)).catch(() => console.error("[smart-collect] Instructions not queued"));
    response.status(201).json({ success: true, message: "Bank details ready", data: { ...(await details(booking)), accessToken: booking.bankTransferToken } });
  });
}
export const createCustomerBankTransfer = (req: Request, res: Response) => createExisting(req, res, false);
export const createAdminBankTransfer = (req: Request, res: Response) => createExisting(req, res, true);
export async function getCustomerBankTransfer(request: Request, response: Response) {
  response.setHeader("Cache-Control", "no-store");
  response.json({ success: true, message: "", data: await details(await customerBooking(request)) });
}
export async function getAdminBankTransfer(request: Request, response: Response) {
  response.setHeader("Cache-Control", "no-store");
  response.json({ success: true, message: "", data: await details(await adminBooking(request)) });
}
export async function refreshAdminBankTransfer(request: Request, response: Response) {
  const booking = await adminBooking(request);
  if (!mongoose.isValidObjectId(request.params.accountId)) throw new HttpError(400, "Invalid identifier ID");
  const context = gateway();
  const account = await SmartCollectAccount.findOne({ _id: request.params.accountId, bookingId: booking._id, scope: context.scope });
  if (!account) throw new HttpError(404, "Identifier not found");
  await reconcileIdentifier(String(account._id), context, hooks);
  void notifyBankReceipts(String(booking._id), context.scope).catch(() => {});
  response.json({ success: true, message: "Bank transfers reconciled", data: await details((await Booking.findById(booking._id))!) });
}
async function closeAdminBankTransferInternal(request: Request, response: Response) {
  const booking = await adminBooking(request);
  if (!mongoose.isValidObjectId(request.params.accountId)) throw new HttpError(400, "Invalid identifier ID");
  const context = gateway();
  const account = await SmartCollectAccount.findOne({ _id: request.params.accountId, bookingId: booking._id, scope: context.scope });
  if (!account) throw new HttpError(404, "Identifier not found");
  await closeIdentifier(account, context);
  // Closing first prevents new deposits while reconciliation accounts for in-flight payments.
  await reconcileIdentifier(String(account._id), context, hooks);
  void notifyBankReceipts(String(booking._id), context.scope).catch(() => {});
  response.json({ success: true, message: "Bank identifier closed", data: await details((await Booking.findById(booking._id))!) });
}
export async function smartCollectWebhook(request: Request, response: Response) {
  const secret = process.env.RAZORPAY_SMART_COLLECT_WEBHOOK_SECRET?.trim() || process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  verifySmartCollectSignature(request.body, String(request.headers["x-razorpay-signature"] || ""), secret);
  let event;
  try { event = JSON.parse((request.body as Buffer).toString("utf8")); }
  catch { throw new HttpError(400, "Invalid webhook JSON"); }
  if (!["virtual_account.credited", "virtual_account.closed"].includes(event.event)) {
    response.json({ success: true }); return;
  }
  const context = gateway();
  const virtual = event.payload?.virtual_account?.entity;
  if (!virtual || typeof virtual.id !== "string" || !/^va_[A-Za-z0-9]+$/.test(virtual.id)) throw new HttpError(400, "Virtual account ID is missing");
  let account = await SmartCollectAccount.findOne({ scope: context.scope, virtualAccountId: virtual?.id });
  if (!account && mongoose.isValidObjectId(virtual?.notes?.local_id)) {
    account = await SmartCollectAccount.findOne({ _id: virtual.notes.local_id, scope: context.scope });
    if (account) {
      const remote = await context.fetch(virtual.id);
      assertAccountOwnership(account, remote);
      account.virtualAccountId = remote.id;
      await account.save();
    }
  }
  if (!account) { response.json({ success: true, ignored: true }); return; }
  if (event.event === "virtual_account.credited") {
    const paymentId = event.payload?.payment?.entity?.id;
    if (typeof paymentId !== "string") throw new HttpError(400, "Payment ID is missing");
    await processBankPayment(String(account._id), paymentId, context, hooks);
  }
  if (event.event === "virtual_account.closed") await reconcileIdentifier(String(account._id), context, hooks);
  else await closeCompletedIdentifier(String(account._id), context);
  void notifyBankReceipts(String(account.bookingId), context.scope).catch(() => {});
  response.json({ success: true });
}
let running = false;
export async function runSmartCollectMaintenance() {
  if (running || process.env.RAZORPAY_SMART_COLLECT_ENABLED !== "true") return;
  running = true;
  try {
    const context = gateway();
    // Bounded work each tick; recently closed accounts remain reconcilable for delayed credits.
    const accounts = await SmartCollectAccount.find({ scope: context.scope, status: { $ne: "failed" } })
      .sort({ updatedAt: 1 }).limit(50);
    for (const account of accounts) {
      try {
        await reconcileIdentifier(String(account._id), context, hooks);
        await notifyBankInstructions(String(account._id));
        await notifyBankReceipts(String(account.bookingId), context.scope);
        await SmartCollectAccount.updateOne({ _id: account._id }, { $set: { updatedAt: new Date() } }, { timestamps: false });
      } catch {
        await SmartCollectAccount.updateOne({ _id: account._id }, { $set: { updatedAt: new Date() } }, { timestamps: false });
        console.error("[smart-collect] Reconciliation requires review for " + account._id);
      }
    }
  } finally { running = false; }
}

export async function closeAdminBankTransfer(request: Request, response: Response) {
  await withBookingCollectionLock(request, () => closeAdminBankTransferInternal(request, response));
}

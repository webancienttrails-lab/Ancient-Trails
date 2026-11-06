import crypto from "node:crypto";
import { Types } from "mongoose";
import type { IBooking } from "../../models/booking.model";
import { BookingPaymentSession } from "../../models/bookingPaymentSession.model";
import { BookingBalancePaymentSession } from "../../models/bookingBalancePaymentSession.model";
import { BookingPaymentLinkRequest } from "../../models/bookingPaymentLinkRequest.model";
import { SmartCollectTransfer } from "../../models/smartCollect.model";

export type ReceiptPayment = {
  id: string; transactionId: string; amount: number; paidAt: string | null;
  method: string; currency: string; description: string;
};
export type BookingReceipt = ReceiptPayment & {
  receiptNumber: string; totalPaid: number; balanceAfterPayment: number; bookingTotal: number;
};
const cents = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.round(Number(value) * 100)) : 0;
export function receiptDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function buildBookingReceipts(booking: IBooking & { _id: unknown }, payments: ReceiptPayment[]): BookingReceipt[] {
  const byTransaction = new Map<string, ReceiptPayment>();
  for (const payment of payments) {
    if (!cents(payment.amount)) continue;
    const key = payment.transactionId || payment.id;
    if (!byTransaction.has(key)) byTransaction.set(key, payment);
  }
  const records = [...byTransaction.values()];
  const recorded = records.reduce((sum, item) => sum + cents(item.amount), 0);
  const missing = cents(booking.amountPaid) - recorded;
  // Older bookings may only retain an aggregate. Never invent separate transactions or dates.
  if (missing > 0 && (booking.paymentStatus === "paid" || booking.paymentCapturedAt)) {
    records.push({ id: "recorded-payment", transactionId: records.length ? "" : booking.paymentId || booking.paymentOrderId || "",
      amount: missing / 100, paidAt: records.length ? null : receiptDate(booking.paymentCapturedAt),
      method: booking.paymentMethod || booking.paymentMode || "Recorded payment", currency: booking.paymentCurrency || "INR",
      description: records.length ? "Previously recorded payment" : "Recorded payment" });
  }
  records.sort((a, b) => (a.paidAt || "").localeCompare(b.paidAt || "") || a.id.localeCompare(b.id));
  let paid = 0;
  const total = cents(booking.grandTotal);
  return records.map((payment, index) => {
    paid += cents(payment.amount);
    const reference = booking.bookingReference || String(booking._id);
    const suffix = crypto.createHash("sha256").update(payment.id).digest("hex").slice(0, 10).toUpperCase();
    return { ...payment, amount: cents(payment.amount) / 100,
      description: payment.description === "Booking payment" ? index === 0 && paid < total ? "Advance payment" : paid >= total ? "Final payment" : "Part payment" : payment.description,
      receiptNumber: `${reference}-RCPT-${suffix}`, totalPaid: paid / 100,
      balanceAfterPayment: Math.max(0, total - paid) / 100, bookingTotal: total / 100 };
  });
}

export async function getBookingReceipts(booking: IBooking & { _id: unknown }): Promise<BookingReceipt[]> {
  const bookingId = new Types.ObjectId(String(booking._id));
  const filter = { bookingId, status: "paid" as const };
  const [initial, balance, links, transfers] = await Promise.all([
    BookingPaymentSession.find(filter).lean(), BookingBalancePaymentSession.find(filter).lean(),
    BookingPaymentLinkRequest.find(filter).lean(),
    SmartCollectTransfer.find({ bookingId, amountApplied: { $gt: 0 }, status: { $in: ["applied", "review"] } }).lean(),
  ]);
  const payments: ReceiptPayment[] = [];
  // Prefer the bank ledger's applied amount; excess funds awaiting review are excluded.
  for (const item of transfers) payments.push({ id: `bank-${item._id}`, transactionId: item.paymentId,
    amount: item.amountApplied / 100, paidAt: receiptDate(item.receivedAt), method: item.mode,
    currency: "INR", description: "Bank transfer payment" });
  for (const [kind, items] of [["initial", initial], ["balance", balance], ["link", links]] as const) {
    for (const item of items) payments.push({ id: `${kind}-${item._id}`, transactionId: item.razorpayPaymentId || ("razorpayOrderId" in item ? item.razorpayOrderId : item.razorpayPaymentLinkId) || "",
      amount: item.amountRupees, paidAt: receiptDate(item.paidAt), method: "Razorpay", currency: item.currency || "INR",
      description: "purposeLabel" in item ? item.purposeLabel : "Booking payment" });
  }
  for (const item of booking.offlinePaymentHistory || []) payments.push({ id: item.id, transactionId: item.id,
    amount: item.amount, paidAt: receiptDate(item.paidAt), method: item.method, currency: booking.paymentCurrency || "INR", description: "Offline payment" });
  for (const item of booking.collectionHistory || []) payments.push({ id: `collection-${item.paymentId}`, transactionId: item.paymentId,
    amount: item.amount, paidAt: receiptDate(item.paidAt), method: booking.paymentMethod || "Recorded payment", currency: booking.paymentCurrency || "INR", description: "Booking payment" });
  return buildBookingReceipts(booking, payments);
}

export function offlineReceiptHistory(booking: Pick<IBooking, "offlinePaymentHistory" | "amountPaid" | "paymentMode" | "paymentCapturedAt" | "paymentMethod"> | undefined,
  amount: number, method: string, mode: string, now = new Date()) {
  const history = [...(booking?.offlinePaymentHistory || [])];
  if (mode !== "offline") return history;
  const previous = cents(booking?.amountPaid);
  if (previous > 0 && history.length === 0 && booking?.paymentMode === "offline") {
    history.push({ id: `offline-${crypto.randomUUID()}`, amount: previous / 100, method: booking.paymentMethod || "Offline",
      paidAt: booking.paymentCapturedAt || null });
  }
  const added = cents(amount) - previous;
  if (added > 0) history.push({ id: `offline-${crypto.randomUUID()}`, amount: added / 100, method, paidAt: now });
  return history;
}

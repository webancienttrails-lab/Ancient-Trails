import type { IBooking } from "../../models/booking.model";
import type { ISmartCollectAccount } from "../../models/smartCollect.model";
import type { BankPayment } from "./gateway";

export function paise(value: number | null | undefined): number {
  const amount = Math.round(Number(value || 0) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid payment amount");
  return amount;
}
export function outstanding(booking: Pick<IBooking, "grandTotal" | "amountPaid">) {
  return Math.max(0, paise(booking.grandTotal) - paise(booking.amountPaid));
}
export function requiredInitialPayment(booking: Pick<IBooking, "grandTotal" | "depositAmount" | "paymentOption">) {
  const total = paise(booking.grandTotal);
  return booking.paymentOption === "full" ? total : Math.min(total, paise(booking.depositAmount) || total);
}
export function paymentDecision(booking: IBooking, account: ISmartCollectAccount, payment: BankPayment) {
  const receivedAt = new Date(payment.created_at * 1000);
  let reason = "";
  if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0 || payment.currency !== "INR" ||
      payment.method !== "bank_transfer" || payment.status !== "captured" || payment.captured !== true ||
      !Number.isFinite(receivedAt.getTime())) {
    throw new Error("Payment is not a verified INR bank transfer");
  }
  // Existing checkout, deposits, airfare and admin edits all use whole-rupee totals.
  // Keep unexpected paise transfers in the ledger for review rather than silently rounding money.
  if (payment.amount % 100 !== 0) reason = "Transfer includes paise; manual reconciliation is required by the whole-rupee booking system";
  else if ((payment.amount_refunded || 0) > 0) reason = "Payment has already been refunded; reconcile manually";
  else if (["cancelled", "expired"].includes(booking.bookingStatus || "")) reason = "Payment received for a cancelled or expired booking";
  else if (receivedAt > account.expiresAt || (account.closedAt && receivedAt >= account.closedAt)) reason = "Payment received after identifier expiry or closure";
  else if (booking.paymentStatus !== "paid" && booking.recoveryExpiresAt && booking.recoveryExpiresAt <= new Date()) reason = "Booking payment window has expired";
  const credit = reason ? 0 : Math.min(payment.amount, outstanding(booking));
  const review = payment.amount - credit;
  return {
    credit, review, receivedAt,
    reason: reason || (review > 0 ? "Transfer exceeds the current outstanding balance" : ""),
    confirms: credit > 0 && paise(booking.amountPaid) + credit >= requiredInitialPayment(booking),
  };
}

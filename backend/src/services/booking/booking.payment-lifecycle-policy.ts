import type { IBooking } from "../../models/booking.model";
export const PAYMENT_REMINDER_DAYS = 7;
export function indiaDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
export function paymentLifecycleState(booking: IBooking, now = new Date()) {
  const total = Number(booking.grandTotal || booking.pricingSnapshot?.grandTotal || 0);
  const paid = Number(booking.amountPaid || 0);
  const balance = Math.max(0, total - paid);
  const active = booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid" && !booking.archivedAt
    && Number.isFinite(total) && Number.isFinite(paid) && total > 0 && paid > 0;
  const value = booking.balanceDueDate || booking.pricingSnapshot?.balanceDueDate;
  const dueDate = value ? new Date(value) : null;
  const validDue = dueDate && Number.isFinite(dueDate.getTime()) ? dueDate : null;
  const daysUntilDue = validDue ? Math.round((Date.parse(indiaDateKey(validDue)) - Date.parse(indiaDateKey(now))) / 86400000) : null;
  const airfare = Number(booking.airFlightCharges || 0);
  const packageTotal = total - (booking.airfareIncludedInTotal ? 0 : airfare);
  return {
    total, paid, balance, dueDate: validDue,
    fullyPaid: active && balance === 0,
    reminderDue: active && balance > 0 && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= PAYMENT_REMINDER_DAYS,
    airfareDue: active && booking.airfareExcluded === true && !booking.airfareIncludedInTotal
      && Boolean(booking.airfareAddedAt) && airfare > 0 && balance > 0 && paid >= packageTotal,
  };
}

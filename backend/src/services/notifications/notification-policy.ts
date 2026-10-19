import type { IBooking } from "../../models/booking.model";
import { indiaDateKey, paymentLifecycleState } from "../booking/booking.payment-lifecycle-policy";
export type SourceEvent = { key: string; kind: string; payload: Record<string, unknown> };
export function bookingNotificationEvents(booking: IBooking & { id: string }, activatedAt: Date, now = new Date()): SourceEvent[] {
  const events: SourceEvent[] = [], id = booking.id;
  const captured = booking.paymentCapturedAt && new Date(booking.paymentCapturedAt);
  if (booking.bookingStatus === "cancelled") {
    if (booking.cancellation?.cancelledAt && new Date(booking.cancellation.cancelledAt) >= activatedAt) events.push({ key: "cancelled:" + id, kind: "booking_cancelled", payload: { bookingId: id } });
    return events;
  }
  if (booking.paymentMode === "offline" && booking.bookingStatus === "payment_pending" && booking.paymentStatus === "pending" && !booking.amountPaid && new Date(booking.createdAt) >= activatedAt) {
    events.push({ key: "offline:" + id, kind: "offline_payment_pending", payload: { bookingId: id } });
  }
  const state = paymentLifecycleState(booking, now);
  if (booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid" && (booking.amountPaid || 0) > 0 && captured && captured >= activatedAt) {
    events.push({ key: "confirmed:" + id, kind: "booking_confirmed", payload: { bookingId: id } });
    events.push({ key: ["payment", id, captured.toISOString(), booking.amountPaid].join(":"), kind: state.fullyPaid ? "full_payment_received" : "advance_payment_received", payload: { bookingId: id, amountPaid: booking.amountPaid } });
  }
  if (state.reminderDue) events.push({ key: "reminder:" + id + ":" + indiaDateKey(state.dueDate!), kind: "remaining_payment_reminder", payload: { bookingId: id, dueDate: indiaDateKey(state.dueDate!) } });
  return events;
}

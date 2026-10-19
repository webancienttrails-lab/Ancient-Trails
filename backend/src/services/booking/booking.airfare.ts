// Airfare entered by admin is the final supplier amount, inclusive of applicable taxes.
// Tour GST/TCS must never be reapplied to this amount.
export const AIRFARE_NOTE = "Note: Air-flight charges are not included in the above amount and will be added separately based on actual airline fares at the time of booking. Any additional airfare will be reflected in the outstanding balance or collected through a separate payment link.";

export function isAirfareExcluded(tour?: { inclusions?: string[]; exclusions?: string[] } | null) {
  const flight = /\b(flights?|air[ -]?fare|air[ -]?(?:flight|tickets?|travel))\b/i;
  const negative = /\b(not included|excluded|excluding|extra|additional|separate)\b/i;
  if ((tour?.inclusions || []).some(item => flight.test(item) && !negative.test(item))) return false;
  return (tour?.exclusions || []).some(item => flight.test(item))
    || (tour?.inclusions || []).some(item => flight.test(item) && negative.test(item));
}

export function calculateAirfareTotals(
  total: number, previous: number, next: number, paid: number,
  { previousIncluded = false, included = false }: { previousIncluded?: boolean; included?: boolean } = {},
) {
  if (![total, previous, next, paid].every(Number.isSafeInteger)
      || Math.min(total, previous, next, paid) < 0 || previous > total
      || next > 1000000000) throw new Error("Invalid airfare amount");
  const grandTotal = total - (previousIncluded ? 0 : previous) + (included ? 0 : next);
  if (included && next > grandTotal) throw new Error("Included airfare cannot exceed the booking total");
  if (grandTotal > 1000000000) throw new Error("Booking total is too high");
  if (grandTotal < paid) throw new Error("Airfare cannot be reduced below the amount already paid; process a refund first");
  return { grandTotal, balanceAmount: grandTotal - paid };
}

export function airfarePaymentPortion(total: number, airfare: number, paid: number, collection: number) {
  const before = Math.max(0, paid - (total - airfare));
  const after = Math.max(0, paid + collection - (total - airfare));
  return Math.max(0, Math.min(airfare, after) - Math.min(airfare, before));
}

export type AirfareCollectionEntry = {
  paymentId: string;
  amount: number;
  airfareAmount: number;
  paidAt: Date;
};

export function creditAirfarePayment(
  state: { grandTotal: number; airfare: number; amountPaid: number; history: AirfareCollectionEntry[] },
  payment: { paymentId: string; amount: number; paidAt: Date },
) {
  if (!payment.paymentId || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    throw new Error("Invalid airfare payment");
  }
  const credited = !state.history.some(entry => entry.paymentId === payment.paymentId);
  const amountPaid = state.amountPaid + (credited ? payment.amount : 0);
  return {
    credited,
    amountPaid,
    balanceAmount: Math.max(0, state.grandTotal - amountPaid),
    history: credited ? [...state.history, {
      ...payment,
      airfareAmount: airfarePaymentPortion(state.grandTotal, state.airfare, state.amountPaid, payment.amount),
    }] : state.history,
  };
}

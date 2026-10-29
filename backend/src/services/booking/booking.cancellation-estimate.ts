import type { IBooking } from "../../models/booking.model";
import type { TourCancellationPolicyRow } from "../../models/tour.model";

export const defaultCancellationPolicy: TourCancellationPolicyRow[] = [
  { days: "0-10", charge: "100%" }, { days: "10-20", charge: "50%" },
  { days: "20-30", charge: "30%" }, { days: "30 and above", charge: "10%" },
];
function indiaDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (name: string) => Number(parts.find(part => part.type === name)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}
function slab(row: TourCancellationPolicyRow) {
  const days = row.days.trim().toLowerCase().replace(/[\u2013\u2014]/g, "-");
  const percentage = row.charge.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  const range = days.match(/^(\d+)\s*(?:-|to)\s*(\d+)(?:\s*days?)?$/);
  const above = days.match(/^(\d+)\s*(?:and above|or more|\+)(?:\s*days?)?$/);
  if (!percentage || (!range && !above)) return null;
  const min = Number(range?.[1] || above?.[1]), max = range ? Number(range[2]) : Infinity;
  const chargePercentage = Number(percentage[1]);
  return max >= min && chargePercentage >= 0 && chargePercentage <= 100 ? { min, max, chargePercentage } : null;
}
export function cancellationEstimate(booking: IBooking, departure: Date, configured: TourCancellationPolicyRow[], now = new Date()) {
  if (Number.isNaN(departure.getTime())) throw new Error("Departure date is unavailable");
  const daysBeforeDeparture = Math.round((indiaDay(departure) - indiaDay(now)) / 86400000);
  const policyRows = configured.length ? configured.map(row => ({ days: row.days, charge: row.charge })) : defaultCancellationPolicy;
  const parsed = policyRows.map(slab);
  const matching = parsed.filter(row => row && daysBeforeDeparture >= row.min && daysBeforeDeparture <= row.max);
  // Published bands overlap at 10/20/30 days. Use the higher charge for an estimate; the team confirms it.
  const chargePercentage = parsed.every(Boolean) && matching.length ? Math.max(...matching.map(row => row!.chargePercentage)) : null;
  const amountPaid = Math.max(0, booking.amountPaid || 0);
  const subtotal = booking.subtotal ?? booking.pricingSnapshot?.subtotal;
  const gst = booking.gstAmount ?? booking.pricingSnapshot?.gstAmount;
  const knownPrices = Number.isFinite(subtotal) && Number.isFinite(gst);
  const cancellationCharge = chargePercentage !== null && knownPrices ? Math.round(Number(subtotal) * chargePercentage) / 100 : null;
  const nonRefundableGst = Math.max(0, gst || 0);
  const estimatedRefund = cancellationCharge === null ? null : Math.max(0, Math.round((amountPaid - cancellationCharge - nonRefundableGst) * 100) / 100);
  return { daysBeforeDeparture, chargePercentage, amountPaid, cancellationCharge, nonRefundableGst, estimatedRefund,
    departureDate: departure.toISOString(), policyRows,
    notes: ["Estimate only; the team confirms eligibility, charges and the final refund. Refunds remain manual under the published policy.",
      "GST is non-refundable. Non-refundable airfare and applicable airline charges may further reduce this estimate.",
      "At shared slab boundaries the estimate uses the higher cancellation charge; the team will confirm the applicable band."],
  };
}
export type CancellationEstimate = ReturnType<typeof cancellationEstimate>;

import type { AccommodationOption } from "../accommodation/accommodation.types";

export function calculateBookingTotals({
  accommodationOption,
  gstPercentage = 0,
  tcsApplicable = false,
  tcsExemptionVerified = false,
}: {
  accommodationOption: AccommodationOption;
  gstPercentage?: number;
  tcsApplicable?: boolean;
  tcsExemptionVerified?: boolean;
}) {
  const subtotal = accommodationOption.total;
  const gstAmount = Math.round((subtotal * gstPercentage) / 100);
  const packageTotal = subtotal + gstAmount;
  const tcsPercentage = tcsApplicable && !tcsExemptionVerified ? 2 : 0;
  const tcsAmount = Math.round(packageTotal * tcsPercentage / 100);
  const grandTotal = packageTotal + tcsAmount;

  return {
    tourPrice: accommodationOption.total,
    subtotal,
    gstPercentage,
    gstAmount,
    packageTotal,
    tcsApplicable,
    tcsPercentage,
    tcsAmount,
    tcsExemptionVerified,
    grandTotal,
  };
}

export function adjustBookingTcs({ packageTotal, grandTotal, tcsAmount, amountPaid, verified }: {
  packageTotal: number; grandTotal: number; tcsAmount: number; amountPaid: number; verified: boolean;
}) {
  const nextTcs = verified ? 0 : Math.round(packageTotal * 2 / 100);
  const nextTotal = grandTotal - tcsAmount + nextTcs;
  return { tcsAmount: nextTcs, grandTotal: nextTotal,
    balanceAmount: Math.max(0, nextTotal - amountPaid), refundDue: Math.max(0, amountPaid - nextTotal) };
}

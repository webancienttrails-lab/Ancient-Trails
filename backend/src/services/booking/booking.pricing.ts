import type { AccommodationOption } from "../accommodation/accommodation.types";
import type { BookingTaxSettings } from "./booking-tax-settings";

export function calculateBookingTotals({
  accommodationOption,
  gstPercentage = 0,
  tcsApplicable = false,
  tcsExemptionVerified = false,
  taxRates,
}: {
  accommodationOption: AccommodationOption;
  gstPercentage?: number;
  tcsApplicable?: boolean;
  tcsExemptionVerified?: boolean;
  taxRates?: BookingTaxSettings;
}) {
  if (taxRates) gstPercentage = Math.round((taxRates.sgstPercentage + taxRates.cgstPercentage) * 100) / 100;
  const subtotal = accommodationOption.total;
  const gstAmount = Math.round((subtotal * gstPercentage) / 100);
  const packageTotal = subtotal + gstAmount;
  const tcsPercentage = tcsApplicable && !tcsExemptionVerified ? taxRates?.tcsPercentage ?? 2 : 0;
  const tcsAmount = Math.round(packageTotal * tcsPercentage / 100);
  const grandTotal = packageTotal + tcsAmount;

  return {
    tourPrice: accommodationOption.total,
    taxRates: taxRates ? { ...taxRates } : { sgstPercentage: gstPercentage / 2, cgstPercentage: gstPercentage / 2, tcsPercentage: 2 },
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

export function adjustBookingTcs({ packageTotal, grandTotal, tcsAmount, amountPaid, verified, tcsPercentage = 2 }: {
  packageTotal: number; grandTotal: number; tcsAmount: number; amountPaid: number; verified: boolean; tcsPercentage?: number;
}) {
  const nextTcs = verified ? 0 : Math.round(packageTotal * tcsPercentage / 100);
  const nextTotal = grandTotal - tcsAmount + nextTcs;
  return { tcsAmount: nextTcs, grandTotal: nextTotal,
    balanceAmount: Math.max(0, nextTotal - amountPaid), refundDue: Math.max(0, amountPaid - nextTotal) };
}

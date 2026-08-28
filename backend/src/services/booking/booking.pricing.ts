import type { AccommodationOption } from "../accommodation/accommodation.types";

export function calculateBookingTotals({
  accommodationOption,
  gstPercentage = 0,
}: {
  accommodationOption: AccommodationOption;
  gstPercentage?: number;
}) {
  const subtotal = accommodationOption.total;
  const gstAmount = Math.round((subtotal * gstPercentage) / 100);
  const grandTotal = subtotal + gstAmount;

  return {
    tourPrice: accommodationOption.total,
    subtotal,
    gstPercentage,
    gstAmount,
    grandTotal,
  };
}

export type BookingTax = {
  subtotal?: number;
  gstAmount?: number;
  packageTotal?: number;
  tcsApplicable?: boolean;
  tcsPercentage?: number;
  tcsAmount?: number;
  tcsExemptionVerified?: boolean;
};

export function getBookingTaxBreakdown(booking: BookingTax) {
  return {
    packageTotal: booking.packageTotal ?? (booking.subtotal || 0) + (booking.gstAmount || 0),
    applicable: booking.tcsApplicable === true,
    label: `TCS (${booking.tcsPercentage ?? 2}%)`,
    amount: booking.tcsAmount || 0,
    exempt: booking.tcsApplicable === true && booking.tcsExemptionVerified === true && booking.tcsPercentage === 0,
  };
}

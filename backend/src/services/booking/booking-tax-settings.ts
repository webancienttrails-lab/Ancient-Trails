import { SiteSettings } from "../../models/siteSettings.model";

export type BookingTaxSettings = { sgstPercentage: number; cgstPercentage: number; tcsPercentage: number };

export const defaultBookingTaxSettings: BookingTaxSettings = {
  sgstPercentage: 2.5,
  cgstPercentage: 2.5,
  tcsPercentage: 2,
};

export function resolveBookingTaxSettings(taxes?: Partial<BookingTaxSettings> | null): BookingTaxSettings {
  return {
    sgstPercentage: taxes?.sgstPercentage ?? defaultBookingTaxSettings.sgstPercentage,
    cgstPercentage: taxes?.cgstPercentage ?? defaultBookingTaxSettings.cgstPercentage,
    tcsPercentage: taxes?.tcsPercentage ?? defaultBookingTaxSettings.tcsPercentage,
  };
}

export async function getBookingTaxSettings(): Promise<BookingTaxSettings> {
  const settings = await SiteSettings.findOne({ key: "site" }).select("taxes");
  return resolveBookingTaxSettings(settings?.taxes);
}

export function getSavedBookingTaxSettings(booking: {
  gstPercentage?: number;
  tcsPercentage?: number;
  pricingSnapshot?: { gstPercentage?: number; taxRates?: BookingTaxSettings } | null;
}): BookingTaxSettings {
  if (booking.pricingSnapshot?.taxRates) return { ...booking.pricingSnapshot.taxRates };
  const gst = booking.gstPercentage ?? booking.pricingSnapshot?.gstPercentage ?? 5;
  return { sgstPercentage: gst / 2, cgstPercentage: gst / 2, tcsPercentage: booking.tcsPercentage || 2 };
}

export function splitBookingGst(booking: Parameters<typeof getSavedBookingTaxSettings>[0] & { gstAmount?: number }) {
  const taxes = getSavedBookingTaxSettings(booking);
  const totalRate = taxes.sgstPercentage + taxes.cgstPercentage;
  const amount = booking.gstAmount || 0;
  const cgst = totalRate > 0 ? Math.round(amount * taxes.cgstPercentage / totalRate) : 0;
  return { cgst, sgst: amount - cgst };
}

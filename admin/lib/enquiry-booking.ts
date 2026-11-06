import { getCustomiseEnquiryTourName, getEnquiryCategory, getEnquiryDisplayDetails, type AdminEnquiry } from "@/lib/enquiries";
import type { AdminTour, AdminTourDeparture } from "@/lib/tours";

export function getEnquiryBookingPrefill(enquiry: AdminEnquiry, tours: AdminTour[], departures: AdminTourDeparture[]) {
  const details = getEnquiryDisplayDetails(enquiry);
  const tourName = getEnquiryCategory(enquiry) === "customise" ? getCustomiseEnquiryTourName(enquiry) : details.tourName;
  const tour = tours.find((item) => item.id === enquiry.tourId || item.tourId === details.tourId)
    || tours.find((item) => item.tourName.trim().toLowerCase() === tourName.toLowerCase());
  const dateText = details.travelDate.replace(/,/g, "");
  const date = dateText ? Date.parse(/^\d{1,2}\s+[a-z]+\s+\d{4}$/i.test(dateText) ? `${dateText} UTC` : dateText) : NaN;
  const departure = tour && Number.isFinite(date) ? departures.find((item) =>
    (item.tourId === tour.tourId || item.tourId === tour.id) &&
    item.departureDate?.slice(0, 10) === new Date(date).toISOString().slice(0, 10) &&
    (item.status === "scheduled" || item.status === "coming_soon")) : undefined;
  const count = (pattern: RegExp) => Number(details.guests.match(pattern)?.[1] || 0);
  const adultCount = Math.max(1, count(/(\d+)\s*adults?\b/i));
  const childCount = count(/(\d+)\s*(?:children|child)\b/i) + count(/(\d+)\s*infants?\b/i);
  const [firstName = "", ...lastName] = enquiry.name.trim().split(/\s+/);
  const digits = enquiry.phone.replace(/\D/g, "");
  return {
    sourceEnquiryCategory: getEnquiryCategory(enquiry),
    tourId: tour?.tourId || "",
    departureId: departure?.departureId || "",
    adultCount,
    childCount,
    lead: {
      firstName,
      lastName: lastName.join(" "),
      mobileNumber: digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits,
      email: enquiry.email,
      ...(enquiry.gender ? { gender: enquiry.gender } : {}),
    },
  };
}

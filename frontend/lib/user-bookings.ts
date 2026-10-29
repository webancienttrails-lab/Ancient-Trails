import { sessionFetch, ApiError, apiBaseUrl, apiRequest, type ApiResponse } from "@/lib/api";
import { getTravellerSession } from "@/lib/auth";
import type {
  BookingConfirmation,
  BookingKycDocument,
} from "@/lib/booking-payment";

export type UserBookingTripStatus = "Upcoming" | "Completed" | "Cancelled";

export type UserBookingTour = {
  tourId: string;
  tourName: string;
  durationDn: string;
  destinationId: string;
  destinationIds: string[];
  category: string;
  expertId: string;
  thumbnailImage?: string;
  bannerImage: string;
  galleryImages: string[];
};

export type UserBookingDeparture = {
  departureId: string;
  departureDate: string | null;
  returnDate: string | null;
  seatsAvailable: number;
  status: string;
};

export type UserBookingDestination = {
  destinationId: string;
  destinationName: string;
  countryRegion: string;
  state: string;
  city: string;
  bannerImage: string;
  galleryImages: string[];
};

export type UserBooking = {
  booking: BookingConfirmation;
  departure: UserBookingDeparture | null;
  destination: UserBookingDestination | null;
  tour: UserBookingTour | null;
};

function getTravellerHeaders(): HeadersInit {
  const session = getTravellerSession();

  if (!session?.sessionId) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    "X-Session-Id": session.sessionId,
  };
}

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getStartOfToday(now = new Date()) {
  const today = new Date(now);

  today.setHours(0, 0, 0, 0);

  return today;
}

function formatDate(value?: string | null) {
  const date = parseDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function listTravellerBookings() {
  return apiRequest<{ bookings: UserBooking[] }>("/api/bookings/me", {
    cache: "no-store",
    headers: getTravellerHeaders(),
  });
}

async function readUploadResponse<TData>(
  response: Response
): Promise<ApiResponse<TData>> {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as Partial<ApiResponse<TData>> | null)
    : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message || "Upload failed",
      body?.details
    );
  }

  if (!body) {
    throw new ApiError(response.status, "Invalid API response");
  }

  return body as ApiResponse<TData>;
}

export function getBookingKycDocumentUrl(source = "") {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (trimmedSource.startsWith("/uploads/")) {
    return `${apiBaseUrl}${trimmedSource}`;
  }

  return trimmedSource;
}

export async function uploadTravellerBookingKycDocument(payload: {
  bookingId: string;
  documentType: BookingKycDocument["documentType"];
  file: File;
  travellerId: string;
}) {
  const formData = new FormData();

  formData.append("travellerId", payload.travellerId);
  formData.append("documentType", payload.documentType);
  formData.append("document", payload.file);

  return readUploadResponse<{ booking: BookingConfirmation }>(
    await sessionFetch(
      `${apiBaseUrl}/api/bookings/${encodeURIComponent(payload.bookingId)}/kyc`,
      {
        method: "POST",
        headers: getTravellerHeaders(),
        body: formData,
        credentials: "include",
      }
    )
  );
}

export function getUserBookingTripStatus(
  item: UserBooking,
  now = new Date()
): UserBookingTripStatus {
  const paymentStatus = item.booking.paymentStatus?.toLowerCase() || "";

  if (
    paymentStatus === "failed" ||
    paymentStatus === "refunded" ||
    item.departure?.status === "cancelled"
  ) {
    return "Cancelled";
  }

  const returnDate = parseDate(
    item.departure?.returnDate || item.booking.pricingSnapshot?.returnDate
  );

  if (returnDate && returnDate.getTime() < getStartOfToday(now).getTime()) {
    return "Completed";
  }

  return "Upcoming";
}

export function getUserBookingReference(item: UserBooking) {
  return item.booking.bookingReference || `ATB-${item.booking.id.slice(-8).toUpperCase()}`;
}

export function getUserBookingDetailHref(item: UserBooking) {
  return `/me/bookings/${encodeURIComponent(item.booking.id)}`;
}

export function getUserBookingTitle(item: UserBooking) {
  return item.tour?.tourName || item.booking.tourId || "Ancient Trails Tour";
}

export function getUserBookingDuration(item: UserBooking) {
  return item.tour?.durationDn || "Duration to be announced";
}

export function getUserBookingTravellerLabel(item: UserBooking) {
  const totalGuests = item.booking.totalGuest || 0;

  return `${totalGuests} ${totalGuests === 1 ? "Traveller" : "Travellers"}`;
}

export function getUserBookingDateRange(item: UserBooking) {
  const departureDate =
    item.departure?.departureDate || item.booking.pricingSnapshot?.departureDate;
  const returnDate =
    item.departure?.returnDate || item.booking.pricingSnapshot?.returnDate;
  const departureLabel = formatDate(departureDate);
  const returnLabel = formatDate(returnDate);

  if (departureLabel && returnLabel) {
    return `${departureLabel} - ${returnLabel}`;
  }

  return departureLabel || returnLabel || "Dates to be announced";
}

export function getUserBookingLocation(item: UserBooking) {
  const destination = item.destination;

  if (!destination) {
    return item.tour?.destinationId || "Destination to be announced";
  }

  return [
    destination.destinationName || destination.city,
    destination.state || destination.countryRegion,
  ]
    .filter(Boolean)
    .join(", ");
}

export function getUserBookingImageSource(item: UserBooking) {
  return (
    item.tour?.thumbnailImage ||
    item.tour?.bannerImage ||
    item.tour?.galleryImages?.[0] ||
    item.destination?.bannerImage ||
    item.destination?.galleryImages?.[0] ||
    "/home assets/Heritage Banner.webp"
  );
}

export function getUserBookingAmount(item: UserBooking) {
  const amount =
    item.booking.grandTotal ||
    item.booking.amountPaid ||
    item.booking.depositAmount ||
    0;

  return new Intl.NumberFormat("en-IN", {
    currency: item.booking.paymentCurrency || "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function getUserBookingPaymentLabel(item: UserBooking) {
  const paymentStatus = item.booking.paymentStatus || "pending";

  return paymentStatus
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getUserBookingDate(item: UserBooking) {
  return formatDate(item.booking.createdAt) || "Not available";
}

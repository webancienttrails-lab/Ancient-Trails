import { ApiError, apiRequest } from "@/lib/api";
import { getTravellerSession } from "@/lib/auth";

export type BookingGuestDetailsPayload = {
  title: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  email: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  panNumber?: string;
};

export type BookingTravellerPayload = {
  id: string;
  type: "adult" | "child";
  title?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  mobileNumber?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  panNumber?: string;
  ageOnDeparture?: number;
  kycDocuments?: BookingKycDocument[];
};

export type BookingKycDocument = {
  id: string;
  documentType:
    | "aadhaar_card"
    | "driving_license"
    | "voter_id"
    | "passport"
    | "pan_card";
  documentLabel: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedBy: "traveller" | "admin";
  uploadedAt: string;
};

export type BookingPayload = {
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: "advance" | "full";
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: Array<{
    age: number;
  }>;
  guestDetails: BookingGuestDetailsPayload[];
  travellers: BookingTravellerPayload[];
  accommodationDetails: {
    singleOccupancyOneRoom: number;
    singleOccupancyTwoRooms: number;
    doubleOccupancy: number;
    twinOccupancy: number;
    tripleOccupancy: number;
  };
  gstPercentage: number;
};

export type BookingConfirmation = {
  paymentMethod?: string;
  paymentMode?: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  id: string;
  bookingReference?: string;
  bookingStatus?: string;
  tourId: string;
  departureId: string;
  selectedAccommodationOptionId: string;
  paymentOption?: "advance" | "full";
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: Array<{
    age: number;
  }>;
  guestDetails: BookingGuestDetailsPayload[];
  travellers: BookingTravellerPayload[];
  accommodationDetails: BookingPayload["accommodationDetails"];
  pricingSnapshot?: {
    departureDate?: string | null;
    returnDate?: string | null;
    accommodation?: {
      optionTitle?: string;
      rooms?: Array<{
        id: string;
        title: string;
        bedSummary: string;
        allocations?: Array<{
          label: string;
          price: number;
        }>;
      }>;
    };
  };
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  grandTotal?: number;
  airFlightCharges?: number;
  airfareIncludedInTotal?: boolean;
  airfareExcluded?: boolean;
  airfareAddedAt?: string | null;
  airfareHistory?: Array<{ previousAmount: number; amount: number; changedBy: string; changedAt: string; previousIncludedInTotal?: boolean; includedInTotal?: boolean; previousTotal?: number; total?: number; reason?: string }>;
  collectionHistory?: Array<{ paymentId: string; amount: number; airfareAmount: number; paidAt: string }>;
  depositAmount?: number;
  balanceAmount?: number;
  balanceDueDate?: string | null;
  paymentStatus?: string;
  paymentProvider?: string;
  paymentOrderId?: string;
  paymentId?: string;
  paymentCurrency?: string;
  amountPaid?: number;
  paymentCapturedAt?: string | null;
  heldSeatCount?: number;
  holdExpiresAt?: string | null;
  recoveryExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingPaymentSession = {
  id: string;
  orderId: string;
  amount: number;
  amountRupees: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "expired";
};

export type RazorpayCheckoutDetails = {
  key: string;
  orderId: string;
  amount: number;
  amountRupees: number;
  currency: string;
  name: string;
  description: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
};

export type BookingPaymentOrder = {
  checkout: RazorpayCheckoutDetails;
  paymentSession: BookingPaymentSession;
};

export type BookingBalancePaymentOrder =
  | BookingPaymentOrder
  | { paymentLinkUrl: string };

export type BookingPaymentVerification = {
  booking: BookingConfirmation;
  confirmationToken: string;
};

export type BookingPaymentOrderStatus = {
  booking: BookingConfirmation | null;
  confirmationToken?: string;
  isConfirmed: boolean;
  paymentSession: BookingPaymentSession;
};

export type BookingBalancePaymentVerification = {
  booking: BookingConfirmation;
  paymentSession: BookingPaymentSession;
};

export type BookingConfirmationData = {
  booking: BookingConfirmation;
  departure: {
    departureId: string;
    departureDate: string | null;
    returnDate: string | null;
    totalSeats?: number;
    seatsAvailable: number;
  } | null;
  expert: {
    expertId: string;
    fullName: string;
    image: string;
    expertiseTags: string[];
  } | null;
  tour: {
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
  } | null;
};

export type BookingRecoveryData = {
  booking: BookingConfirmation;
  canRetry: boolean;
  isCancelled: boolean;
  isConfirmed: boolean;
  isExpired: boolean;
  hasAvailability: boolean;
  confirmationToken?: string;
  recoveryUrl: string;
  requiredSeats: number;
  availableSeats: number;
  departure: BookingConfirmationData["departure"];
  tour: BookingConfirmationData["tour"];
};

export function createOfflineBooking(payload: BookingPayload) {
  return apiRequest<{ booking: Pick<BookingConfirmation, "id" | "bookingReference">; submissionToken: string }>("/api/bookings/offline", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createBookingPaymentOrder(payload: BookingPayload) {
  return apiRequest<BookingPaymentOrder>("/api/bookings/payment/order", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelBookingPaymentOrder(orderId: string) {
  return apiRequest<{ paymentSession: BookingPaymentSession | null }>(
    "/api/bookings/payment/cancel",
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }
  );
}

export function verifyBookingPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiRequest<BookingPaymentVerification>("/api/bookings/payment/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getBookingPaymentOrderStatus(orderId: string) {
  return apiRequest<BookingPaymentOrderStatus>(
    `/api/bookings/payment/orders/${encodeURIComponent(orderId)}/status`
  );
}

function getTravellerHeaders(): HeadersInit {
  const session = getTravellerSession();

  if (!session?.token) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export function createBookingBalancePaymentOrder(bookingId: string) {
  return apiRequest<BookingBalancePaymentOrder>(
    `/api/bookings/${encodeURIComponent(bookingId)}/balance-payment/order`,
    {
      headers: getTravellerHeaders(),
      method: "POST",
    }
  );
}

export function verifyBookingBalancePayment(
  bookingId: string,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }
) {
  return apiRequest<BookingBalancePaymentVerification>(
    `/api/bookings/${encodeURIComponent(bookingId)}/balance-payment/verify`,
    {
      body: JSON.stringify(payload),
      headers: getTravellerHeaders(),
      method: "POST",
    }
  );
}

export function getOfflineBookingSubmission(bookingId: string, token: string) {
  return apiRequest<BookingConfirmationData>(
    `/api/bookings/${encodeURIComponent(bookingId)}/offline-submission?token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
}

export function getBookingConfirmation(bookingId: string, token: string) {
  return apiRequest<BookingConfirmationData>(
    `/api/bookings/${encodeURIComponent(
      bookingId
    )}/confirmation?token=${encodeURIComponent(token)}`,
    {
      cache: "no-store",
    }
  );
}

export function getBookingRecovery(bookingId: string, token: string) {
  return apiRequest<BookingRecoveryData>(
    `/api/bookings/${encodeURIComponent(
      bookingId
    )}/recovery?token=${encodeURIComponent(token)}`,
    {
      cache: "no-store",
    }
  );
}

export function createBookingRecoveryPaymentOrder(
  bookingId: string,
  token: string
) {
  return apiRequest<BookingPaymentOrder>(
    `/api/bookings/${encodeURIComponent(
      bookingId
    )}/recovery/payment/order?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
    }
  );
}

export function formatBookingPaymentMethod(booking: { paymentMethod?: string; paymentMode?: string; paymentProvider?: string }): string {
  const labels: Record<string, string> = { cash: "Cash", cheque: "Cheque", neft: "NEFT", imps: "IMPS", rtgs: "RTGS", upi: "UPI", netbanking: "Netbanking", card: "Card", wallet: "Wallet", emi: "EMI", bank_transfer: "Bank Transfer", razorpay: "Razorpay" };
  if (booking.paymentMethod) return labels[booking.paymentMethod] || booking.paymentMethod;
  if (booking.paymentMode === "bank_transfer") return "Bank Transfer";
  if (booking.paymentProvider === "razorpay") return "Razorpay";
  return "Not recorded";
}
